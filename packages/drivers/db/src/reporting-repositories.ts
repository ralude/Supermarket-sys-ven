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
  MarginReportEntryDto,
  MarginReportInput,
  MarginReportRepository,
  ResolvedReportQuery
} from '@supermarket/core';
import { Money, Quantity } from '@supermarket/shared';
import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import type { DatabaseHandle } from './connection.js';
import {
  auditLogs,
  cashMovements,
  fiscalDocuments,
  fiscalReports,
  saleItems,
  sales,
  shiftClosingBalances,
  shifts,
  stockItems,
  stockMovements
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

type MarginAggregate = {
  productId: string;
  currencyCode: string;
  quantityScaled: number;
  quantityScale: number;
  revenue: Money | null;
  cost: Money | null;
};

/**
 * Margen agregado por producto, moneda y período (ADR-0016). El costo se
 * toma de las salidas de venta (`SALE_ISSUE`) con costo congelado; el
 * ingreso, de las líneas de venta completadas. No se convierte moneda: un
 * producto vendido en más de una moneda produce una fila por moneda y solo
 * se resta cuando ambos lados coinciden en esa moneda.
 */
export class DrizzleMarginReportRepository implements MarginReportRepository {
  constructor(private readonly handle: DatabaseHandle) {}

  async findMargins(query: ResolvedReportQuery<MarginReportInput>): Promise<readonly MarginReportEntryDto[]> {
    const costRows = this.handle.db.select({
      productId: stockItems.productId,
      quantityScaled: stockMovements.quantityScaled,
      quantityScale: stockMovements.quantityScale,
      unitCostMinorUnits: stockMovements.unitCostMinorUnits,
      costCurrencyCode: stockMovements.costCurrencyCode
    }).from(stockMovements).innerJoin(stockItems, eq(stockMovements.stockItemId, stockItems.id))
      .where(every([
        eq(stockMovements.type, 'SALE_ISSUE'),
        query.from === undefined ? undefined : gte(stockMovements.occurredAt, query.from),
        query.to === undefined ? undefined : lte(stockMovements.occurredAt, query.to)
      ])).all();

    const revenueRows = this.handle.db.select({
      productId: saleItems.productId,
      priceMinorUnits: saleItems.priceMinorUnits,
      currencyCode: saleItems.currencyCode,
      quantityScaled: saleItems.quantityScaled,
      quantityScale: saleItems.quantityScale
    }).from(saleItems).innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(every([
        eq(sales.status, 'COMPLETED'),
        query.from === undefined ? undefined : gte(sales.completedAt, query.from.getTime()),
        query.to === undefined ? undefined : lte(sales.completedAt, query.to.getTime())
      ])).all();

    const aggregates = new Map<string, MarginAggregate>();
    const keyOf = (productId: string, currencyCode: string): string => `${productId}:${currencyCode}`;

    for (const row of costRows) {
      if (row.unitCostMinorUnits === null || row.costCurrencyCode === null) continue;
      const key = keyOf(row.productId, row.costCurrencyCode);
      const entry = aggregates.get(key) ?? {
        productId: row.productId, currencyCode: row.costCurrencyCode,
        quantityScaled: 0, quantityScale: row.quantityScale, revenue: null, cost: null
      };
      const lineCost = Money.fromMinorUnits(row.unitCostMinorUnits, row.costCurrencyCode)
        .multiplyByQuantity(Quantity.fromScaled(row.quantityScaled, row.quantityScale));
      entry.cost = (entry.cost ?? Money.zero(row.costCurrencyCode)).add(lineCost);
      entry.quantityScaled += row.quantityScaled;
      aggregates.set(key, entry);
    }
    for (const row of revenueRows) {
      const key = keyOf(row.productId, row.currencyCode);
      const entry = aggregates.get(key) ?? {
        productId: row.productId, currencyCode: row.currencyCode,
        quantityScaled: 0, quantityScale: row.quantityScale, revenue: null, cost: null
      };
      const lineRevenue = Money.fromMinorUnits(row.priceMinorUnits, row.currencyCode)
        .multiplyByQuantity(Quantity.fromScaled(row.quantityScaled, row.quantityScale));
      entry.revenue = (entry.revenue ?? Money.zero(row.currencyCode)).add(lineRevenue);
      aggregates.set(key, entry);
    }

    const entries: MarginReportEntryDto[] = [...aggregates.values()]
      .filter((entry) => query.currencyCode === undefined || entry.currencyCode === query.currencyCode)
      .map((entry) => ({
        productId: entry.productId,
        currencyCode: entry.currencyCode,
        quantitySoldScaled: entry.quantityScaled,
        quantityScale: entry.quantityScale,
        revenueMinorUnits: entry.revenue?.minorUnits ?? null,
        costMinorUnits: entry.cost?.minorUnits ?? null,
        marginMinorUnits: entry.revenue !== null && entry.cost !== null
          ? entry.revenue.subtract(entry.cost).minorUnits
          : null
      }))
      .sort((left, right) => left.productId.localeCompare(right.productId)
        || left.currencyCode.localeCompare(right.currencyCode));

    return entries.slice(0, query.limit);
  }
}
