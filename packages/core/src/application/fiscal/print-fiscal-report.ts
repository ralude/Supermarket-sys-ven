import {
  ApplicationError,
  DomainError,
  err,
  ok,
  type AppError,
  type Result
} from '@supermarket/shared';
import { FiscalDay, type FiscalReportType } from '../../domain/fiscal/index.js';
import type { ExecutionContext } from '../execution-context.js';
import { persistBusinessChange } from '../events/index.js';
import type {
  AuditWriter,
  AuthorizationService,
  BusinessEventStore,
  Clock,
  FiscalDayRepository,
  FiscalPrinterPort,
  IdGenerator,
  OutboxStore,
  UnitOfWork
} from '../ports/index.js';
import type { FiscalReportDto, PrintFiscalReportInput } from './dtos.js';
import { FISCAL_PERMISSIONS } from './permissions.js';

export class PrintFiscalReport {
  constructor(
    private readonly type: FiscalReportType,
    private readonly repository: FiscalDayRepository,
    private readonly printer: FiscalPrinterPort,
    private readonly authorization: AuthorizationService,
    private readonly idGenerator: IdGenerator,
    private readonly eventIdGenerator: IdGenerator,
    private readonly auditIdGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly unitOfWork: UnitOfWork,
    private readonly eventStore: BusinessEventStore,
    private readonly outboxStore: OutboxStore,
    private readonly auditWriter: AuditWriter
  ) {}

  async execute(
    input: PrintFiscalReportInput,
    context: ExecutionContext
  ): Promise<Result<FiscalReportDto, AppError>> {
    const permission = this.type === 'X'
      ? FISCAL_PERMISSIONS.PRINT_X_REPORT
      : FISCAL_PERMISSIONS.PRINT_Z_REPORT;
    if (!(await this.authorization.authorize(context, permission))) {
      return err(new ApplicationError('FORBIDDEN', 'Actor is not authorized to print fiscal reports.'));
    }
    const key = context.idempotencyKey?.trim();
    if (!key) return err(new ApplicationError(
      'FISCAL_IDEMPOTENCY_KEY_REQUIRED', 'Fiscal report requires an idempotency key.'
    ));
    const reason = input.reason.trim();
    if (!reason) return err(new ApplicationError('FISCAL_REASON_REQUIRED', 'Fiscal operation reason is required.'));
    const fingerprint = JSON.stringify({ type: this.type, input });

    try {
      const prepared = await this.unitOfWork.execute(async () => {
        const replayDay = await this.repository.findByReportIdempotencyKey(
          context.originNodeId, key
        );
        if (replayDay) return { day: replayDay, created: false };
        let day = await this.repository.findById(input.dayId);
        const cursor = day?.domainEvents.length ?? 0;
        if (!day) {
          const open = await this.repository.findOpenByTerminal(context.terminalId);
          if (open) return { error: new ApplicationError(
            'FISCAL_DAY_ALREADY_OPEN', 'Another fiscal day is already open for this terminal.'
          ) };
          day = FiscalDay.open({
            id: input.dayId,
            businessDate: input.businessDate,
            terminalId: context.terminalId,
            originNodeId: context.originNodeId,
            openedBy: context.actorId,
            openedAt: this.clock.now(),
            eventId: this.eventIdGenerator.generate()
          });
        }
        day.requestReport({
          id: this.idGenerator.generate(),
          type: this.type,
          idempotencyKey: key,
          requestFingerprint: fingerprint,
          actorId: context.actorId,
          occurredAt: this.clock.now(),
          eventId: this.eventIdGenerator.generate()
        });
        await persistBusinessChange(
          () => this.repository.save(day),
          day.domainEvents.slice(cursor),
          context,
          undefined,
          this.eventStore
        );
        return { day, created: true };
      });
      if ('error' in prepared) return err(prepared.error);
      const day = prepared.day;
      const report = prepared.created
        ? day.reports.at(-1)
        : day.reports.find(({ idempotencyKey }) => idempotencyKey === key);
      if (!report) return err(new ApplicationError('FISCAL_REPORT_NOT_FOUND', 'Fiscal report was not found.'));
      if (!prepared.created && report.requestFingerprint !== fingerprint) {
        return err(new ApplicationError(
          'IDEMPOTENCY_KEY_CONFLICT', 'Idempotency key was already used with another request.'
        ));
      }
      if (report.status === 'ISSUED') return ok(this.toDto(day, report.id));
      if (report.status === 'PRINTING' || report.status === 'ERROR') {
        return err(new ApplicationError(
          'FISCAL_RECONCILIATION_REQUIRED',
          'Fiscal report state must be reconciled before another print attempt.'
        ));
      }
      if (report.status === 'FAILED') {
        return err(new ApplicationError('FISCAL_REPORT_FAILED', 'Fiscal report requires intervention.'));
      }

      let cursor = day.domainEvents.length;
      day.startReport({
        reportId: report.id,
        actorId: context.actorId,
        occurredAt: this.clock.now(),
        eventId: this.eventIdGenerator.generate()
      });
      await this.persist(day, cursor, context);
      const printed = this.type === 'X'
        ? await this.printer.printXReport()
        : await this.printer.printZReport();
      cursor = day.domainEvents.length;
      if (printed.ok) {
        day.markReportIssued({
          reportId: report.id,
          reportNumber: printed.value.reportNumber,
          evidence: printed.value.evidence,
          actorId: context.actorId,
          occurredAt: printed.value.confirmedAt,
          eventId: this.eventIdGenerator.generate()
        });
      } else {
        day.recordReportError({
          reportId: report.id,
          ...printed.error,
          actorId: context.actorId,
          occurredAt: this.clock.now(),
          eventId: this.eventIdGenerator.generate()
        });
      }
      const action = printed.ok
        ? `FISCAL_${this.type}_REPORT_ISSUED`
        : 'FISCAL_REPORT_ERROR_RECORDED';
      await this.persist(day, cursor, context, reason, action);
      if (!printed.ok) return err(new ApplicationError(printed.error.code, printed.error.message));
      return ok(this.toDto(day, report.id));
    } catch (error) {
      if (error instanceof DomainError) return err(error);
      throw error;
    }
  }

