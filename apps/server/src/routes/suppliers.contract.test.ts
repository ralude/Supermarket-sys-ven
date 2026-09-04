import { afterEach, describe, expect, it } from 'vitest';
import type { CreateSupplierRequest } from '@supermarket/shared';
import { buildApp } from '../app.ts';
import { ADMIN_PERMISSIONS, createSecurityRuntime, type SecurityRuntime } from '../runtime.ts';

const supplier: CreateSupplierRequest = {
  legalName: 'Distribuidora Los Andes, C.A.',
  tradeName: 'Los Andes',
  fiscalAddress: { countryCode: 'VE', addressLine: 'Caracas' },
  taxIdentity: { country: 've', type: 'rif', value: 'J-12345678-9' },
  reason: 'Alta de proveedor'
};

describe('supplier HTTP contracts', () => {
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
    const provisioned = await runtime.provisionInitialAdmin.execute({
      operatorCode: 'OP001', displayName: 'Operador', pin: '123456', permissions
    });
    expect(provisioned.ok).toBe(true);
    const app = buildApp(runtime.dependencies);
    apps.push(app);
    const login = await app.inject({
      method: 'POST', url: '/api/v1/auth/session',
      payload: { operatorCode: 'OP001', pin: '123456' }
    });
    return { app, runtime, cookie: String(login.headers['set-cookie']).split(';')[0]! };
  };

  it('creates, reads, updates, changes status and corrects tax identity atomically', async () => {
    const { app, runtime, cookie } = await setup();
    const created = await app.inject({
      method: 'POST', url: '/api/v1/suppliers',
      headers: { cookie, 'idempotency-key': 'supplier-create-001' }, payload: supplier
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      code: 'SUP-000001', legalName: supplier.legalName, status: 'ACTIVE',
      taxIdentity: { country: 'VE', type: 'RIF', normalizedValue: 'J123456789' }
    });
    const supplierId = created.json<{ id: string }>().id;

    const listed = await app.inject({
      method: 'GET', url: '/api/v1/suppliers?status=ACTIVE', headers: { cookie }
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toMatchObject([{ id: supplierId }]);

    const updated = await app.inject({
      method: 'PATCH', url: `/api/v1/suppliers/${supplierId}`,
      headers: { cookie, 'idempotency-key': 'supplier-update-001' },
      payload: { tradeName: 'Los Andes Mayorista', reason: 'Actualización comercial' }
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ tradeName: 'Los Andes Mayorista', version: 2 });

    const blocked = await app.inject({
      method: 'PUT', url: `/api/v1/suppliers/${supplierId}/status`,
      headers: { cookie, 'idempotency-key': 'supplier-status-001' },
      payload: { status: 'BLOCKED', reason: 'Bloqueo operativo' }
    });
    expect(blocked.statusCode).toBe(200);
    expect(blocked.json()).toMatchObject({ status: 'BLOCKED', version: 3 });

    const corrected = await app.inject({
      method: 'PUT', url: `/api/v1/suppliers/${supplierId}/tax-identity`,
      headers: { cookie, 'idempotency-key': 'supplier-tax-001' },
      payload: {
        taxIdentity: { type: 'RIF', value: 'J-12345677-0' },
        reason: 'Corrección verificada contra documento fiscal'
      }
    });
    expect(corrected.statusCode).toBe(200);
    expect(corrected.json()).toMatchObject({
      taxIdentity: { normalizedValue: 'J123456770' }, version: 4
    });

    const stored = runtime.handle.sqlite.prepare(
      'select code, status, tax_normalized_value, version from suppliers where id = ?'
    ).get(supplierId);
    expect(stored).toMatchObject({
      code: 'SUP-000001', status: 'BLOCKED', tax_normalized_value: 'J123456770', version: 4
    });
    const audit = runtime.handle.sqlite.prepare(
      'select action, before_state, after_state, reason from audit_log where entity_id = ? order by occurred_at, action'
    ).all(supplierId) as Array<Record<string, unknown>>;
    expect(audit.map((entry) => entry.action).sort()).toEqual([
      'SUPPLIER_CREATED', 'SUPPLIER_STATUS_CHANGED',
      'SUPPLIER_TAX_IDENTITY_CORRECTED', 'SUPPLIER_UPDATED'
    ]);
    expect(audit.find((entry) => entry.action === 'SUPPLIER_TAX_IDENTITY_CORRECTED'))
      .toMatchObject({ reason: 'Corrección verificada contra documento fiscal' });
  });

  it('accepts a generic tax identity outside Venezuela and rejects a country-specific type', async () => {
    const { app, cookie } = await setup();
    const created = await app.inject({
      method: 'POST', url: '/api/v1/suppliers',
      headers: { cookie, 'idempotency-key': 'supplier-create-foreign' },
      payload: {
        legalName: 'Importadora Andina S.A.S.',
        fiscalAddress: { countryCode: 'co', addressLine: 'Bogotá' },
        taxIdentity: { country: 'co', type: 'TAX_ID', value: ' 900 123 456 ' },
        reason: 'Proveedor extranjero'
      }
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      fiscalAddress: { countryCode: 'CO', addressLine: 'Bogotá' },
      taxIdentity: { country: 'CO', type: 'TAX_ID', normalizedValue: '900123456' }
    });

    const rejected = await app.inject({
      method: 'POST', url: '/api/v1/suppliers',
      headers: { cookie, 'idempotency-key': 'supplier-create-nit' },
      payload: {
        legalName: 'Importadora Dos S.A.S.',
        taxIdentity: { country: 'CO', type: 'NIT', value: '900123457' },
        reason: 'Proveedor extranjero'
      }
    });
    expect(rejected.statusCode).toBe(400);
    expect(rejected.json()).toMatchObject({ code: 'SUPPLIER_TAX_TYPE_INVALID' });
  });

  it('rejects a fiscal address without its country and keeps it optional', async () => {
    const { app, cookie } = await setup();
    const halfAddress = await app.inject({
      method: 'POST', url: '/api/v1/suppliers',
      headers: { cookie, 'idempotency-key': 'supplier-create-half-address' },
      payload: {
        legalName: 'Distribuidora Sin País',
        fiscalAddress: { addressLine: 'Caracas' },
        taxIdentity: { type: 'RIF', value: 'J-12345670-1' },
        reason: 'Alta con dirección incompleta'
      }
    });
    expect(halfAddress.statusCode).toBe(400);
    expect(halfAddress.json()).toMatchObject({ code: 'HTTP_VALIDATION_FAILED' });

    const withoutAddress = await app.inject({
      method: 'POST', url: '/api/v1/suppliers',
      headers: { cookie, 'idempotency-key': 'supplier-create-no-address' },
      payload: {
        legalName: 'Distribuidora Sin Dirección',
        taxIdentity: { type: 'RIF', value: 'J-12345670-1' },
        reason: 'Alta sin dirección'
      }
    });
    expect(withoutAddress.statusCode).toBe(201);
    expect(withoutAddress.json()).toMatchObject({ fiscalAddress: null });
  });

  it('keeps a blocked supplier reactivable and its history readable', async () => {
    const { app, cookie } = await setup();
    const created = await app.inject({
      method: 'POST', url: '/api/v1/suppliers',
      headers: { cookie, 'idempotency-key': 'supplier-create-lifecycle' }, payload: supplier
    });
    const supplierId = created.json<{ id: string }>().id;
    const blocked = await app.inject({
      method: 'PUT', url: `/api/v1/suppliers/${supplierId}/status`,
      headers: { cookie, 'idempotency-key': 'supplier-lifecycle-blocked' },
      payload: { status: 'BLOCKED', reason: 'Suspensión temporal' }
    });
    expect(blocked.statusCode).toBe(200);

    const activeOnly = await app.inject({
      method: 'GET', url: '/api/v1/suppliers?status=ACTIVE', headers: { cookie }
    });
    expect(activeOnly.json()).toEqual([]);
    const history = await app.inject({
      method: 'GET', url: `/api/v1/suppliers/${supplierId}`, headers: { cookie }
    });
    expect(history.json()).toMatchObject({ status: 'BLOCKED' });

    const reactivated = await app.inject({
      method: 'PUT', url: `/api/v1/suppliers/${supplierId}/status`,
      headers: { cookie, 'idempotency-key': 'supplier-lifecycle-active' },
      payload: { status: 'ACTIVE', reason: 'Suspensión levantada' }
    });
    expect(reactivated.statusCode).toBe(200);
    expect(reactivated.json()).toMatchObject({ status: 'ACTIVE', version: 3 });
  });

  it('denies mutations without their permission before persistence', async () => {
    const { app, runtime, cookie } = await setup([]);
    const response = await app.inject({
      method: 'POST', url: '/api/v1/suppliers',
      headers: { cookie, 'idempotency-key': 'supplier-forbidden-001' }, payload: supplier
    });
    expect(response.statusCode).toBe(403);
    expect(runtime.handle.sqlite.prepare('select count(*) from suppliers').pluck().get()).toBe(0);
  });

  it('requires the privileged permission for tax identity corrections', async () => {
    const permissions = ADMIN_PERMISSIONS.filter((permission) => permission !== 'supplier.tax_identity.correct');
    const { app, cookie } = await setup(permissions);
    const created = await app.inject({
      method: 'POST', url: '/api/v1/suppliers',
      headers: { cookie, 'idempotency-key': 'supplier-create-limited' }, payload: supplier
    });
    const supplierId = created.json<{ id: string }>().id;
    const response = await app.inject({
      method: 'PUT', url: `/api/v1/suppliers/${supplierId}/tax-identity`,
      headers: { cookie, 'idempotency-key': 'supplier-tax-forbidden' },
      payload: { taxIdentity: { type: 'RIF', value: 'J-12345677-0' }, reason: 'Corrección' }
    });
    expect(response.statusCode).toBe(403);
  });
});
