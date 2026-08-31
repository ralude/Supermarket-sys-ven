import { DomainError } from '@supermarket/shared';
import {
  cloneFiscalOperationEvidence,
  isFiscalOperationCommitted,
  isFiscalOperationEvidenceCoherent,
  isFiscalOperationRetrySafe,
  isFiscalOperationTerminalFailureSafe,
  type FiscalDocumentContent,
  type FiscalOperationEvidence
} from './fiscal-types.js';

export const FISCAL_DOCUMENT_STATES = [
  'PENDING', 'PRINTING', 'ISSUED', 'ERROR', 'RETRYING', 'FAILED'
] as const;
export type FiscalDocumentState = (typeof FISCAL_DOCUMENT_STATES)[number];

export type FiscalDocumentTransition = {
  readonly eventId: string;
  readonly version: number;
  readonly from: FiscalDocumentState | null;
  readonly to: FiscalDocumentState;
  readonly actorId: string;
  readonly occurredAt: Date;
  readonly errorCode: string | null;
  readonly evidence: FiscalOperationEvidence | null;
};

type FiscalEventType =
  | 'FiscalDocumentPending'
  | 'FiscalDocumentPrintingStarted'
  | 'FiscalDocumentIssued'
  | 'FiscalDocumentErrorRecorded'
  | 'FiscalDocumentRetrying'
  | 'FiscalDocumentFailed';

export type FiscalDocumentDomainEvent = {
  readonly type: FiscalEventType;
  readonly eventId: string;
  readonly aggregateId: string;
  readonly aggregateType: 'FiscalDocument';
  readonly aggregateVersion: number;
  readonly occurredAt: Date;
  readonly payload: Record<string, unknown>;
};

export type CreateFiscalDocumentProps = {
  readonly id: string;
  readonly content: FiscalDocumentContent;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly terminalId: string;
  readonly originNodeId: string;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly eventId: string;
};

export type RestoreFiscalDocumentProps = Omit<CreateFiscalDocumentProps, 'eventId'> & {
  readonly status: FiscalDocumentState;
  readonly version: number;
  readonly attempts: number;
  readonly fiscalNumber: string | null;
  readonly lastErrorCode: string | null;
  readonly lastEvidence: FiscalOperationEvidence | null;
  readonly lastFailureRetryable: boolean;
  readonly transitions: readonly FiscalDocumentTransition[];
};

const cloneContent = (content: FiscalDocumentContent): FiscalDocumentContent => ({
  ...content,
  lines: content.lines.map((line) => ({ ...line })),
  payments: content.payments.map((payment) => ({ ...payment }))
});

export class FiscalDocument {
  private currentStatus: FiscalDocumentState = 'PENDING';
  private currentVersion = 1;
  private currentAttempts = 0;
  private currentFiscalNumber: string | null = null;
  private currentLastErrorCode: string | null = null;
  private currentLastEvidence: FiscalOperationEvidence | null = null;
  private currentLastFailureRetryable = false;
  private readonly currentTransitions: FiscalDocumentTransition[] = [];
  private readonly events: FiscalDocumentDomainEvent[] = [];
  private readonly storedContent: FiscalDocumentContent;

  private constructor(
    readonly id: string,
    content: FiscalDocumentContent,
    readonly idempotencyKey: string,
    readonly requestFingerprint: string,
    readonly terminalId: string,
    readonly originNodeId: string,
    readonly createdBy: string,
    readonly createdAt: Date
  ) {
    this.storedContent = cloneContent(content);
  }

  static create(props: CreateFiscalDocumentProps): FiscalDocument {
    const document = new FiscalDocument(
      FiscalDocument.requireText(props.id, 'FISCAL_DOCUMENT_ID_REQUIRED', 'Fiscal document ID is required.'),
      FiscalDocument.validateContent(props.content),
      FiscalDocument.requireText(props.idempotencyKey, 'FISCAL_IDEMPOTENCY_KEY_REQUIRED', 'Fiscal idempotency key is required.'),
      FiscalDocument.requireText(props.requestFingerprint, 'FISCAL_FINGERPRINT_REQUIRED', 'Fiscal request fingerprint is required.'),
      FiscalDocument.requireText(props.terminalId, 'FISCAL_TERMINAL_REQUIRED', 'Fiscal terminal is required.'),
      FiscalDocument.requireText(props.originNodeId, 'FISCAL_NODE_REQUIRED', 'Fiscal origin node is required.'),
      FiscalDocument.requireText(props.createdBy, 'FISCAL_ACTOR_REQUIRED', 'Fiscal actor is required.'),
      FiscalDocument.validDate(props.createdAt)
    );
    document.addTransition({
      eventId: props.eventId, version: 1, from: null, to: 'PENDING', actorId: props.createdBy,
      occurredAt: props.createdAt, errorCode: null, evidence: null
    }, 'FiscalDocumentPending', {
      referenceId: document.content.referenceId,
      type: document.content.type
    });
    return document;
  }

