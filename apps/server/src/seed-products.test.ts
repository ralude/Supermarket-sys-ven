import { afterEach, describe, expect, it } from 'vitest';
import {
  applyMigrations,
  DrizzleProductRepository,
  openDatabase,
  type DatabaseHandle
} from '@supermarket/driver-db';
import { seedExampleProducts } from './seed-products.ts';

describe('example product seed', () => {
  let handle: DatabaseHandle | undefined;

  afterEach(() => {
    handle?.close();
    handle = undefined;
  });

  it('creates the basic catalog once when executed repeatedly', async () => {
    handle = openDatabase(':memory:');
    applyMigrations(handle.sqlite);

    const options = { currencyCode: 'USD', taxRateBasisPoints: 0 };
    const first = await seedExampleProducts(handle, options);
    const second = await seedExampleProducts(handle, options);

    expect(first).toEqual({ categories: 3, unitsOfMeasure: 1, products: 5 });
    expect(second).toEqual(first);
    expect(countRows(handle, 'categories')).toBe(3);
    expect(countRows(handle, 'units_of_measure')).toBe(1);
    expect(countRows(handle, 'products')).toBe(5);
    expect(countRows(handle, 'product_barcodes')).toBe(5);
    expect(countRows(handle, 'product_price_history')).toBe(5);

    const product = await new DrizzleProductRepository(handle)
      .findByActiveBarcode('DEMOARROZ001');
    expect(product?.name).toBe('Arroz blanco 1 kg');
    expect(product?.price.currency).toBe('USD');
    expect(product?.taxRate.basisPoints).toBe(0);
  });
});

const countRows = (handle: DatabaseHandle, table: string): number => {
  const row = handle.sqlite.prepare(`select count(*) as count from ${table}`).get() as {
    count: number;
  };
  return row.count;
};
