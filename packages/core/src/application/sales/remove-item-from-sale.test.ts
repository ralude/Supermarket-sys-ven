import { describe, expect, it } from 'vitest';
import { Money, Quantity, TaxRate } from '@supermarket/shared';
import { ProductSnapshot } from '../../domain/catalog/index.js';
import { Sale } from '../../domain/sales/index.js';
import type { ExecutionContext } from '../execution-context.js';
import type { SaleRepository } from '../ports/index.js';
import { RemoveItemFromSale } from './remove-item-from-sale.js';

const context: ExecutionContext = {
  actorId: 'user-001',
  terminalId: 'terminal-001',
  originNodeId: 'node-001',
  correlationId: 'correlation-001'
};

class FakeSaleRepository implements SaleRepository {
  stored: Sale;

  constructor() {
    this.stored = Sale.start({
      id: 'sale-001', shiftId: 'shift-001',
      currencyCode: 'USD',
      terminalId: 'terminal-001',
      originNodeId: 'node-001',
      startedBy: 'user-001',
      startedAt: new Date('2026-08-15T10:00:00.000Z'),
      eventId: 'event-001'
    });
    this.stored.addItem({
      id: 'item-001',
      snapshot: ProductSnapshot.create({
        productId: 'product-001',
        description: 'Coffee',
        price: Money.fromMinorUnits(1000, 'USD'),
        taxRate: TaxRate.fromBasisPoints(1600),
        unitCode: 'UNIT',
        unitScale: 0
      }),
      quantity: Quantity.fromScaled(1, 0),
      occurredAt: new Date('2026-08-15T10:00:30.000Z'),
      eventId: 'event-002'
    });
  }

  async save(sale: Sale): Promise<void> {
    this.stored = sale;
  }

  async findById(): Promise<Sale | null> {
    return this.stored;
  }
}

describe('RemoveItemFromSale', () => {
  it('removes the item and recalculates totals', async () => {
    const repository = new FakeSaleRepository();
    const useCase = new RemoveItemFromSale(
      repository,
      { generate: () => 'event-003' },
      { now: () => new Date('2026-08-15T10:01:00.000Z') }
    );

    const result = await useCase.execute({ saleId: 'sale-001', itemId: 'item-001' }, context);

    expect(result.ok).toBe(true);
    expect(repository.stored.items).toHaveLength(0);
    expect(repository.stored.subtotal.minorUnits).toBe(0);
  });
});
