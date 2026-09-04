import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';
import { ADMIN_PERMISSIONS, createSecurityRuntime, type SecurityRuntime } from './runtime.ts';

describe('authenticated HTTP foundation', () => {
  const runtimes: SecurityRuntime[] = [];
  const apps: ReturnType<typeof buildApp>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
    for (const runtime of runtimes.splice(0)) {
      if (runtime.handle.sqlite.open) runtime.handle.close();
    }
  });

  const setup = async (reports = false, permissions: readonly string[] = ADMIN_PERMISSIONS) => {
    const runtime = createSecurityRuntime(':memory:', {
      terminalId: 'terminal-001', originNodeId: 'node-001'
    }, reports ? {
      executionTarget: 'SIMULATOR', reportConsent: 'ALLOW_SIMULATED_X_AND_Z'
    } : {});
    runtimes.push(runtime);
    const provisioned = await runtime.provisionInitialAdmin.execute({
      operatorCode: 'OP001', displayName: 'Operador', pin: '123456',
      permissions
    });
    expect(provisioned.ok).toBe(true);
    const app = buildApp(runtime.dependencies);
    apps.push(app);
    return { app, runtime };
  };

  const loginCookie = async (app: ReturnType<typeof buildApp>): Promise<string> => {
    const login = await app.inject({
      method: 'POST', url: '/api/v1/auth/session',
      payload: { operatorCode: 'OP001', pin: '123456' }
    });
    return String(login.headers['set-cookie']).split(';')[0]!;
  };

  it('authenticates without returning the opaque token in JSON', async () => {
    const { app } = await setup();
    const response = await app.inject({
      method: 'POST', url: '/api/v1/auth/session',
      payload: { operatorCode: 'OP001', pin: '123456' }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      displayName: 'Operador', roleCodes: ['ADMIN']
    });
    expect(response.body).not.toContain('token');
    expect(response.headers['set-cookie']).toContain('HttpOnly');
    expect(response.headers['set-cookie']).toContain('SameSite=Strict');
  });

  it('reports the effective permission codes of the session, ordered and without duplicates', async () => {
    const { app } = await setup();
    const login = await app.inject({
      method: 'POST', url: '/api/v1/auth/session',
      payload: { operatorCode: 'OP001', pin: '123456' }
    });
    const expected = [...new Set(ADMIN_PERMISSIONS)].sort();
    expect(login.json().permissionCodes).toEqual(expected);

    const recovered = await app.inject({
      method: 'GET', url: '/api/v1/auth/session',
      headers: { cookie: String(login.headers['set-cookie']).split(';')[0]! }
    });
    expect(recovered.json().permissionCodes).toEqual(expected);
  });

  it('reports an empty permission list rather than omitting the field when the actor has none', async () => {
    const { app } = await setup(false, []);
    const login = await app.inject({
      method: 'POST', url: '/api/v1/auth/session',
      payload: { operatorCode: 'OP001', pin: '123456' }
    });
    expect(login.json()).toHaveProperty('permissionCodes', []);
  });

  it('returns the same public problem for unknown operator and wrong PIN', async () => {
    const { app } = await setup();
    const responses = await Promise.all([
      app.inject({ method: 'POST', url: '/api/v1/auth/session', payload: {
        operatorCode: 'MISSING', pin: '123456'
      } }),
      app.inject({ method: 'POST', url: '/api/v1/auth/session', payload: {
        operatorCode: 'OP001', pin: '654321'
      } })
    ]);
    expect(responses.map((response) => ({
      status: response.statusCode, body: response.json()
    }))).toEqual([
      expect.objectContaining({ status: 401, body: expect.objectContaining({ code: 'AUTHENTICATION_FAILED' }) }),
      expect.objectContaining({ status: 401, body: expect.objectContaining({ code: 'AUTHENTICATION_FAILED' }) })
    ]);
  });

  it('rejects client attempts to supply trusted node identity', async () => {
    const { app } = await setup();
    const response = await app.inject({
      method: 'POST', url: '/api/v1/auth/session',
      payload: {
        operatorCode: 'OP001', pin: '123456',
        terminalId: 'attacker-terminal', originNodeId: 'attacker-node'
      }
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'HTTP_VALIDATION_FAILED' });
  });

  it('requires a session and derives capabilities from trusted startup configuration', async () => {
    const { app } = await setup(true);
    const unauthorized = await app.inject({ method: 'GET', url: '/api/v1/system/capabilities' });
    expect(unauthorized.statusCode).toBe(401);
    const login = await app.inject({
      method: 'POST', url: '/api/v1/auth/session',
      payload: { operatorCode: 'OP001', pin: '123456' }
    });
    const authorized = await app.inject({
      method: 'GET', url: '/api/v1/system/capabilities',
      headers: { cookie: String(login.headers['set-cookie']).split(';')[0]! }
    });
    expect(authorized.statusCode).toBe(200);
    expect(authorized.json()).toEqual({
      fiscalMode: 'SIMULATION', simulatedReportsEnabled: true
    });
  });

  it('does not register simulated X/Z routes without trusted startup consent', async () => {
    const { app, runtime } = await setup(false);
    const response = await app.inject({
      method: 'POST', url: '/api/v1/fiscal/reports/x',
      payload: {}
    });
    expect(response.statusCode).toBe(404);
    expect(runtime.fiscalPrinter.commands).toEqual([]);
  });

  it('requires request consent before executing a simulated fiscal report', async () => {
    const { app, runtime } = await setup(true);
    const response = await app.inject({
      method: 'POST', url: '/api/v1/fiscal/reports/x',
      headers: { cookie: await loginCookie(app), 'idempotency-key': 'x-report-001' },
      payload: { dayId: 'day-001', businessDate: '2026-09-01', reason: 'Corte de prueba' }
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'HTTP_VALIDATION_FAILED' });
    expect(runtime.fiscalPrinter.commands).toEqual([]);
  });

  it('executes an explicitly consented X report only in simulation mode', async () => {
    const { app } = await setup(true);
    const response = await app.inject({
      method: 'POST', url: '/api/v1/fiscal/reports/x',
      headers: { cookie: await loginCookie(app), 'idempotency-key': 'x-report-002' },
      payload: {
        dayId: 'day-002', businessDate: '2026-09-01', reason: 'Corte de prueba',
        simulationConsent: 'ALLOW_SIMULATED_X_AND_Z'
      }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      fiscalMode: 'SIMULATION', report: { type: 'X', status: 'ISSUED' }
    });
  });

  it('rejects a report without permission before calling the fake', async () => {
    const { app, runtime } = await setup(true, []);
    const response = await app.inject({
      method: 'POST', url: '/api/v1/fiscal/reports/z',
      headers: { cookie: await loginCookie(app), 'idempotency-key': 'z-report-001' },
      payload: {
        dayId: 'day-003', businessDate: '2026-09-01', reason: 'Cierre de prueba',
        simulationConsent: 'ALLOW_SIMULATED_X_AND_Z'
      }
    });
    expect(response.statusCode).toBe(403);
    expect(runtime.fiscalPrinter.commands).toEqual([]);
  });

  it('rejects a revoked session', async () => {
    const { app } = await setup();
    const cookie = await loginCookie(app);
    expect((await app.inject({
      method: 'DELETE', url: '/api/v1/auth/session', headers: { cookie }
    })).statusCode).toBe(204);
    const response = await app.inject({
      method: 'GET', url: '/api/v1/system/capabilities', headers: { cookie }
    });
    expect(response.statusCode).toBe(401);
  });
});
