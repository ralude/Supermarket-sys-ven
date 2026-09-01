import { DomainError } from '@supermarket/shared';
import {
  cloneFiscalOperationEvidence,
  isFiscalOperationCommitted,
  isFiscalOperationEvidenceCoherent,
  isFiscalOperationRetrySafe,
  isFiscalOperationTerminalFailureSafe,
  type FiscalOperationEvidence
} from './fiscal-types.js';

export type FiscalDayState = 'DAY_OPEN' | 'Z_PENDING' | 'DAY_CLOSED';
export type FiscalReportType = 'X' | 'Z';
export type FiscalReportState = 'PENDING' | 'PRINTING' | 'ISSUED' | 'ERROR' | 'RETRYING' | 'FAILED';

export type FiscalReportTransition = {
  readonly eventId: string;
  readonly version: number;
  readonly from: FiscalReportState | null;
  readonly to: FiscalReportState;
  readonly actorId: string;
  readonly occurredAt: Date;
  readonly errorCode: string | null;
  readonly evidence: FiscalOperationEvidence | null;
};

export type FiscalReport = {
  readonly id: string;
  readonly type: FiscalReportType;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly status: FiscalReportState;
  readonly attempts: number;
  readonly reportNumber: string | null;
  readonly lastErrorCode: string | null;
  readonly lastEvidence: FiscalOperationEvidence | null;
  readonly retryable: boolean;
  readonly requestedBy: string;
  readonly requestedAt: Date;
  readonly transitions: readonly FiscalReportTransition[];
};

type MutableFiscalReport = {
  -readonly [Key in keyof FiscalReport]: FiscalReport[Key];
};

type FiscalDayEventType =
  | 'FiscalDayOpened'
  | 'FiscalXReportRequested'
  | 'FiscalZReportRequested'
  | 'FiscalReportPrintingStarted'
  | 'FiscalReportErrorRecorded'
  | 'FiscalReportRetrying'
  | 'FiscalXReportIssued'
  | 'FiscalZReportIssued'
  | 'FiscalReportFailed';

export type FiscalDayDomainEvent = {
  readonly type: FiscalDayEventType;
  readonly eventId: string;
  readonly aggregateId: string;
  readonly aggregateType: 'FiscalDay';
  readonly aggregateVersion: number;
  readonly occurredAt: Date;
  readonly payload: Record<string, unknown>;
};

export type OpenFiscalDayProps = {
  readonly id: string;
  readonly businessDate: string;
  readonly terminalId: string;
  readonly originNodeId: string;
  readonly openedBy: string;
  readonly openedAt: Date;
  readonly eventId: string;
};

export type RestoreFiscalDayProps = Omit<OpenFiscalDayProps, 'eventId'> & {
  readonly state: FiscalDayState;
  readonly version: number;
  readonly reports: readonly FiscalReport[];
};

const cloneReport = (report: FiscalReport): FiscalReport => ({
  ...report,
  lastEvidence: report.lastEvidence === null
    ? null
    : cloneFiscalOperationEvidence(report.lastEvidence),
  requestedAt: new Date(report.requestedAt),
  transitions: report.transitions.map((transition) => ({
    ...transition,
    occurredAt: new Date(transition.occurredAt),
    evidence: transition.evidence === null
      ? null
      : cloneFiscalOperationEvidence(transition.evidence)
  }))
});

export class FiscalDay {
  private currentState: FiscalDayState = 'DAY_OPEN';
  private currentVersion = 1;
  private readonly currentReports: MutableFiscalReport[] = [];
  private readonly events: FiscalDayDomainEvent[] = [];

  private constructor(
    readonly id: string,
    readonly businessDate: string,
    readonly terminalId: string,
    readonly originNodeId: string,
    readonly openedBy: string,
    readonly openedAt: Date
  ) {}

