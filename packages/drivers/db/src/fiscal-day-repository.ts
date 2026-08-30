import {
  FiscalDay,
  type FiscalDayRepository,
  type FiscalDayState,
  type FiscalDeliveryCertainty,
  type FiscalReport,
  type FiscalReportState,
  type FiscalReportType
} from '@supermarket/core';
import { InfrastructureError } from '@supermarket/shared';
import { and, eq, inArray } from 'drizzle-orm';
import type { DatabaseHandle } from './connection.js';
import { fiscalDays, fiscalReports, fiscalReportTransitions } from './schema.js';
import { mapDatabaseError, requireTransaction } from './unit-of-work.js';

export class DrizzleFiscalDayRepository implements FiscalDayRepository {
  constructor(private readonly handle: DatabaseHandle) {}

  async save(day: FiscalDay): Promise<void> {
    requireTransaction(this.handle.sqlite);
    try {
      const existing = this.handle.db.select().from(fiscalDays)
        .where(eq(fiscalDays.id, day.id)).get();
      if (!existing) {
        this.handle.db.insert(fiscalDays).values({
          id: day.id,
          businessDate: day.businessDate,
          terminalId: day.terminalId,
          originNodeId: day.originNodeId,
          openedBy: day.openedBy,
          openedAt: day.openedAt,
          state: day.state,
          version: day.version
        }).run();
      } else {
        if (existing.businessDate !== day.businessDate ||
          existing.terminalId !== day.terminalId ||
          existing.originNodeId !== day.originNodeId) {
          throw new InfrastructureError(
            'FISCAL_DAY_IDENTITY_CONFLICT', 'Fiscal day identity cannot be changed.'
          );
        }
        if (day.version <= existing.version) {
          throw new InfrastructureError(
            'DATABASE_CONCURRENCY_CONFLICT', 'Fiscal day version is stale.'
          );
        }
        this.handle.db.update(fiscalDays).set({
          state: day.state,
          version: day.version
        }).where(eq(fiscalDays.id, day.id)).run();
      }

      for (const report of day.reports) {
        const row = this.handle.db.select().from(fiscalReports)
          .where(eq(fiscalReports.id, report.id)).get();
        if (!row) {
          this.handle.db.insert(fiscalReports).values(this.reportValues(day, report)).run();
        } else if (row.status !== 'ISSUED') {
          this.handle.db.update(fiscalReports).set({
            status: report.status,
            attempts: report.attempts,
            reportNumber: report.reportNumber,
            lastErrorCode: report.lastErrorCode,
            lastCertainty: report.lastCertainty,
            retryable: report.retryable
          }).where(eq(fiscalReports.id, report.id)).run();
        }
      }

      const persisted = new Set(this.handle.db.select({ eventId: fiscalReportTransitions.eventId })
        .from(fiscalReportTransitions).where(eq(fiscalReportTransitions.dayId, day.id)).all()
        .map(({ eventId }) => eventId));
      const transitions = day.reports.flatMap((report) => report.transitions.map((transition) => ({
        reportId: report.id,
        transition
      }))).filter(({ transition }) => !persisted.has(transition.eventId));
      if (transitions.length > 0) {
        this.handle.db.insert(fiscalReportTransitions).values(transitions.map(({ reportId, transition }) => ({
          eventId: transition.eventId,
          dayId: day.id,
          reportId,
          aggregateVersion: transition.version,
          fromStatus: transition.from,
          toStatus: transition.to,
          actorId: transition.actorId,
          occurredAt: transition.occurredAt,
          errorCode: transition.errorCode,
          certainty: transition.certainty
        }))).run();
      }
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  findById(id: string): Promise<FiscalDay | null> {
    return this.read(() => this.restore(this.handle.db.select().from(fiscalDays)
      .where(eq(fiscalDays.id, id)).get()));
  }

  findOpenByTerminal(terminalId: string): Promise<FiscalDay | null> {
    return this.read(() => this.restore(this.handle.db.select().from(fiscalDays).where(and(
      eq(fiscalDays.terminalId, terminalId),
      inArray(fiscalDays.state, ['DAY_OPEN', 'Z_PENDING'])
    )).get()));
  }

  findByReportIdempotencyKey(originNodeId: string, key: string): Promise<FiscalDay | null> {
    return this.read(() => {
      const report = this.handle.db.select({ dayId: fiscalReports.dayId }).from(fiscalReports)
        .where(and(
          eq(fiscalReports.originNodeId, originNodeId),
          eq(fiscalReports.idempotencyKey, key)
        )).get();
      return report ? this.restore(this.handle.db.select().from(fiscalDays)
        .where(eq(fiscalDays.id, report.dayId)).get()) : null;
    });
  }

  private restore(row: typeof fiscalDays.$inferSelect | undefined): FiscalDay | null {
    if (!row) return null;
    const reportRows = this.handle.db.select().from(fiscalReports)
      .where(eq(fiscalReports.dayId, row.id)).orderBy(fiscalReports.requestedAt).all();
    const transitionRows = this.handle.db.select().from(fiscalReportTransitions)
      .where(eq(fiscalReportTransitions.dayId, row.id))
      .orderBy(fiscalReportTransitions.aggregateVersion).all();
    return FiscalDay.restore({
      id: row.id,
      businessDate: row.businessDate,
      terminalId: row.terminalId,
      originNodeId: row.originNodeId,
      openedBy: row.openedBy,
      openedAt: row.openedAt,
      state: row.state as FiscalDayState,
      version: row.version,
      reports: reportRows.map((report): FiscalReport => ({
        id: report.id,
        type: report.reportType as FiscalReportType,
        idempotencyKey: report.idempotencyKey,
        requestFingerprint: report.requestFingerprint,
        status: report.status as FiscalReportState,
        attempts: report.attempts,
        reportNumber: report.reportNumber,
        lastErrorCode: report.lastErrorCode,
        lastCertainty: report.lastCertainty as FiscalDeliveryCertainty | null,
        retryable: report.retryable,
        requestedBy: report.requestedBy,
        requestedAt: report.requestedAt,
        transitions: transitionRows.filter(({ reportId }) => reportId === report.id)
          .map((transition) => ({
            eventId: transition.eventId,
            version: transition.aggregateVersion,
            from: transition.fromStatus as FiscalReportState | null,
            to: transition.toStatus as FiscalReportState,
            actorId: transition.actorId,
            occurredAt: transition.occurredAt,
            errorCode: transition.errorCode,
            certainty: transition.certainty as FiscalDeliveryCertainty | null
          }))
      }))
    });
  }

  private reportValues(
    day: FiscalDay,
    report: FiscalReport
  ): typeof fiscalReports.$inferInsert {
    return {
      id: report.id,
      dayId: day.id,
      originNodeId: day.originNodeId,
      reportType: report.type,
      idempotencyKey: report.idempotencyKey,
      requestFingerprint: report.requestFingerprint,
      status: report.status,
      attempts: report.attempts,
      reportNumber: report.reportNumber,
      lastErrorCode: report.lastErrorCode,
      lastCertainty: report.lastCertainty,
      retryable: report.retryable,
      requestedBy: report.requestedBy,
      requestedAt: report.requestedAt
    };
  }

  private async read<T>(operation: () => T): Promise<T> {
    try { return operation(); } catch (error) { throw mapDatabaseError(error); }
  }
}
