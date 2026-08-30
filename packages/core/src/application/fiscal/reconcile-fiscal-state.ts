import {
  ApplicationError,
  DomainError,
  err,
  ok,
  type AppError,
  type Result
} from '@supermarket/shared';
import type { FiscalDocument } from '../../domain/fiscal/index.js';
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
import type { FiscalDocumentDto, ReconcileFiscalStateInput } from './dtos.js';
import { toFiscalDocumentDto } from './mappers.js';
import { FISCAL_PERMISSIONS } from './permissions.js';

export class ReconcileFiscalState {
  constructor(
    private readonly repository: FiscalDocumentRepository,
    private readonly printer: FiscalPrinterPort,
    private readonly authorization: AuthorizationService,
    private readonly eventIdGenerator: IdGenerator,
    private readonly auditIdGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly unitOfWork: UnitOfWork,
    private readonly eventStore: BusinessEventStore,
    private readonly outboxStore: OutboxStore,
    private readonly auditWriter: AuditWriter
  ) {}

  async execute(
    input: ReconcileFiscalStateInput,
    context: ExecutionContext
  ): Promise<Result<FiscalDocumentDto, AppError>> {
    if (!(await this.authorization.authorize(context, FISCAL_PERMISSIONS.RECONCILE))) {
      return err(new ApplicationError('FORBIDDEN', 'Actor is not authorized to reconcile fiscal state.'));
    }
    const reason = input.reason.trim();
    if (!reason) return err(new ApplicationError('FISCAL_REASON_REQUIRED', 'Fiscal operation reason is required.'));
    try {
      const document = await this.repository.findById(input.documentId);
      if (!document) return err(new ApplicationError('FISCAL_DOCUMENT_NOT_FOUND', 'Fiscal document was not found.'));
      if (document.status === 'ISSUED') return ok(toFiscalDocumentDto(document));
      if (document.status === 'FAILED') {
        return err(new ApplicationError('FISCAL_DOCUMENT_FAILED', 'Fiscal document requires intervention.'));
      }

      const status = await this.printer.getStatus();
      if (!status.ok) return err(new ApplicationError(status.error.code, status.error.message));
      let cursor = document.domainEvents.length;
      if (status.value.lastDocumentReferenceId === document.content.referenceId &&
        status.value.lastDocumentNumber) {
        document.markIssued({
          fiscalNumber: status.value.lastDocumentNumber,
          actorId: context.actorId,
          occurredAt: this.clock.now(),
          eventId: this.eventIdGenerator.generate()
        });
        await this.persist(document, cursor, context, reason, 'FISCAL_DOCUMENT_RECONCILED');
        return ok(toFiscalDocumentDto(document));
      }

      if (document.status === 'PRINTING') {
        document.recordError({
          code: 'FISCAL_DOCUMENT_NOT_CONFIRMED',
          certainty: 'NOT_SENT',
          retryable: true,
          actorId: context.actorId,
          occurredAt: this.clock.now(),
          eventId: this.eventIdGenerator.generate()
        });
        await this.persist(document, cursor, context);
      }
      if (document.status === 'ERROR') {
        cursor = document.domainEvents.length;
        if (!document.lastFailureRetryable) {
          document.markFailed({
            actorId: context.actorId,
            occurredAt: this.clock.now(),
            eventId: this.eventIdGenerator.generate()
          });
          await this.persist(document, cursor, context, reason, 'FISCAL_DOCUMENT_FAILED');
          return err(new ApplicationError('FISCAL_DOCUMENT_FAILED', 'Fiscal document requires intervention.'));
        }
        document.beginRetry({
          confirmedNotIssued: true,
          actorId: context.actorId,
          occurredAt: this.clock.now(),
          eventId: this.eventIdGenerator.generate()
        });
        await this.persist(document, cursor, context);
      }

      cursor = document.domainEvents.length;
      document.startPrinting({
        actorId: context.actorId,
        occurredAt: this.clock.now(),
        eventId: this.eventIdGenerator.generate()
      });
      await this.persist(document, cursor, context);
      const printed = document.content.type === 'INVOICE'
        ? await this.printer.printInvoice(document.content)
        : await this.printer.printCreditNote(document.content);
      cursor = document.domainEvents.length;
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
      await this.persist(
        document,
        cursor,
        context,
        reason,
        printed.ok ? 'FISCAL_DOCUMENT_RECONCILED' : 'FISCAL_DOCUMENT_FAILED'
      );
      if (!printed.ok) return err(new ApplicationError(printed.error.code, printed.error.message));
      return ok(toFiscalDocumentDto(document));
    } catch (error) {
      if (error instanceof DomainError) return err(error);
      throw error;
    }
  }

  private persist(
    document: FiscalDocument,
    cursor: number,
    context: ExecutionContext,
    reason?: string,
    action?: string
  ): Promise<void> {
    return persistBusinessChange(
      () => this.repository.save(document),
      document.domainEvents.slice(cursor),
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