  static open(props: OpenFiscalDayProps): FiscalDay {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(props.businessDate)) {
      throw new DomainError('FISCAL_BUSINESS_DATE_INVALID', 'Fiscal business date is invalid.');
    }
    const day = new FiscalDay(
      FiscalDay.text(props.id, 'FISCAL_DAY_ID_REQUIRED', 'Fiscal day ID is required.'),
      props.businessDate,
      FiscalDay.text(props.terminalId, 'FISCAL_TERMINAL_REQUIRED', 'Fiscal terminal is required.'),
      FiscalDay.text(props.originNodeId, 'FISCAL_NODE_REQUIRED', 'Fiscal origin node is required.'),
      FiscalDay.text(props.openedBy, 'FISCAL_ACTOR_REQUIRED', 'Fiscal actor is required.'),
      FiscalDay.date(props.openedAt)
    );
    day.event('FiscalDayOpened', props.eventId, props.openedAt, {
      businessDate: day.businessDate
    });
    return day;
  }

  static restore(props: RestoreFiscalDayProps): FiscalDay {
    const day = FiscalDay.open({ ...props, eventId: 'restore-placeholder' });
    day.currentState = props.state;
    day.currentVersion = props.version;
    day.currentReports.push(...props.reports.map((report) => cloneReport(report) as MutableFiscalReport));
    day.events.length = 0;
    return day;
  }

  get state(): FiscalDayState { return this.currentState; }
  get version(): number { return this.currentVersion; }
  get reports(): readonly FiscalReport[] { return this.currentReports.map(cloneReport); }
  get domainEvents(): readonly FiscalDayDomainEvent[] { return [...this.events]; }

  requestReport(props: {
    id: string;
    type: FiscalReportType;
    idempotencyKey: string;
    requestFingerprint: string;
    actorId: string;
    occurredAt: Date;
    eventId: string;
  }): FiscalReport {
    if (this.currentState !== 'DAY_OPEN') {
      throw new DomainError('FISCAL_DAY_NOT_OPEN', 'Fiscal day is not open.');
    }
    if (this.currentReports.some(({ id }) => id === props.id) ||
      this.currentReports.some(({ idempotencyKey }) => idempotencyKey === props.idempotencyKey)) {
      throw new DomainError('FISCAL_REPORT_DUPLICATE', 'Fiscal report already exists.');
    }
    const report: MutableFiscalReport = {
      id: FiscalDay.text(props.id, 'FISCAL_REPORT_ID_REQUIRED', 'Fiscal report ID is required.'),
      type: props.type,
      idempotencyKey: FiscalDay.text(
        props.idempotencyKey,
        'FISCAL_IDEMPOTENCY_KEY_REQUIRED',
        'Fiscal idempotency key is required.'
      ),
      requestFingerprint: FiscalDay.text(
        props.requestFingerprint,
        'FISCAL_FINGERPRINT_REQUIRED',
        'Fiscal request fingerprint is required.'
      ),
      status: 'PENDING',
      attempts: 0,
      reportNumber: null,
      lastErrorCode: null,
      lastEvidence: null,
      retryable: false,
      requestedBy: FiscalDay.text(
        props.actorId, 'FISCAL_ACTOR_REQUIRED', 'Fiscal actor is required.'
      ),
      requestedAt: FiscalDay.date(props.occurredAt),
      transitions: []
    };
    if (props.type === 'Z') this.currentState = 'Z_PENDING';
    this.currentReports.push(report);
    this.transitionReport(report, null, 'PENDING', props, null, null);
    this.event(
      props.type === 'X' ? 'FiscalXReportRequested' : 'FiscalZReportRequested',
      props.eventId,
      props.occurredAt,
      { reportId: report.id }
    );
    return cloneReport(report);
  }

  startReport(props: {
    reportId: string;
    actorId: string;
    occurredAt: Date;
    eventId: string;
  }): void {
    const report = this.report(props.reportId);
    if (report.status !== 'PENDING' && report.status !== 'RETRYING') {
      throw new DomainError('FISCAL_REPORT_INVALID_STATE', 'Fiscal report cannot start printing.');
    }
    const from = report.status;
    report.status = 'PRINTING';
    report.attempts += 1;
    report.lastErrorCode = null;
    report.lastEvidence = null;
    report.retryable = false;
    this.transitionReport(report, from, 'PRINTING', props, null, null);
    this.event('FiscalReportPrintingStarted', props.eventId, props.occurredAt, {
      reportId: report.id,
      reportType: report.type,
      attempt: report.attempts
    });
  }

  markReportIssued(props: {
    reportId: string;
    reportNumber: string;
    actorId: string;
    occurredAt: Date;
    eventId: string;
    evidence: FiscalOperationEvidence;
  }): void {
    const report = this.report(props.reportId);
    if (report.status !== 'PRINTING' && report.status !== 'ERROR' &&
      report.status !== 'RETRYING') {
      throw new DomainError('FISCAL_REPORT_INVALID_STATE', 'Fiscal report cannot be marked issued.');
    }
    FiscalDay.assertCommittedEvidence(props.evidence);
    const from = report.status;
    report.status = 'ISSUED';
    report.reportNumber = FiscalDay.text(
      props.reportNumber, 'FISCAL_REPORT_NUMBER_REQUIRED', 'Fiscal report number is required.'
    );
    report.lastErrorCode = null;
    report.lastEvidence = cloneFiscalOperationEvidence(props.evidence);
    report.retryable = false;
    if (report.type === 'Z') this.currentState = 'DAY_CLOSED';
    this.transitionReport(report, from, 'ISSUED', props, null, report.lastEvidence);
    this.event(
      report.type === 'X' ? 'FiscalXReportIssued' : 'FiscalZReportIssued',
      props.eventId,
      props.occurredAt,
      { reportId: report.id, reportNumber: report.reportNumber, evidence: report.lastEvidence }
    );
  }

  recordReportError(props: {
    reportId: string;
    code: string;
    evidence: FiscalOperationEvidence;
    retryable: boolean;
    actorId: string;
    occurredAt: Date;
    eventId: string;
  }): void {
    const report = this.report(props.reportId);
    if (report.status !== 'PRINTING') {
      throw new DomainError('FISCAL_REPORT_INVALID_STATE', 'Fiscal report is not printing.');
    }
    FiscalDay.assertFailureEvidence(props.evidence);
    const from = report.status;
    report.status = 'ERROR';
    report.lastErrorCode = FiscalDay.text(
      props.code, 'FISCAL_ERROR_CODE_REQUIRED', 'Fiscal error code is required.'
    );
    report.lastEvidence = cloneFiscalOperationEvidence(props.evidence);
    report.retryable = props.retryable;
    this.transitionReport(
      report, from, report.status, props, report.lastErrorCode, report.lastEvidence
    );
    this.event(
      'FiscalReportErrorRecorded',
      props.eventId,
      props.occurredAt,
      { reportId: report.id, errorCode: report.lastErrorCode, evidence: report.lastEvidence }
    );
  }

  markReportFailed(props: {
    reportId: string;
    actorId: string;
    occurredAt: Date;
    eventId: string;
  }): void {
    const report = this.report(props.reportId);
    if (report.status !== 'ERROR' && report.status !== 'RETRYING') {
      throw new DomainError(
        'FISCAL_REPORT_INVALID_STATE',
        'Fiscal report cannot be marked failed.'
      );
    }
    if (report.lastEvidence === null ||
      !isFiscalOperationTerminalFailureSafe(report.lastEvidence)) {
      throw new DomainError(
        'FISCAL_TERMINAL_FAILURE_EVIDENCE_REQUIRED',
        'Terminal failure requires authoritative no-commit evidence.'
      );
    }
    const from = report.status;
    report.status = 'FAILED';
    report.retryable = false;
    this.transitionReport(
      report, from, 'FAILED', props, report.lastErrorCode, report.lastEvidence
    );
    this.event('FiscalReportFailed', props.eventId, props.occurredAt, {
      reportId: report.id,
      errorCode: report.lastErrorCode,
      evidence: report.lastEvidence
    });
  }

  retryReport(props: {
    reportId: string;
    actorId: string;
    occurredAt: Date;
    eventId: string;
  }): void {
    const report = this.report(props.reportId);
    if (report.status !== 'ERROR' || !report.retryable || report.lastEvidence === null ||
      !isFiscalOperationRetrySafe(report.lastEvidence)) {
      throw new DomainError(
        'FISCAL_REPORT_RECONCILIATION_REQUIRED',
        'Fiscal report cannot retry without confirmed device state.'
      );
    }
    report.status = 'RETRYING';
    this.transitionReport(
      report, 'ERROR', 'RETRYING', props, report.lastErrorCode, report.lastEvidence
    );
    this.event('FiscalReportRetrying', props.eventId, props.occurredAt, {
      reportId: report.id
    });
  }

  private transitionReport(
    report: MutableFiscalReport,
    from: FiscalReportState | null,
    to: FiscalReportState,
    props: { actorId: string; occurredAt: Date; eventId: string },
    errorCode: string | null,
    evidence: FiscalOperationEvidence | null
  ): void {
    this.currentVersion += 1;
    const transitions = [...report.transitions, {
      eventId: FiscalDay.text(props.eventId, 'FISCAL_EVENT_ID_REQUIRED', 'Fiscal event ID is required.'),
      version: this.currentVersion,
      from,
      to,
      actorId: FiscalDay.text(props.actorId, 'FISCAL_ACTOR_REQUIRED', 'Fiscal actor is required.'),
      occurredAt: FiscalDay.date(props.occurredAt),
      errorCode,
      evidence: evidence === null ? null : cloneFiscalOperationEvidence(evidence)
    }];
    report.transitions = transitions;
  }

  private event(
    type: FiscalDayEventType,
    eventId: string,
    occurredAt: Date,
    payload: Record<string, unknown>
  ): void {
    this.events.push({
      type,
      eventId: FiscalDay.text(eventId, 'FISCAL_EVENT_ID_REQUIRED', 'Fiscal event ID is required.'),
      aggregateId: this.id,
      aggregateType: 'FiscalDay',
      aggregateVersion: this.currentVersion,
      occurredAt: FiscalDay.date(occurredAt),
      payload
    });
  }

  private report(id: string): MutableFiscalReport {
    const report = this.currentReports.find((candidate) => candidate.id === id.trim());
    if (!report) throw new DomainError('FISCAL_REPORT_NOT_FOUND', 'Fiscal report was not found.');
    if (report.status === 'ISSUED') {
      throw new DomainError('FISCAL_REPORT_ISSUED_IMMUTABLE', 'Issued fiscal reports are immutable.');
    }
    if (report.status === 'FAILED') {
      throw new DomainError('FISCAL_REPORT_FAILED', 'Failed fiscal reports require intervention.');
    }
    return report;
  }

  private static text(value: string, code: string, message: string): string {
    const normalized = value.trim();
    if (!normalized) throw new DomainError(code, message);
    return normalized;
  }

  private static date(value: Date): Date {
    if (Number.isNaN(value.getTime())) {
      throw new DomainError('FISCAL_TIMESTAMP_INVALID', 'Fiscal timestamp is invalid.');
    }
    return new Date(value);
  }

  private static assertCommittedEvidence(evidence: FiscalOperationEvidence): void {
    if (!isFiscalOperationCommitted(evidence)) {
      throw new DomainError(
        'FISCAL_COMMIT_EVIDENCE_REQUIRED',
        'Issued fiscal reports require positive fiscal commit evidence.'
      );
    }
  }

  private static assertFailureEvidence(evidence: FiscalOperationEvidence): void {
    if (!isFiscalOperationEvidenceCoherent(evidence) || evidence.printDelivery === 'COMPLETE') {
      throw new DomainError(
        'FISCAL_FAILURE_EVIDENCE_INVALID',
        'Fiscal report failure evidence is inconsistent.'
      );
    }
  }
}
