import { describe, expect, it } from 'vitest';
import { Quantity } from '@supermarket/shared';
import { StockItem } from './stock-item.js';

const timestamp = new Date('2026-08-17T10:00:00.000Z');

function stockItem(tracksBatches = false): StockItem {
  return StockItem.create({
    id: 'stock-001',
    productId: 'product-001',
    unitCode: 'unit',
    quantityScale: 0,
    tracksBatches
  });
}

function movement(
  type: 'PURCHASE_RECEIPT' | 'SALE_ISSUE' | 'WASTE' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT',
  scaledValue: number,
  overrides: Partial<Parameters<StockItem['registerMovement']>[0]> = {}
): Parameters<StockItem['registerMovement']>[0] {
  return {
    id: `movement-${type}-${scaledValue}`,
    type,
    quantity: Quantity.fromScaled(scaledValue, 0),
    actorId: 'user-001',
    reason: 'Operational movement',
    referenceId: 'reference-001',
    occurredAt: timestamp,
    eventId: `event-${type}-${scaledValue}`,
    ...overrides
  };
}

describe('StockItem', () => {
  it('starts at zero and increases stock only through a purchase movement', () => {
    const item = stockItem();

    const registered = item.registerMovement(movement('PURCHASE_RECEIPT', 10));

    expect(item.balance).toEqual(Quantity.fromScaled(10, 0));
    expect(registered.direction).toBe('IN');
    expect(registered.actorId).toBe('user-001');
    expect(registered.referenceId).toBe('reference-001');
  });

  it('applies sale, waste and both explicit adjustment directions', () => {
    const item = stockItem();
    item.registerMovement(movement('PURCHASE_RECEIPT', 20));
    item.registerMovement(movement('SALE_ISSUE', 4));
    item.registerMovement(movement('WASTE', 2));
    item.registerMovement(movement('ADJUSTMENT_IN', 3));
    item.registerMovement(movement('ADJUSTMENT_OUT', 1));

    expect(item.balance).toEqual(Quantity.fromScaled(16, 0));
    expect(item.movements.map(({ direction }) => direction)).toEqual(['IN', 'OUT', 'OUT', 'IN', 'OUT']);
  });

  it('rejects an outbound movement that would make stock negative', () => {
    const item = stockItem();
    item.registerMovement(movement('PURCHASE_RECEIPT', 5));

    expect(() => item.registerMovement(movement('SALE_ISSUE', 6)))
      .toThrowError('Stock movement exceeds the available balance.');
    expect(item.balance).toEqual(Quantity.fromScaled(5, 0));
  });

  it('requires positive quantities with the stock item scale', () => {
    const item = stockItem();

    expect(() => item.registerMovement(movement('PURCHASE_RECEIPT', 0)))
      .toThrowError('Stock movement quantity must be positive.');
    expect(() => item.registerMovement(movement('PURCHASE_RECEIPT', -1)))
      .toThrowError('Stock movement quantity must be positive.');
    expect(() => item.registerMovement(movement('PURCHASE_RECEIPT', 1, {
      quantity: Quantity.fromScaled(100, 2)
    }))).toThrowError('Stock movement quantity scale must match the stock item scale.');
  });

  it('requires auditable movement metadata and unique movement IDs', () => {
    const item = stockItem();
    const original = movement('PURCHASE_RECEIPT', 5, { id: 'movement-001' });
    item.registerMovement(original);

    expect(() => item.registerMovement({ ...original, reason: 'Duplicate' }))
      .toThrowError('Stock movement already exists.');
    expect(() => item.registerMovement(movement('ADJUSTMENT_IN', 1, { actorId: ' ' })))
      .toThrowError('Stock movement actor is required.');
    expect(() => item.registerMovement(movement('ADJUSTMENT_IN', 1, { reason: ' ' })))
      .toThrowError('Stock movement reason is required.');
    expect(() => item.registerMovement(movement('ADJUSTMENT_IN', 1, { referenceId: ' ' })))
      .toThrowError('Stock movement reference is required.');
    expect(() => item.registerMovement(movement('ADJUSTMENT_IN', 1, { occurredAt: new Date('invalid') })))
      .toThrowError('Stock movement timestamp is invalid.');
  });

  it('tracks independent balances for registered batches', () => {
    const item = stockItem(true);
    const first = item.registerBatch({
      id: 'batch-001', lotNumber: ' lot-a ', expiresAt: new Date('2027-01-01T00:00:00.000Z')
    });
    const second = item.registerBatch({ id: 'batch-002', lotNumber: 'lot-b' });
    item.registerMovement(movement('PURCHASE_RECEIPT', 10, { batchId: first.id }));
    item.registerMovement(movement('PURCHASE_RECEIPT', 5, {
      id: 'movement-second-batch', batchId: second.id
    }));
    item.registerMovement(movement('SALE_ISSUE', 4, { batchId: first.id }));

    expect(first.lotNumber).toBe('LOT-A');
    expect(item.balance).toEqual(Quantity.fromScaled(11, 0));
    expect(item.balanceForBatch(first.id)).toEqual(Quantity.fromScaled(6, 0));
    expect(item.balanceForBatch(second.id)).toEqual(Quantity.fromScaled(5, 0));
  });

  it('requires an existing batch for tracked stock and enforces its own balance', () => {
    const item = stockItem(true);
    item.registerBatch({ id: 'batch-001', lotNumber: 'LOT-A' });

    expect(() => item.registerMovement(movement('PURCHASE_RECEIPT', 1)))
      .toThrowError('A batch is required for this stock item.');
    expect(() => item.registerMovement(movement('PURCHASE_RECEIPT', 1, { batchId: 'batch-missing' })))
      .toThrowError('Stock batch was not found.');

    item.registerMovement(movement('PURCHASE_RECEIPT', 5, { batchId: 'batch-001' }));
    expect(() => item.registerMovement(movement('WASTE', 6, { batchId: 'batch-001' })))
      .toThrowError('Stock movement exceeds the available balance.');
  });

  it('rejects batches for stock that does not track them', () => {
    const item = stockItem();

    expect(() => item.registerBatch({ id: 'batch-001', lotNumber: 'LOT-A' }))
      .toThrowError('This stock item does not track batches.');
    expect(() => item.registerMovement(movement('PURCHASE_RECEIPT', 1, { batchId: 'batch-001' })))
      .toThrowError('This stock item does not accept a batch.');
  });

  it('rejects duplicate batch identities and lot numbers', () => {
    const item = stockItem(true);
    item.registerBatch({ id: 'batch-001', lotNumber: 'lot-a' });

    expect(() => item.registerBatch({ id: 'batch-001', lotNumber: 'lot-b' }))
      .toThrowError('Stock batch already exists.');
    expect(() => item.registerBatch({ id: 'batch-002', lotNumber: ' LOT-A ' }))
      .toThrowError('Stock batch lot number must be unique.');
  });

  it('returns defensive collections and timestamp copies', () => {
    const item = stockItem(true);
    const batch = item.registerBatch({
      id: 'batch-001', lotNumber: 'LOT-A', expiresAt: new Date('2027-01-01T00:00:00.000Z')
    });
    const registered = item.registerMovement(movement('PURCHASE_RECEIPT', 5, { batchId: batch.id }));
    const exposedBatches = item.batches as typeof batch[];
    const exposedMovements = item.movements as typeof registered[];
    const exposedExpiry = batch.expiresAt;
    const exposedTimestamp = registered.occurredAt;

    exposedBatches.length = 0;
    exposedMovements.length = 0;
    exposedExpiry?.setUTCFullYear(2030);
    exposedTimestamp.setUTCFullYear(2030);

    expect(item.batches).toHaveLength(1);
    expect(item.movements).toHaveLength(1);
    expect(batch.expiresAt?.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    expect(registered.occurredAt.toISOString()).toBe(timestamp.toISOString());
  });
});
