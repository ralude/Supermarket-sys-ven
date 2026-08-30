import { describe, expect, it } from 'vitest';
import { Money, TaxRate } from '@supermarket/shared';
import { ProductSnapshot } from '../../domain/catalog/index.js';
import { Sale } from '../../domain/sales/index.js';
import type { ExecutionContext } from '../execution-context.js';
import type { ProductSnapshotProvider, SaleRepository } from '../ports/index.js';
import { AddItemToSale } from './add-item-to-sale.js';

const context: ExecutionContext = {
  actorId: 'user-001',
  terminalId: 'terminal-001',
  originNodeId: 'node-001',
  correlationId: 'correlation-001'
};

function sale(): Sale {
  return Sale.start({
    id: 'sale-001', shiftId: 'shift-001',
    currencyCode: 'USD',
    terminalId: 'terminal-001',
    originNodeId: 'node-001',
    startedBy: 'user-001',
    startedAt: new Date('2026-08-15T10:00:00.000Z'),
    eventId: 'event-001'
  });
}

class FakeSaleRepository implements SaleRepository {
  stored = sale();

  async save(value: Sale): Promise<void> {
    this.stored = value;
  }

  async findById(): Promise<Sale | null> {
    return this.stored;
  }
}

class FakeSnapshotProvider implements ProductSnapshotProvider {
  async findSnapshotByBarcode(): Promise<ProductSnapshot | null> {
    return ProductSnapshot.create({
      productId: 'product-001',
      description: 'Coffee',
      price: Money.fromMinorUnits(1000, 'USD'),
      taxRate: TaxRate.fromBasisPoints(1600),
      unitCode: 'UNIT',
      unitScale: 0
    });
  }
}

describe('AddItemToSale', () => {
  it('adds a catalog snapshot without accessing a product entity', async () => {
    const repository = new FakeSaleRepository();
    const useCase = new AddItemToSale(
      repository,
      new FakeSnapshotProvider(),
      { generate: () => 'item-001' },
      { generate: () => 'event-002' },
      { now: () => new Date('2026-08-15T10:01:00.000Z') }
    );

    const result = await useCase.execute(
      { saleId: 'sale-001', barcode: '0123456789', quantityScaled: 2, quantityScale: 0 },
      context
    );

    expect(result.ok).toBe(true);
    expect(repository.stored.items).toHaveLength(1);
    expect(repository.stored.items[0]?.snapshot.description).toBe('Coffee');
  });
});
