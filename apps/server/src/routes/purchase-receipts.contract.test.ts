import { afterEach, describe, expect, it } from 'vitest';
import { Category, UnitOfMeasure } from '@supermarket/core';
import { DrizzleCategoryRepository, DrizzleUnitOfMeasureRepository, SqliteUnitOfWork } from '@supermarket/driver-db';
import { buildApp } from '../app.ts';
import { ADMIN_PERMISSIONS, createSecurityRuntime, type SecurityRuntime } from '../runtime.ts';

describe('purchase receipt HTTP contracts', () => {
  const runtimes: SecurityRuntime[] = [];
  const apps: ReturnType<typeof buildApp>[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
    for (const runtime of runtimes.splice(0)) if (runtime.handle.sqlite.open) runtime.handle.close();
  });

  const setup = async (permissions: readonly string[] = ADMIN_PERMISSIONS) => {
    const runtime = createSecurityRuntime(':memory:', {
      terminalId: 'terminal-001', originNodeId: 'node-001'
    });
    runtimes.push(runtime);
    await runtime.provisionInitialAdmin.execute({
      operatorCode: 'OP001', displayName: 'Operador', pin: '123456', permissions
    });
    const unitOfWork = new SqliteUnitOfWork(runtime.handle.sqlite);
    await unitOfWork.execute(async () => {
      await new DrizzleCategoryRepository(runtime.handle).save(Category.create({
        id: 'category-grocery', name: 'Víveres'
      }));
      await new DrizzleUnitOfMeasureRepository(runtime.handle).save(UnitOfMeasure.create({
        id: 'unit-each', code: 'UND', name: 'Unidad', quantityScale: 0
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
      headers: { cookie, 'idempotency-key': 'purchase-receipt-product-001' },
      payload: {
        name: 'Café molido', description: 'Café para recepción',
        categoryId: 'category-grocery', unitCode: 'UND', barcodes: ['759000000002'],
        priceMinorUnits: 500, currencyCode: 'USD', taxRateBasisPoints: 1600,
        reason: 'Alta para recepción'
      }
    });
    expect(product.statusCode).toBe(201);
    const supplier = await app.inject({
      method: 'POST', url: '/api/v1/suppliers',
      headers: { cookie, 'idempotency-key': 'purchase-receipt-supplier-001' },
      payload: {
        legalName: 'Proveedor de café', fiscalAddress: { countryCode: 'VE', addressLine: 'Caracas' },
        taxIdentity: { type: 'RIF', value: 'J-12345678-9' }, reason: 'Proveedor para recepción'
      }
    });
    expect(supplier.statusCode).toBe(201);
    return {
      app, runtime, cookie,
      productId: product.json<{ id: string }>().id,
      supplierId: supplier.json<{ id: string }>().id
    };
  };

  it('starts, completes, reads and reverses a purchase receipt with its cost evidence', async () => {
    const { app, runtime, cookie, productId, supplierId } = await setup();

    const started = await app.inject({
      method: 'POST', url: '/api/v1/purchase-receipts',
      headers: { cookie, 'idempotency-key': 'purchase-receipt-start-001' },
      payload: {
        supplierId, sourceDocument: { type: 'INVOICE', number: 'FAC-001' },
        effectiveAt: '2026-09-04T09:00:00.000Z', reason: 'Compra inicial',
        lines: [{ productId, quantity: '10', purchaseUnitCostMinorUnits: 100, purchaseCurrency: 'USD' }]
      }
    });
    expect(started.statusCode).toBe(201);
    expect(started.json()).toMatchObject({ status: 'DRAFT', supplierId });
    const receiptId = started.json<{ id: string }>().id;

    const completed = await app.inject({
      method: 'PUT', url: `/api/v1/purchase-receipts/${receiptId}/complete`,
      headers: { cookie, 'idempotency-key': 'purchase-receipt-complete-001' },
      payload: { reason: 'Recepción confirmada' }
    });
    expect(completed.statusCode).toBe(200);
    expect(completed.json()).toMatchObject({
      status: 'COMPLETED',
      lines: [{ purchaseUnitCostMinorUnits: 100, valuationUnitCostMinorUnits: 100, valuationCurrency: 'USD' }]
    });

    const fetched = await app.inject({
      method: 'GET', url: `/api/v1/purchase-receipts/${receiptId}`, headers: { cookie }
    });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json()).toMatchObject({ status: 'COMPLETED' });

    const stockItemId = completed.json<{ lines: { stockItemId: string }[] }>().lines[0]!.stockItemId;
    const kardex = await app.inject({
      method: 'GET', url: `/api/v1/inventory/products/${productId}/kardex`, headers: { cookie }
    });
    expect(kardex.json()).toMatchObject({ id: stockItemId, currentBalanceScaled: 10 });

    const reversed = await app.inject({
      method: 'PUT', url: `/api/v1/purchase-receipts/${receiptId}/reverse`,
      headers: { cookie, 'idempotency-key': 'purchase-receipt-reverse-001' },
      payload: { reason: 'Documento duplicado' }
    });
    expect(reversed.statusCode).toBe(200);
    expect(reversed.json()).toMatchObject({ status: 'REVERSED', reversalReason: 'Documento duplicado' });

    const kardexAfterReversal = await app.inject({
      method: 'GET', url: `/api/v1/inventory/products/${productId}/kardex`, headers: { cookie }
    });
    expect(kardexAfterReversal.json()).toMatchObject({ currentBalanceScaled: 0 });

    expect(runtime.handle.sqlite.prepare(
      "select count(*) from audit_log where entity_type = 'PurchaseReceipt'"
    ).pluck().get()).toBe(3);
  });

  it('rejects completing the same source document twice and denies mutation without permission', async () => {
    const { app, cookie, productId, supplierId } = await setup();
    const line = { productId, quantity: '1', purchaseUnitCostMinorUnits: 100, purchaseCurrency: 'USD' };

    const first = await app.inject({
      method: 'POST', url: '/api/v1/purchase-receipts',
      headers: { cookie, 'idempotency-key': 'purchase-receipt-dup-start-1' },
      payload: {
        supplierId, sourceDocument: { type: 'INVOICE', number: 'FAC-100' },
        effectiveAt: '2026-09-04T09:00:00.000Z', reason: 'Compra', lines: [line]
      }
    });
    await app.inject({
      method: 'PUT', url: `/api/v1/purchase-receipts/${first.json<{ id: string }>().id}/complete`,
      headers: { cookie, 'idempotency-key': 'purchase-receipt-dup-complete-1' },
      payload: { reason: 'Recepción' }
    });

    const second = await app.inject({
      method: 'POST', url: '/api/v1/purchase-receipts',
      headers: { cookie, 'idempotency-key': 'purchase-receipt-dup-start-2' },
      payload: {
        supplierId, sourceDocument: { type: 'INVOICE', number: 'FAC-100' },
        effectiveAt: '2026-09-04T09:00:00.000Z', reason: 'Compra duplicada', lines: [line]
      }
    });
    const duplicate = await app.inject({
      method: 'PUT', url: `/api/v1/purchase-receipts/${second.json<{ id: string }>().id}/complete`,
      headers: { cookie, 'idempotency-key': 'purchase-receipt-dup-complete-2' },
      payload: { reason: 'Reintento' }
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({ code: 'PURCHASE_RECEIPT_SOURCE_DUPLICATED' });
  });

  it('denies starting a receipt without permission before touching persistence', async () => {
    const permissions = ADMIN_PERMISSIONS.filter((permission) => permission !== 'purchase_receipt.start');
    const { app, runtime, cookie, productId, supplierId } = await setup(permissions);

    const denied = await app.inject({
      method: 'POST', url: '/api/v1/purchase-receipts',
      headers: { cookie, 'idempotency-key': 'purchase-receipt-forbidden' },
      payload: {
        supplierId, sourceDocument: { type: 'INVOICE', number: 'FAC-101' },
        effectiveAt: '2026-09-04T09:00:00.000Z', reason: 'Compra',
        lines: [{ productId, quantity: '1', purchaseUnitCostMinorUnits: 100, purchaseCurrency: 'USD' }]
      }
    });
    expect(denied.statusCode).toBe(403);
    expect(runtime.handle.sqlite.prepare('select count(*) from purchase_receipts').pluck().get()).toBe(0);
  });
});