  static restore(props: RestoreFiscalDocumentProps): FiscalDocument {
    const document = FiscalDocument.create({ ...props, eventId: 'restore-placeholder' });
    document.currentStatus = props.status;
    document.currentVersion = props.version;
    document.currentAttempts = props.attempts;
    document.currentFiscalNumber = props.fiscalNumber;
    document.currentLastErrorCode = props.lastErrorCode;
    document.currentLastEvidence = props.lastEvidence === null
      ? null
      : cloneFiscalOperationEvidence(props.lastEvidence);
    document.currentLastFailureRetryable = props.lastFailureRetryable;
    document.currentTransitions.length = 0;
    document.currentTransitions.push(...props.transitions.map((transition) => ({
      ...transition,
      occurredAt: FiscalDocument.validDate(transition.occurredAt),
      evidence: transition.evidence === null
        ? null
        : cloneFiscalOperationEvidence(transition.evidence)
    })));
    document.events.length = 0;
    return document;
  }

  get content(): FiscalDocumentContent { return cloneContent(this.storedContent); }
  get status(): FiscalDocumentState { return this.currentStatus; }
  get version(): number { return this.currentVersion; }
  get attempts(): number { return this.currentAttempts; }
  get fiscalNumber(): string | null { return this.currentFiscalNumber; }
  get lastErrorCode(): string | null { return this.currentLastErrorCode; }
  get lastEvidence(): FiscalOperationEvidence | null {
    return this.currentLastEvidence === null
      ? null
      : cloneFiscalOperationEvidence(this.currentLastEvidence);
  }
  get lastFailureRetryable(): boolean { return this.currentLastFailureRetryable; }
  get transitions(): readonly FiscalDocumentTransition[] {
    return this.currentTransitions.map((transition) => ({
      ...transition,
      occurredAt: new Date(transition.occurredAt),
      evidence: transition.evidence === null
        ? null
        : cloneFiscalOperationEvidence(transition.evidence)
    }));
  }
  get domainEvents(): readonly FiscalDocumentDomainEvent[] { return [...this.events]; }

  startPrinting(props: { actorId: string; occurredAt: Date; eventId: string }): void {
    this.assertMutable();
    if (this.currentStatus !== 'PENDING' && this.currentStatus !== 'RETRYING') {
      throw new DomainError('FISCAL_DOCUMENT_INVALID_STATE', 'Fiscal document cannot start printing.');
    }
    this.currentAttempts += 1;
    this.currentLastErrorCode = null;
    this.currentLastEvidence = null;
    this.currentLastFailureRetryable = false;
    this.transition('PRINTING', props, 'FiscalDocumentPrintingStarted', {
      attempt: this.currentAttempts
    });
  }

  markIssued(props: {
    fiscalNumber: string;
    actorId: string;
    occurredAt: Date;
    eventId: string;
    evidence: FiscalOperationEvidence;
  }): void {
    this.assertMutable();
    if (this.currentStatus !== 'PRINTING' && this.currentStatus !== 'ERROR' &&
      this.currentStatus !== 'RETRYING') {
      throw new DomainError('FISCAL_DOCUMENT_INVALID_STATE', 'Fiscal document cannot be marked issued.');
    }
    FiscalDocument.assertCommittedEvidence(props.evidence);
    this.currentFiscalNumber = FiscalDocument.requireText(
      props.fiscalNumber, 'FISCAL_NUMBER_REQUIRED', 'Fiscal document number is required.'
    );
    this.currentLastErrorCode = null;
    this.currentLastEvidence = cloneFiscalOperationEvidence(props.evidence);
    this.currentLastFailureRetryable = false;
    this.transition('ISSUED', props, 'FiscalDocumentIssued', {
      fiscalNumber: this.currentFiscalNumber,
      referenceId: this.content.referenceId,
      evidence: this.currentLastEvidence
    });
  }

