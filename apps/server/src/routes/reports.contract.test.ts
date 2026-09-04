import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { ADMIN_PERMISSIONS, createSecurityRuntime, type SecurityRuntime } from '../runtime.ts';

describe('reporting HTTP contracts', () => {
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
    const app = buildApp(runtime.dependencies);
    apps.push(app);
    const login = await app.inject({
      method: 'POST', url: '/api/v1/auth/session',
      payload: { operatorCode: 'OP001', pin: '123456' }
    });
    return { app, runtime, cookie: String(login.headers['set-cookie']).split(';')[0]! };
  };

  const paths = [
    '/api/v1/reports/cash-closures',
    '/api/v1/reports/audit',
    '/api/v1/reports/fiscal-operations'
  ];

  it('projects cash closures and audit entries from SQLite for an authorized reader', async () => {
    const { app, runtime, cookie } = await setup();
    runtime.handle.sqlite.exec(`
      insert into cash_registers (id, name, terminal_id, origin_node_id, is_active)
      values ('register-1', 'Caja 1', 'terminal-001', 'node-001', 1);
      insert into shifts (id, cash_register_id, terminal_id, origin_node_id, opened_by, opened_at, status, version, closed_at, closed_by)
      values ('shift-1', 'register-1', 'terminal-001', 'node-001', 'user-1', 1756000000000, 'CLOSED', 2, 1756030000000, 'user-2');
      insert into shift_closing_balances (shift_id, payment_method_code, currency_code, expected_minor_units, declared_minor_units, difference_minor_units)
      values ('shift-1', 'CASH', 'USD', 5000, 4900, -100);
      insert into audit_log (audit_id, actor_id, actor_role_codes, action, entity_type, entity_id,
        before_state, after_state, reason, terminal_id, origin_node_id, occurred_at, correlation_id)
      values ('audit-1', 'user-1', '["supervisor"]', 'sale.void', 'Sale', 'sale-1',
        '{"pin":"[REDACTED]"}', '{"status":"VOIDED"}', 'Cliente desistió', 'terminal-001',
        'node-001', 1756020000000, 'correlation-1');
    `);

    const closures = await app.inject({
      method: 'GET', url: '/api/v1/reports/cash-closures?cashRegisterId=register-1',
      headers: { cookie }
    });
    expect(closures.statusCode).toBe(200);
    expect(closures.json()).toEqual([expect.objectContaining({
      shiftId: 'shift-1', closedBy: 'user-2', closedAt: '2025-08-24T10:06:40.000Z',
      movementCount: 0,
      balances: [{
        paymentMethodCode: 'CASH', currencyCode: 'USD', expectedMinorUnits: 5000,
        declaredMinorUnits: 4900, differenceMinorUnits: -100
      }]
    })]);

    const audit = await app.inject({ method: 'GET', url: '/api/v1/reports/audit', headers: { cookie } });
    expect(audit.statusCode).toBe(200);
    expect(audit.json()).toEqual([{
      auditId: 'audit-1', actorId: 'user-1', actorRoleCodes: ['supervisor'], action: 'sale.void',
      entityType: 'Sale', entityId: 'sale-1', reason: 'Cliente desistió', terminalId: 'terminal-001',
      originNodeId: 'node-001', occurredAt: '2025-08-24T07:20:00.000Z', correlationId: 'correlation-1'
    }]);
    expect(audit.body).not.toContain('beforeState');
    expect(audit.body).not.toContain('VOIDED');
  });

  it('labels the fiscal operations projection as a simulation', async () => {
    const { app, cookie } = await setup();

    const response = await app.inject({
      method: 'GET', url: '/api/v1/reports/fiscal-operations', headers: { cookie }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ fiscalMode: 'SIMULATION', operations: [] });
  });

  it('rejects an anonymous read of every report', async () => {
    const { app } = await setup();
    for (const url of paths) {
      const response = await app.inject({ method: 'GET', url });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ code: 'UNAUTHORIZED' });
    }
  });

  it('denies a reader without the report permission before exposing content', async () => {
    const { app, runtime, cookie } = await setup([]);
    runtime.handle.sqlite.exec(`
      insert into audit_log (audit_id, actor_id, actor_role_codes, action, entity_type, entity_id,
        before_state, after_state, reason, terminal_id, origin_node_id, occurred_at, correlation_id)
      values ('audit-secret', 'user-1', '["supervisor"]', 'sale.void', 'Sale', 'sale-secret',
        null, null, 'Motivo reservado', 'terminal-001', 'node-001', 1756020000000, 'correlation-2');
    `);

    for (const url of paths) {
      const response = await app.inject({ method: 'GET', url, headers: { cookie } });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: 'FORBIDDEN' });
      expect(response.body).not.toContain('audit-secret');
      expect(response.body).not.toContain('Motivo reservado');
    }
  });

  it('rejects a row limit outside the approved range without querying', async () => {
    const { app, cookie } = await setup();

    const response = await app.inject({
      method: 'GET', url: '/api/v1/reports/audit?limit=5000', headers: { cookie }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'HTTP_VALIDATION_FAILED' });
  });
});
