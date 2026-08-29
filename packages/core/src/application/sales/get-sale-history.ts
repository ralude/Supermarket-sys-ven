import { ApplicationError, err, ok, type AppError, type Result } from '@supermarket/shared';
import type { JsonValue } from '../events/index.js';
import type { BusinessEventStore } from '../ports/index.js';

export type SaleHistoryVersion = {
  readonly version: number;
  readonly eventType: string;
  readonly occurredAt: Date;
  readonly actorId: string;
  readonly status: 'DRAFT' | 'COMPLETED' | 'VOIDED';
  readonly itemIds: readonly string[];
  readonly discountTotalMinorUnits: number;
  readonly paymentTotalMinorUnits: number;
  readonly totalMinorUnits: number | null;
};

const record = (value: JsonValue): Record<string, JsonValue> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};

const text = (value: JsonValue | undefined): string | null =>
  typeof value === 'string' ? value : null;

const minorUnits = (value: JsonValue | undefined): number => {
  const amount = value === undefined ? {} : record(value);
  return typeof amount.minorUnits === 'number' ? amount.minorUnits : 0;
};

export class GetSaleHistory {
  constructor(private readonly events: BusinessEventStore) {}

  async execute(saleId: string): Promise<Result<readonly SaleHistoryVersion[], AppError>> {
    const events = await this.events.findByAggregate('Sale', saleId);
    if (events.length === 0) {
      return err(new ApplicationError('SALE_HISTORY_NOT_FOUND', 'Sale history was not found.'));
    }

    let status: SaleHistoryVersion['status'] = 'DRAFT';
    const itemIds = new Set<string>();
    let discountTotalMinorUnits = 0;
    let paymentTotalMinorUnits = 0;
    let totalMinorUnits: number | null = null;
    const history: SaleHistoryVersion[] = [];

    for (const event of events) {
      const payload = record(event.payload);
      if (event.eventType === 'SaleItemAdded') {
        const itemId = text(payload.itemId);
        if (itemId) itemIds.add(itemId);
      } else if (event.eventType === 'SaleItemRemoved') {
        const itemId = text(payload.itemId);
        if (itemId) itemIds.delete(itemId);
      } else if (event.eventType === 'DiscountApplied') {
        discountTotalMinorUnits += minorUnits(payload.amount);
      } else if (event.eventType === 'PaymentRegistered') {
        paymentTotalMinorUnits += minorUnits(payload.amountInSaleCurrency);
      } else if (event.eventType === 'SaleCompleted') {
        status = 'COMPLETED';
        totalMinorUnits = minorUnits(payload.total);
      } else if (event.eventType === 'SaleVoided') {
        status = 'VOIDED';
      }
      history.push({
        version: event.aggregateVersion,
        eventType: event.eventType,
        occurredAt: new Date(event.occurredAt),
        actorId: event.actorId,
        status,
        itemIds: [...itemIds],
        discountTotalMinorUnits,
        paymentTotalMinorUnits,
        totalMinorUnits
      });
    }
    return ok(history);
  }
}
