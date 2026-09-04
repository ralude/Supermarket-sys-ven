import { afterEach, describe, expect, it } from 'vitest';
import { Category, UnitOfMeasure } from '@supermarket/core';
import {
  DrizzleCategoryRepository,
  DrizzleUnitOfMeasureRepository,
  SqliteUnitOfWork
} from '@supermarket/driver-db';
import { buildApp } from '../app.ts';
import { ADMIN_PERMISSIONS, createSecurityRuntime, type SecurityRuntime } from '../runtime.ts';

describe('inventory HTTP contracts', () => {
  const runtimes: SecurityRuntime[] = [];
  const apps: ReturnType<typeof buildApp>[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
    for (const runtime of runtimes.splice(0)) if (runtime.handle.sqlite.open) runtime.handle.close();
  });

  const setup = async () => {
    const runtime = createSecurityRuntime(':memory:', {
      terminalId: 'terminal-001', originNodeId: 'node-001'
    });
    runtimes.push(runtime);
    await runtime.provisionInitialAdmin.execute({
      operatorCode: 'OP001', displayName: 'Operador', pin: '123456',
      permissions: ADMIN_PERMISSIONS
    });
    const unitOfWork = new SqliteUnitOfWork(runtime.handle.sqlite);
    await unitOfWork.execute(async () => {
      await new DrizzleCategoryRepository(runtime.handle).save(Category.create({
        id: 'category-grocery', name: 'Víveres'
      }));
      await new DrizzleUnitOfMeasureRepository(runtime.handle).save(UnitOfMeasure.create({
        id: 'unit-kilogram', code: 'KG', name: 'Kilogramo', quantityScale: 3
      }));
    });
    const app = buildApp(runtime.dependencies);
    apps.push(app);
    const login = await app.inject({
      method: 'POST', url: '/api/v1/auth/session',
      payload: { operatorCode: 'OP001', pin: '123456' }
    });
    const cookie = String(login.headers['set-cookie']).split(';')[0]!;
    const product = await app.inject({
      method: 'POST', url: '/api/v1/catalog/products',
      headers: { cookie, 'idempotency-key': 'inventory-product-001' },
      payload: {
        name: 'Café molido', description: 'Café para recepción contractual',
        categoryId: 'category-grocery', unitCode: 'KG', barcodes: ['759000000001'],
        priceMinorUnits: 1250, currencyCode: 'USD', taxRateBasisPoints: 1600,
        reason: 'Alta para recepción'
      }
    });
    expect(product.statusCode).toBe(201);
    return { app, runtime, cookie, productId: product.json<{ id: string }>().id };
  };

  it('receives, adjusts and reads append-only inventory through SQLite', async () => {
    const { app, runtime, cookie, productId } = await setup();
    const supplier = await app.inject({
      method: 'POST', url: '/api/v1/suppliers',
      headers: { cookie, 'idempotency-key': 'inventory-supplier-001' },
      payload: {
        legalName: 'Proveedor de café',
        taxIdentity: { type: 'RIF', value: 'J-12345678-9' },
        reason: 'Proveedor para recepción'
      }
    });
    expect(supplier.statusCode).toBe(201);
    const supplierId = supplier.json<{ id: string }>().id;
    /** El nodo crea el artículo y toma unidad y escala del producto: KG con escala 3. */
    const receiptPayload = {
      productId, quantity: '10,5', supplierId,
      receiptId: 'receipt-001', reason: 'Compra recibida'
    };
    const receipt = await app.inject({
      method: 'POST', url: '/api/v1/inventory/receipts',
      headers: { cookie, 'idempotency-key': 'inventory-receipt-001' },
      payload: receiptPayload
    });
    expect(receipt.statusCode).toBe(201);
    expect(receipt.json()).toMatchObject({
      productId, unitCode: 'KG', quantityScale: 3, tracksBatches: false, balanceScaled: 10500
    });
    const stockItemId = receipt.json<{ id: string }>().id;
    const receiptReplay = await app.inject({
      method: 'POST', url: '/api/v1/inventory/receipts',
      headers: { cookie, 'idempotency-key': 'inventory-receipt-001' },
      payload: receiptPayload
    });
    expect(receiptReplay.statusCode).toBe(201);
    expect(receiptReplay.json()).toEqual(receipt.json());

    const waste = await app.inject({
      method: 'POST', url: `/api/v1/inventory/stock-items/${stockItemId}/adjustments`,
      headers: { cookie, 'idempotency-key': 'inventory-waste-001' },
      payload: {
        type: 'WASTE', quantityScaled: 500, quantityScale: 3,
        reason: 'Producto dañado', referenceId: 'waste-001'
      }
    });
    expect(waste.statusCode).toBe(200);
    expect(waste.json()).toMatchObject({ balanceScaled: 10000 });

    const kardex = await app.inject({
      method: 'GET', url: `/api/v1/inventory/products/${productId}/kardex`,
      headers: { cookie }
    });
    expect(kardex.statusCode).toBe(200);
    expect(kardex.json()).toMatchObject({
      id: stockItemId, productId, currentBalanceScaled: 10000,
      movements: [{ type: 'PURCHASE_RECEIPT' }, { type: 'WASTE' }]
    });
    expect(runtime.handle.sqlite.prepare('select count(*) from stock_movements').pluck().get()).toBe(2);
    expect(runtime.handle.sqlite.prepare('select count(*) from audit_log').pluck().get()).toBe(4);
  });

  it('rejects a receipt for a product that the catalog does not know', async () => {
    const { app, runtime, cookie } = await setup();
    const supplier = await app.inject({
      method: 'POST', url: '/api/v1/suppliers',
      headers: { cookie, 'idempotency-key': 'inventory-supplier-002' },
      payload: {
        legalName: 'Proveedor sin producto',
        taxIdentity: { type: 'RIF', value: 'J-98765432-1' },
        reason: 'Proveedor para recepción'
      }
    });
    expect(supplier.statusCode).toBe(201);

    const receipt = await app.inject({
      method: 'POST', url: '/api/v1/inventory/receipts',
      headers: { cookie, 'idempotency-key': 'inventory-receipt-002' },
      payload: {
        productId: 'product-inexistente', quantity: '1',
        supplierId: supplier.json<{ id: string }>().id,
        receiptId: 'receipt-002', reason: 'Compra recibida'
      }
    });

    expect(receipt.statusCode).toBe(404);
    expect(receipt.json()).toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
    expect(runtime.handle.sqlite.prepare('select count(*) from stock_items').pluck().get()).toBe(0);
    expect(runtime.handle.sqlite.prepare('select count(*) from stock_movements').pluck().get()).toBe(0);
  });
});