  private persist(
    day: FiscalDay,
    cursor: number,
    context: ExecutionContext,
    reason?: string,
    action?: string
  ): Promise<void> {
    return persistBusinessChange(
      () => this.repository.save(day),
      day.domainEvents.slice(cursor),
      context,
      this.unitOfWork,
      this.eventStore,
      this.outboxStore,
      ['FiscalXReportIssued', 'FiscalZReportIssued'],
      this.auditWriter,
      action && reason ? [{
        auditId: this.auditIdGenerator.generate(),
        actorId: context.actorId,
        actorRoleCodes: context.actorRoleCodes ?? [],
        action,
        entityType: 'FiscalDay',
        entityId: day.id,
        before: null,
        after: { state: day.state, report: this.toDto(day, day.reports.at(-1)?.id ?? '') },
        reason,
        terminalId: context.terminalId,
        originNodeId: context.originNodeId,
        occurredAt: this.clock.now(),
        correlationId: context.correlationId
      }] : []
    );
  }

  private toDto(day: FiscalDay, reportId: string): FiscalReportDto {
    const report = day.reports.find(({ id }) => id === reportId);
    if (!report) throw new DomainError('FISCAL_REPORT_NOT_FOUND', 'Fiscal report was not found.');
    return {
      dayId: day.id,
      dayState: day.state,
      id: report.id,
      type: report.type,
      status: report.status,
      attempts: report.attempts,
      reportNumber: report.reportNumber,
      lastErrorCode: report.lastErrorCode,
      lastEvidence: report.lastEvidence
    };
  }
}