  recordError(props: {
    code: string;
    evidence: FiscalOperationEvidence;
    retryable: boolean;
    actorId: string;
    occurredAt: Date;
    eventId: string;
  }): void {
    this.assertMutable();
    if (this.currentStatus !== 'PRINTING') {
      throw new DomainError('FISCAL_DOCUMENT_INVALID_STATE', 'Fiscal document is not printing.');
    }
    FiscalDocument.assertFailureEvidence(props.evidence);
    this.currentLastErrorCode = FiscalDocument.requireText(
      props.code, 'FISCAL_ERROR_CODE_REQUIRED', 'Fiscal error code is required.'
    );
    this.currentLastEvidence = cloneFiscalOperationEvidence(props.evidence);
    this.currentLastFailureRetryable = props.retryable;
    this.transition('ERROR', props, 'FiscalDocumentErrorRecorded', {
      errorCode: props.code,
      evidence: this.currentLastEvidence,
      retryable: props.retryable
    });
  }

  beginRetry(props: {
    actorId: string;
    occurredAt: Date;
    eventId: string;
  }): void {
    this.assertMutable();
    if (this.currentStatus !== 'ERROR' || !this.currentLastFailureRetryable ||
      this.currentLastEvidence === null ||
      !isFiscalOperationRetrySafe(this.currentLastEvidence)) {
      throw new DomainError(
        'FISCAL_RETRY_RECONCILIATION_REQUIRED',
        'Fiscal document cannot retry without confirmed device state.'
      );
    }
    this.transition('RETRYING', props, 'FiscalDocumentRetrying', {
      previousErrorCode: this.currentLastErrorCode
    });
  }

  markFailed(props: { actorId: string; occurredAt: Date; eventId: string }): void {
    this.assertMutable();
    if (this.currentStatus !== 'ERROR' && this.currentStatus !== 'RETRYING') {
      throw new DomainError('FISCAL_DOCUMENT_INVALID_STATE', 'Fiscal document cannot be marked failed.');
    }
    if (this.currentLastEvidence === null ||
      !isFiscalOperationTerminalFailureSafe(this.currentLastEvidence)) {
      throw new DomainError(
        'FISCAL_TERMINAL_FAILURE_EVIDENCE_REQUIRED',
        'Terminal failure requires authoritative no-commit evidence.'
      );
    }
    this.transition('FAILED', props, 'FiscalDocumentFailed', {
      errorCode: this.currentLastErrorCode
    });
  }

  private transition(
    to: FiscalDocumentState,
    props: { actorId: string; occurredAt: Date; eventId: string },
    eventType: FiscalEventType,
    payload: Record<string, unknown>
  ): void {
    const from = this.currentStatus;
    this.currentStatus = to;
    this.currentVersion += 1;
    this.addTransition({
      eventId: props.eventId,
      version: this.currentVersion,
      from,
      to,
      actorId: FiscalDocument.requireText(
        props.actorId, 'FISCAL_ACTOR_REQUIRED', 'Fiscal actor is required.'
      ),
      occurredAt: FiscalDocument.validDate(props.occurredAt),
      errorCode: this.currentLastErrorCode,
      evidence: this.currentLastEvidence === null
        ? null
        : cloneFiscalOperationEvidence(this.currentLastEvidence)
    }, eventType, payload);
  }

  private addTransition(
    transition: FiscalDocumentTransition,
    type: FiscalEventType,
    payload: Record<string, unknown>
  ): void {
    const eventId = FiscalDocument.requireText(
      transition.eventId, 'FISCAL_EVENT_ID_REQUIRED', 'Fiscal event ID is required.'
    );
    this.currentTransitions.push({
      ...transition,
      eventId,
      occurredAt: new Date(transition.occurredAt),
      evidence: transition.evidence === null
        ? null
        : cloneFiscalOperationEvidence(transition.evidence)
    });
    this.events.push({
      type,
      eventId,
      aggregateId: this.id,
      aggregateType: 'FiscalDocument',
      aggregateVersion: this.currentVersion,
      occurredAt: new Date(transition.occurredAt),
      payload
    });
  }

