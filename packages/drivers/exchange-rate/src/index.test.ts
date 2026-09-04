import { describe, expect, it } from 'vitest';
import { HttpExchangeRateProvider, UnavailableExchangeRateProvider } from './index.js';

const response = (body: unknown, ok = true): Response => new Response(JSON.stringify(body), {
  status: ok ? 200 : 503,
  headers: { 'content-type': 'application/json' }
});

describe('exchange-rate driver', () => {
  it('normalizes a decimal string without using a floating rate', async () => {
    const provider = new HttpExchangeRateProvider({
      endpoint: 'https://rates.invalid/latest', source: 'test',
      fetcher: async () => response({ rate: '365.125', observedAt: '2026-09-03T12:00:00.000Z' })
    });
    const result = await provider.getSuggestedRate('USD', 'VES');
    expect(result).toEqual(expect.objectContaining({
      ok: true,
      value: expect.objectContaining({ rateValue: 365125, rateScale: 3 })
    }));
  });

  it('fails closed for network and malformed responses', async () => {
    const network = new HttpExchangeRateProvider({
      endpoint: 'https://rates.invalid/latest', source: 'test',
      fetcher: async () => { throw new Error('offline'); }
    });
    await expect(network.getSuggestedRate('USD', 'VES')).resolves.toEqual(
      expect.objectContaining({ ok: false, error: expect.objectContaining({ code: 'NETWORK_UNAVAILABLE' }) })
    );
    const malformed = new HttpExchangeRateProvider({
      endpoint: 'https://rates.invalid/latest', source: 'test',
      fetcher: async () => response({ rate: 36.5 })
    });
    await expect(malformed.getSuggestedRate('USD', 'VES')).resolves.toEqual(
      expect.objectContaining({ ok: false, error: expect.objectContaining({ code: 'EXCHANGE_RATE_PROVIDER_INVALID_RESPONSE' }) })
    );
  });

  it('reports an unconfigured provider without touching persistence', async () => {
    await expect(new UnavailableExchangeRateProvider().getSuggestedRate('USD', 'VES'))
      .resolves.toEqual(expect.objectContaining({ ok: false, error: expect.objectContaining({ code: 'EXCHANGE_RATE_PROVIDER_NOT_CONFIGURED' }) }));
  });
});
