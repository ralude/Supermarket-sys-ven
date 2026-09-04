import { describe, expect, it } from 'vitest';
import { Product, UnitOfMeasure } from '../../domain/catalog/index.js';
import { Barcode } from '../../domain/catalog/barcode.js';
import { Money, TaxRate } from '@supermarket/shared';
import type { CatalogReadRepository } from '../ports/index.js';
import { GetPriceHistory } from './get-price-history.js';
import { ListProducts } from './list-products.js';

const product = (id: string, name: string): Product => Product.create({
  id, name, description: name + ' description', categoryId: 'category-001',
  unitOfMeasure: UnitOfMeasure.create({ id: 'unit-001', code: 'UNIT', name: 'Unit', quantityScale: 0 }),
  barcodes: [Barcode.create({ id: id + '-barcode', value: '759000000001' + id.slice(-1) })],
  price: Money.fromMinorUnits(1250, 'USD'), taxRate: TaxRate.fromBasisPoints(1600),
  priceHistoryId: id + '-price', recordedBy: 'user-001',
  occurredAt: new Date('2026-08-15T10:00:00.000Z'), eventId: id + '-event'
});

class FakeCatalogReadRepository implements CatalogReadRepository {
  readonly values = [product('product-001', 'Coffee'), product('product-002', 'Tea')];
  async findAll(): Promise<readonly Product[]> { return this.values; }
  async findById(id: string): Promise<Product | null> { return this.values.find((value) => value.id === id) ?? null; }
}

describe('catalog read models', () => {
  it('filters the product list by name or barcode and maps DTOs', async () => {
    const result = await new ListProducts(new FakeCatalogReadRepository()).execute('tea');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.map((item) => item.name)).toEqual(['Tea']);
  });

  it('returns price history from the product aggregate without exposing persistence', async () => {
    const result = await new GetPriceHistory(new FakeCatalogReadRepository()).execute('product-001');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value[0]).toMatchObject({ priceMinorUnits: 1250, currencyCode: 'USD' });
  });
});