  private assertMutable(): void {
    if (this.currentStatus === 'ISSUED') {
      throw new DomainError(
        'FISCAL_DOCUMENT_ISSUED_IMMUTABLE', 'Issued fiscal documents are immutable.'
      );
    }
    if (this.currentStatus === 'FAILED') {
      throw new DomainError(
        'FISCAL_DOCUMENT_FAILED', 'Failed fiscal documents require intervention.'
      );
    }
  }

  private static validateContent(content: FiscalDocumentContent): FiscalDocumentContent {
    FiscalDocument.requireText(
      content.referenceId, 'FISCAL_REFERENCE_REQUIRED', 'Fiscal reference is required.'
    );
    const currencyCode = content.currencyCode.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9]{2,7}$/.test(currencyCode)) {
      throw new DomainError('FISCAL_CURRENCY_INVALID', 'Fiscal currency code is invalid.');
    }
    if (content.lines.length === 0 || content.payments.length === 0 ||
      !Number.isSafeInteger(content.totalMinorUnits) || content.totalMinorUnits <= 0) {
      throw new DomainError(
        'FISCAL_DOCUMENT_CONTENT_INVALID', 'Fiscal document content is invalid.'
      );
    }
    for (const line of content.lines) {
      FiscalDocument.requireText(
        line.id, 'FISCAL_LINE_ID_REQUIRED', 'Fiscal line ID is required.'
      );
      FiscalDocument.requireText(
        line.description,
        'FISCAL_LINE_DESCRIPTION_REQUIRED',
        'Fiscal line description is required.'
      );
      if (!Number.isSafeInteger(line.quantityScaled) || line.quantityScaled <= 0 ||
        !Number.isInteger(line.quantityScale) || line.quantityScale < 0 ||
        line.quantityScale > 6 || !Number.isSafeInteger(line.unitPriceMinorUnits) ||
        line.unitPriceMinorUnits < 0 || !Number.isInteger(line.taxRateBasisPoints) ||
        line.taxRateBasisPoints < 0 || line.taxRateBasisPoints > 10_000 ||
        !Number.isSafeInteger(line.totalMinorUnits) || line.totalMinorUnits < 0) {
        throw new DomainError('FISCAL_LINE_INVALID', 'Fiscal document line is invalid.');
      }
    }
    for (const payment of content.payments) {
      FiscalDocument.requireText(
        payment.methodCode,
        'FISCAL_PAYMENT_METHOD_REQUIRED',
        'Fiscal payment method is required.'
      );
      if (!Number.isSafeInteger(payment.amountMinorUnits) || payment.amountMinorUnits <= 0) {
        throw new DomainError('FISCAL_PAYMENT_INVALID', 'Fiscal payment is invalid.');
      }
    }
    const lineTotal = content.lines.reduce((total, line) => total + line.totalMinorUnits, 0);
    const paymentTotal = content.payments.reduce(
      (total, payment) => total + payment.amountMinorUnits, 0
    );
    if (lineTotal !== content.totalMinorUnits || paymentTotal !== content.totalMinorUnits) {
      throw new DomainError(
        'FISCAL_TOTALS_INCONSISTENT', 'Fiscal document totals are inconsistent.'
      );
    }
    return cloneContent({ ...content, currencyCode });
  }

  private static requireText(value: string, code: string, message: string): string {
    const normalized = value.trim();
    if (normalized.length === 0) throw new DomainError(code, message);
    return normalized;
  }

  private static validDate(value: Date): Date {
    if (Number.isNaN(value.getTime())) {
      throw new DomainError('FISCAL_TIMESTAMP_INVALID', 'Fiscal timestamp is invalid.');
    }
    return new Date(value);
  }

  private static assertCommittedEvidence(evidence: FiscalOperationEvidence): void {
    if (!isFiscalOperationCommitted(evidence)) {
      throw new DomainError(
        'FISCAL_COMMIT_EVIDENCE_REQUIRED',
        'Issued fiscal documents require positive fiscal commit evidence.'
      );
    }
  }

  private static assertFailureEvidence(evidence: FiscalOperationEvidence): void {
    if (!isFiscalOperationEvidenceCoherent(evidence) || evidence.printDelivery === 'COMPLETE') {
      throw new DomainError(
        'FISCAL_FAILURE_EVIDENCE_INVALID',
        'Fiscal failure evidence is inconsistent.'
      );
    }
  }
}
