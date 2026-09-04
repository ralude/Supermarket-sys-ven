import type {
  AuditReportEntryDto,
  AuditReportInput,
  AuditReportRepository,
  CashClosureBalanceDto,
  CashClosureReportEntryDto,
  CashClosureReportInput,
  CashClosureReportRepository,
  FiscalOperationReportEntryDto,
  FiscalOperationsReportInput,
  FiscalOperationsReportRepository,
  ResolvedReportQuery
} from '@supermarket/core';
import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import type { DatabaseHandle } from './connection.js';
import {
  auditLogs,
  cashMovements,
  fiscalDocuments,
  fiscalReports,
  shiftClosingBalances,
  shifts
} from './schema.js';

const EVIDENCE_AXES = [
  'lastDispatchState', 'lastCommandEffect', 'lastFiscalCommit', 'lastPrintDelivery'
] as const;

const evidenceOf = (row: Readonly<Record<string, unknown>>): Readonly<Record<string, string>> | null => {
  const entries: [string, string][] = [];
  for (const axis of EVIDENCE_AXES) {
    const value = row[axis];
    if (typeof value === 'string') entries.push([axis, value]);
  }
  return entries.length === 0 ? null : Object.fromEntries(entries);
};

const roleCodesOf = (value: string): readonly string[] => {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((code): code is string => typeof code === 'string') : [];
  } catch {
    return [];
  }
};

const every = (conditions: readonly (SQL | undefined)[]): SQL | undefined => {
  const present = conditions.filter((condition): condition is SQL => condition !== undefined);
  return present.length === 0 ? undefined : and(...present);
};

export class DrizzleCashClosureReportRepository implements CashClosureReportRepository {
  constructor(private readonly handle: DatabaseHandle) {}

  async findCashClosures(
    query: ResolvedReportQuery<CashClosureReportInput>
  ): Promise<readonly CashClosureReportEntryDto[]> {
    const occurredAt = sql<number>`coalesce(${shifts.closedAt}, ${shifts.openedAt})`;
    const rows = this.handle.db.select().from(shifts).where(every([
      query.from === undefined ? undefined : gte(occurredAt, query.from.getTime()),
      query.to === undefined ? undefined : lte(occurredAt, query.to.getTime()),
      query.cashRegisterId === undefined
        ? undefined
        : eq(shifts.cashRegisterId, query.cashRegisterId)
    ])).orderBy(desc(occurredAt)).limit(query.limit).all();

    return rows.map((row) => ({
      shiftId: row.id,
      cashRegisterId: row.cashRegisterId,
      terminalId: row.terminalId,
      originNodeId: row.originNodeId,
      openedBy: row.openedBy,
      openedAt: new Date(row.openedAt),
      closedBy: row.closedBy,
      closedAt: row.closedAt === null ? null : new Date(row.closedAt),
      movementCount: this.handle.db.select({ total: sql<number>`count(*)` })
        .from(cashMovements).where(eq(cashMovements.shiftId, row.id)).get()?.total ?? 0,
      balances: this.handle.db.select().from(shiftClosingBalances)
        .where(eq(shiftClosingBalances.shiftId, row.id)).all()
        .map((balance): CashClosureBalanceDto => ({
          paymentMethodCode: balance.paymentMethodCode,
          currencyCode: balance.currencyCode,
          expectedMinorUnits: balance.expectedMinorUnits,
          declaredMinorUnits: balance.declaredMinorUnits,
          differenceMinorUnits: balance.differenceMinorUnits
        }))
    }));
  }
}

export class DrizzleAuditReportRepository implements AuditReportRepository {
  constructor(private readonly handle: DatabaseHandle) {}

  async findAuditEntries(
    query: ResolvedReportQuery<AuditReportInput>
  ): Promise<readonly AuditReportEntryDto[]> {
    const rows = this.handle.db.select({
      auditId: auditLogs.auditId,
      actorId: auditLogs.actorId,
      actorRoleCodes: auditLogs.actorRoleCodes,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      reason: auditLogs.reason,
      terminalId: auditLogs.terminalId,
      originNodeId: auditLogs.originNodeId,
      occurredAt: auditLogs.occurredAt,
      correlationId: auditLogs.correlationId
    }).from(auditLogs).where(every([
      query.from === undefined ? undefined : gte(auditLogs.occurredAt, query.from.getTime()),
      query.to === undefined ? undefined : lte(auditLogs.occurredAt, query.to.getTime()),
      query.actorId === undefined ? undefined : eq(auditLogs.actorId, query.actorId),
      query.action === undefined ? undefined : eq(auditLogs.action, query.action),
      query.entityType === undefined ? undefined : eq(auditLogs.entityType, query.entityType)
    ])).orderBy(desc(auditLogs.occurredAt), desc(auditLogs.auditId)).limit(query.limit).all();

    return rows.map((row) => ({
      ...row,
      actorRoleCodes: roleCodesOf(row.actorRoleCodes),
      occurredAt: new Date(row.occurredAt)
    }));
  }
}

export class DrizzleFiscalOperationsReportRepository implements FiscalOperationsReportRepository {
  constructor(private readonly handle: DatabaseHandle) {}

  async findFiscalOperations(
    query: ResolvedReportQuery<FiscalOperationsReportInput>
  ): Promise<readonly FiscalOperationReportEntryDto[]> {
    const documents = this.handle.db.select().from(fiscalDocuments).where(every([
      query.from === undefined ? undefined : gte(fiscalDocuments.createdAt, query.from),
      query.to === undefined ? undefined : lte(fiscalDocuments.createdAt, query.to)
    ])).orderBy(desc(fiscalDocuments.createdAt)).limit(query.limit).all()
      .map((row): FiscalOperationReportEntryDto => ({
        kind: 'DOCUMENT',
        id: row.id,
        referenceId: row.referenceId,
        dayId: null,
        operationType: row.documentType,
        status: row.status,
        attempts: row.attempts,
        fiscalNumber: row.fiscalNumber,
        lastErrorCode: row.lastErrorCode,
        evidence: evidenceOf(row),
        requestedAt: row.createdAt
      }));

    const reports = this.handle.db.select().from(fiscalReports).where(every([
      query.from === undefined ? undefined : gte(fiscalReports.requestedAt, query.from),
      query.to === undefined ? undefined : lte(fiscalReports.requestedAt, query.to)
    ])).orderBy(desc(fiscalReports.requestedAt)).limit(query.limit).all()
      .map((row): FiscalOperationReportEntryDto => ({
        kind: 'REPORT',
        id: row.id,
        referenceId: null,
        dayId: row.dayId,
        operationType: row.reportType,
        status: row.status,
        attempts: row.attempts,
        fiscalNumber: row.reportNumber,
        lastErrorCode: row.lastErrorCode,
        evidence: evidenceOf(row),
        requestedAt: row.requestedAt
      }));

    return [...documents, ...reports]
      .sort((left, right) => right.requestedAt.getTime() - left.requestedAt.getTime()
        || left.id.localeCompare(right.id))
      .slice(0, query.limit);
  }
}
