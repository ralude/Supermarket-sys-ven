import { afterEach, describe, expect, it } from 'vitest';
import type { UpdateExchangeRateRequest } from '@supermarket/shared';
import { buildApp } from '../app.ts';
import { ADMIN_PERMISSIONS, createSecurityRuntime, type SecurityRuntime } from '../runtime.ts';

const rate = (validFrom: string, rateValue: number): UpdateExchangeRateRequest => ({
  baseCurrency: 'USD', quoteCurrency: 'VES', rateValue, rateScale: 3,
  source: 'Carga manual confirmada', validFrom, validUntil: null,
  reason: 'Tasa confirmada por supervisor'
});

describe('exchange rate history and suggestion HTTP contracts', () => {
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
      operatorCode: 'OP001', displayName: 'Operador', pin: '123456', permissions: ADMIN_PERMISSIONS
    });
    const app = buildApp(runtime.dependencies);
    apps.push(app);
    const login = await app.inject({
      method: 'POST', url: '/api/v1/auth/session',
      payload: { operatorCode: 'OP001', pin: '123456' }
    });
    return { app, runtime, cookie: String(login.headers['set-cookie']).split(';')[0]! };
  };

  it('projects local history for a pair with a deterministic descending order', async () => {
    const { app, cookie } = await setup();
    for (const [key, payload] of [
      ['rate-history-001', rate('2026-09-01T00:00:00.000Z', 36000)],
      ['rate-history-002', rate('2026-09-02T00:00:00.000Z', 36500)],
      ['rate-history-003', rate('2026-09-03T00:00:00.000Z', 37000)]
    ] as const) {
      const created = await app.inject({
        method: 'POST', url: '/api/v1/currency/exchange-rates',
        headers: { cookie, 'idempotency-key': key }, payload
      });
      expect(created.statusCode).toBe(201);
    }

    const full = await app.inject({
      method: 'GET',
      url: '/api/v1/currency/exchange-rates?baseCurrency=USD&quoteCurrency=VES',
      headers: { cookie }
    });
    expect(full.statusCode).toBe(200);
    expect(full.json<{ rateValue: number }[]>().map((entry) => entry.rateValue))
      .toEqual([37000, 36500, 36000]);

    const limited = await app.inject({
      method: 'GET',
      url: '/api/v1/currency/exchange-rates?baseCurrency=USD&quoteCurrency=VES&limit=2',
      headers: { cookie }
    });
    expect(limited.statusCode).toBe(200);
    expect(limited.json<{ rateValue: number }[]>().map((entry) => entry.rateValue))
      .toEqual([37000, 36500]);
  });

  it('rejects a history limit outside the approved range before touching SQLite', async () => {
    const { app, cookie } = await setup();

    const tooHigh = await app.inject({
      method: 'GET',
      url: '/api/v1/currency/exchange-rates?baseCurrency=USD&quoteCurrency=VES&limit=501',
      headers: { cookie }
    });

    expect(tooHigh.statusCode).toBe(400);
    expect(tooHigh.json()).toMatchObject({ code: 'HTTP_VALIDATION_FAILED' });
  });

  it('requires a verified session to read history but no additional permission', async () => {
    const { app } = await setup();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/currency/exchange-rates?baseCurrency=USD&quoteCurrency=VES'
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('fails closed on a suggestion request when no external provider is configured, writing nothing', async () => {
    const { app, runtime, cookie } = await setup();
    const before = runtime.handle.sqlite.prepare('select count(*) from exchange_rates').pluck().get();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/currency/exchange-rates/suggestion?baseCurrency=USD&quoteCurrency=VES',
      headers: { cookie }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'EXCHANGE_RATE_PROVIDER_NOT_CONFIGURED' });
    const after = runtime.handle.sqlite.prepare('select count(*) from exchange_rates').pluck().get();
    expect(after).toBe(before);
  });

  it('requires a verified session to request a suggestion', async () => {
    const { app } = await setup();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/currency/exchange-rates/suggestion?baseCurrency=USD&quoteCurrency=VES'
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
