import {
  ApplicationError,
  DomainError,
  err,
  ok,
  type AppError,
  type Result
} from '@supermarket/shared';
import { FiscalDocument } from '../../domain/fiscal/index.js';
import type { ExecutionContext } from '../execution-context.js';
import { persistBusinessChange } from '../events/index.js';
import type {
  AuditWriter,
  AuthorizationService,
  BusinessEventStore,
  Clock,
  FiscalDocumentRepository,
  FiscalPrinterPort,
  IdGenerator,
  OutboxStore,
  UnitOfWork
} from '../ports/index.js';
import type { FiscalDocumentDto, IssueFiscalDocumentInput } from './dtos.js';
import { toFiscalDocumentDto } from './mappers.js';
import { FISCAL_PERMISSIONS } from './permissions.js';

export class IssueFiscalDocument {
  constructor(
    private readonly repository: FiscalDocumentRepository,
    private readonly printer: FiscalPrinterPort,
    private readonly authorization: AuthorizationService,
    private readonly documentIdGenerator: IdGenerator,
    private readonly eventIdGenerator: IdGenerator,
    private readonly auditIdGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly unitOfWork: UnitOfWork,
    private readonly eventStore: BusinessEventStore,
    private readonly outboxStore: OutboxStore,
    private readonly auditWriter: AuditWriter
  ) {}

  async execute(
    input: IssueFiscalDocumentInput,
    context: ExecutionContext
  ): Promise<Result<FiscalDocumentDto, AppError>> {
    if (!(await this.authorization.authorize(context, FISCAL_PERMISSIONS.ISSUE_DOCUMENT))) {
      return err(new ApplicationError('FORBIDDEN', 'Actor is not authorized to issue fiscal documents.'));
    }
    const key = context.idempotencyKey?.trim();
    if (!key) {
      return err(new ApplicationError(
        'FISCAL_IDEMPOTENCY_KEY_REQUIRED',
        'Fiscal document issuance requires an idempotency key.'
      ));
    }
    const reason = input.reason.trim();
    if (!reason) {
      return err(new ApplicationError('FISCAL_REASON_REQUIRED', 'Fiscal operation reason is required.'));
    }
    const fingerprint = JSON.stringify(input);

    try {
      const prepared = await this.unitOfWork.execute(async () => {
        const existing = await this.repository.findByIdempotencyKey(context.originNodeId, key);
        if (existing) return { document: existing, created: false };
        const active = await this.repository.findActive();
        if (active) {
          return { error: new ApplicationError(
            'FISCAL_DEVICE_OPERATION_PENDING',
            'Another fiscal operation requires completion or reconciliation.'
          ) };
        }
        const now = this.clock.now();
        const document = FiscalDocument.create({
          id: this.documentIdGenerator.generate(),
          content: input.content,
          idempotencyKey: key,
          requestFingerprint: fingerprint,
          terminalId: context.terminalId,
          originNodeId: context.originNodeId,
          createdBy: context.actorId,
          createdAt: now,
          eventId: this.eventIdGenerator.generate()
        });
        await persistBusinessChange(
          () => this.repository.save(document),
          document.domainEvents,
          context,
          undefined,
          this.eventStore
        );
        return { document, created: true };
      });
      if ('error' in prepared) return err(prepared.error);
      const document = prepared.document;
      if (!prepared.created && document.requestFingerprint !== fingerprint) {
        return err(new ApplicationError(
          'IDEMPOTENCY_KEY_CONFLICT',
          'Idempotency key was already used with another request.'
        ));
      }
      if (document.status === 'ISSUED') return ok(toFiscalDocumentDto(document));
      if (document.status === 'PRINTING' || document.status === 'ERROR') {
        return err(new ApplicationError(
          'FISCAL_RECONCILIATION_REQUIRED',
          'Fiscal document state must be reconciled before another print attempt.'
        ));
      }
      if (document.status === 'FAILED') {
        return err(new ApplicationError(
          'FISCAL_DOCUMENT_FAILED',
          'Fiscal document requires intervention.'
        ));
      }

      let eventCursor = document.domainEvents.length;
      document.startPrinting({
        actorId: context.actorId,
        occurredAt: this.clock.now(),
        eventId: this.eventIdGenerator.generate()
      });
      await this.persist(document, eventCursor, context);

      const printed = document.content.type === 'INVOICE'
        ? await this.printer.printInvoice(document.content)
        : await this.printer.printCreditNote(document.content);
      eventCursor = document.domainEvents.length;
      if (printed.ok) {
        document.markIssued({
          fiscalNumber: printed.value.fiscalNumber,
          actorId: context.actorId,
          occurredAt: printed.value.confirmedAt,
          eventId: this.eventIdGenerator.generate()
        });
      } else {
        document.recordError({
          ...printed.error,
          actorId: context.actorId,
          occurredAt: this.clock.now(),
          eventId: this.eventIdGenerator.generate()
        });
        if (!printed.error.retryable) {
          document.markFailed({
            actorId: context.actorId,
            occurredAt: this.clock.now(),
            eventId: this.eventIdGenerator.generate()
          });
        }
      }
      const action = printed.ok
        ? 'FISCAL_DOCUMENT_ISSUED'
        : !printed.error.retryable
          ? 'FISCAL_DOCUMENT_FAILED'
          : 'FISCAL_DOCUMENT_ERROR_RECORDED';
      await this.persist(document, eventCursor, context, reason, action);
      if (!printed.ok) {
        return err(new ApplicationError(printed.error.code, printed.error.message));
      }
      return ok(toFiscalDocumentDto(document));
    } catch (error) {
      if (error instanceof DomainError) return err(error);
      throw error;
    }
  }

  private persist(
    document: FiscalDocument,
    eventCursor: number,
    context: ExecutionContext,
    reason?: string,
    action?: string
  ): Promise<void> {
    const events = document.domainEvents.slice(eventCursor);
    return persistBusinessChange(
      () => this.repository.save(document),
      events,
      context,
      this.unitOfWork,
      this.eventStore,
      this.outboxStore,
      ['FiscalDocumentIssued', 'FiscalDocumentFailed'],
      this.auditWriter,
      action && reason ? [{
        auditId: this.auditIdGenerator.generate(),
        actorId: context.actorId,
        actorRoleCodes: context.actorRoleCodes ?? [],
        action,
        entityType: 'FiscalDocument',
        entityId: document.id,
        before: null,
        after: {
          status: document.status,
          referenceId: document.content.referenceId,
          fiscalNumber: document.fiscalNumber,
          errorCode: document.lastErrorCode
        },
        reason,
        terminalId: context.terminalId,
        originNodeId: context.originNodeId,
        occurredAt: this.clock.now(),
        correlationId: context.correlationId
      }] : []
    );
  }
}
