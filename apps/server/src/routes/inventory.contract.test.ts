import { afterEach, describe, expect, it } from 'vitest';
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
    const app = buildApp(runtime.dependencies);
    apps.push(app);
    const login = await app.inject({
      method: 'POST', url: '/api/v1/auth/session',
      payload: { operatorCode: 'OP001', pin: '123456' }
    });
    return { app, runtime, cookie: String(login.headers['set-cookie']).split(';')[0]! };
  };

  it('receives, adjusts and reads append-only inventory through SQLite', async () => {
    const { app, runtime, cookie } = await setup();
    const receipt = await app.inject({
      method: 'POST', url: '/api/v1/inventory/receipts',
      headers: { cookie, 'idempotency-key': 'inventory-receipt-001' },
      payload: {
        stockItemId: 'stock-coffee', productId: 'product-coffee', unitCode: 'UNIT',
        quantityScale: 0, tracksBatches: false, quantityScaled: 10,
        supplierId: 'supplier-001', receiptId: 'receipt-001', reason: 'Compra recibida'
      }
    });
    expect(receipt.statusCode).toBe(201);
    expect(receipt.json()).toMatchObject({ balanceScaled: 10 });
    const receiptReplay = await app.inject({
      method: 'POST', url: '/api/v1/inventory/receipts',
      headers: { cookie, 'idempotency-key': 'inventory-receipt-001' },
      payload: {
        stockItemId: 'stock-coffee', productId: 'product-coffee', unitCode: 'UNIT',
        quantityScale: 0, tracksBatches: false, quantityScaled: 10,
        supplierId: 'supplier-001', receiptId: 'receipt-001', reason: 'Compra recibida'
      }
    });
    expect(receiptReplay.statusCode).toBe(201);
    expect(receiptReplay.json()).toEqual(receipt.json());

    const waste = await app.inject({
      method: 'POST', url: '/api/v1/inventory/stock-items/stock-coffee/adjustments',
      headers: { cookie, 'idempotency-key': 'inventory-waste-001' },
      payload: {
        type: 'WASTE', quantityScaled: 2, quantityScale: 0,
        reason: 'Producto dañado', referenceId: 'waste-001'
      }
    });
    expect(waste.statusCode).toBe(200);
    expect(waste.json()).toMatchObject({ balanceScaled: 8 });

    const kardex = await app.inject({
      method: 'GET', url: '/api/v1/inventory/products/product-coffee/kardex',
      headers: { cookie }
    });
    expect(kardex.statusCode).toBe(200);
    expect(kardex.json()).toMatchObject({
      id: 'stock-coffee', productId: 'product-coffee', currentBalanceScaled: 8,
      movements: [{ type: 'PURCHASE_RECEIPT' }, { type: 'WASTE' }]
    });
    expect(runtime.handle.sqlite.prepare('select count(*) from stock_movements').pluck().get()).toBe(2);
    expect(runtime.handle.sqlite.prepare('select count(*) from audit_log').pluck().get()).toBe(2);
  });
});
