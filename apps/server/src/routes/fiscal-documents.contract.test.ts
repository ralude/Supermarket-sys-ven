import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { ADMIN_PERMISSIONS, createSecurityRuntime, type SecurityRuntime } from '../runtime.ts';

describe('simulated fiscal document HTTP contracts', () => {
  const runtimes: SecurityRuntime[] = [];
  const apps: ReturnType<typeof buildApp>[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
    for (const runtime of runtimes.splice(0)) if (runtime.handle.sqlite.open) runtime.handle.close();
  });

  it('issues, replays and reads a document explicitly labeled as simulation', async () => {
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
    const cookie = String(login.headers['set-cookie']).split(';')[0]!;
    const payload = {
      content: {
        referenceId: 'sale-001', type: 'INVOICE', currencyCode: 'USD',
        lines: [{
          id: 'line-001', description: 'Café', quantityScaled: 1, quantityScale: 0,
          unitPriceMinorUnits: 1000, taxRateBasisPoints: 0, totalMinorUnits: 1000
        }],
        payments: [{ methodCode: 'CASH_USD', amountMinorUnits: 1000 }],
        totalMinorUnits: 1000
      },
      reason: 'Simulación contractual'
    };
    const request = () => app.inject({
      method: 'POST', url: '/api/v1/fiscal/documents',
      headers: { cookie, 'idempotency-key': 'fiscal-document-001' }, payload
    });
    const issued = await request();
    expect(issued.statusCode).toBe(201);
    expect(issued.json()).toMatchObject({
      fiscalMode: 'SIMULATION', document: { status: 'ISSUED' }
    });
    const replay = await request();
    expect(replay.statusCode).toBe(201);
    expect(replay.json()).toEqual(issued.json());

    const documentId = issued.json<{ document: { id: string } }>().document.id;
    const read = await app.inject({
      method: 'GET', url: `/api/v1/fiscal/documents/${documentId}`, headers: { cookie }
    });
    expect(read.statusCode).toBe(200);
    expect(read.json()).toEqual(issued.json());
    expect(runtime.fiscalPrinter.commands.filter(({ name }) => name === 'OPEN')).toHaveLength(1);
  });
});
