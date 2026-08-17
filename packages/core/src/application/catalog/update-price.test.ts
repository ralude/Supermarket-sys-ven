import { describe, expect, it } from 'vitest';
import { Product, UnitOfMeasure } from '../../domain/catalog/index.js';
import { Money, TaxRate } from '@supermarket/shared';
import type { ProductRepository } from '../ports/index.js';
import { UpdatePrice } from './update-price.js';

function product(): Product {
  return Product.create({
    id: 'product-001',
    name: 'Coffee',
    description: 'Ground coffee',
    categoryId: 'category-001',
    unitOfMeasure: UnitOfMeasure.create({ id: 'unit-001', code: 'UNIT', name: 'Unit', quantityScale: 0 }),
    barcodes: [],
    price: Money.fromMinorUnits(1250, 'USD'),
    taxRate: TaxRate.fromBasisPoints(1600),
    priceHistoryId: 'price-001',
    recordedBy: 'user-001',
    occurredAt: new Date('2026-08-15T10:00:00.000Z'),
    eventId: 'event-001'
  });
}

class FakeProductRepository implements ProductRepository {
  stored = product();

  async save(value: Product): Promise<void> {
    this.stored = value;
  }

  async findById(): Promise<Product | null> {
    return this.stored;
  }

  async findByActiveBarcode(): Promise<Product | null> {
    return null;
  }
}

describe('UpdatePrice', () => {
  it('changes the current price and appends price history', async () => {
    const repository = new FakeProductRepository();
    const useCase = new UpdatePrice(
      repository,
      { generate: () => 'price-002' },
      { generate: () => 'event-002' },
      { now: () => new Date('2026-08-16T10:00:00.000Z') }
    );

    const result = await useCase.execute({
      productId: 'product-001',
      priceMinorUnits: 1500,
      currencyCode: 'USD',
      changedBy: 'user-002',
      reason: 'Supplier update'
    });

    expect(result.ok).toBe(true);
    expect(repository.stored.price.minorUnits).toBe(1500);
    expect(repository.stored.priceHistory).toHaveLength(2);
  });
});
