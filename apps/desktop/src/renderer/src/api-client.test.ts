import { describe, expect, it, vi } from 'vitest';
import { ApiProblemError, createDesktopApi, parseMinorUnits } from './api-client.js';

describe('desktop HTTP client', () => {
  it('recovers the current session with cookies and shared JSON contracts', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      actorId: 'user-1',
      displayName: 'Operador Uno',
      roleCodes: ['cashier'],
      permissionCodes: [],
      idleExpiresAt: '2026-09-02T18:00:00.000Z',
      absoluteExpiresAt: '2026-09-03T00:00:00.000Z'
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const api = createDesktopApi(fetcher as typeof fetch);

    const session = await api.currentSession();

    expect(session.displayName).toBe('Operador Uno');
    expect(fetcher).toHaveBeenCalledWith('/api/v1/auth/session', expect.objectContaining({
      method: 'GET',
      credentials: 'include',
      headers: expect.objectContaining({ accept: 'application/json' })
    }));
  });

  it('sends login input as JSON without exposing a token contract', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      actorId: 'user-1',
      displayName: 'Operador Uno',
      roleCodes: ['cashier'],
      permissionCodes: [],
      idleExpiresAt: '2026-09-02T18:00:00.000Z',
      absoluteExpiresAt: '2026-09-03T00:00:00.000Z'
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const api = createDesktopApi(fetcher as typeof fetch);

    const session = await api.login({ operatorCode: 'OP-01', pin: '123456' });

    expect(session).not.toHaveProperty('token');
    expect(fetcher).toHaveBeenCalledWith('/api/v1/auth/session', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ operatorCode: 'OP-01', pin: '123456' })
    }));
  });

  it('preserves the public problem envelope on HTTP errors', async () => {
    const problem = {
      type: 'urn:supermarket:problem:unauthorized',
      title: 'Session is invalid.',
      status: 401,
      code: 'UNAUTHORIZED',
      correlationId: 'correlation-1'
    };
    const fetcher = vi.fn(async () => new Response(JSON.stringify(problem), {
      status: 401,
      headers: { 'content-type': 'application/problem+json' }
    }));

    await expect(createDesktopApi(fetcher as typeof fetch).currentSession())
      .rejects.toEqual(new ApiProblemError(problem));
  });

  it('accepts an empty logout response', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));

    await expect(createDesktopApi(fetcher as typeof fetch).logout()).resolves.toBeUndefined();
  });

  it('uses the shared sales path and idempotency key for a mutation', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      id: 'sale-1', status: 'DRAFT'
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const api = createDesktopApi(fetcher as typeof fetch);

    await api.addSaleItem('sale/1', {
      barcode: '759000000001', quantityScaled: 1, quantityScale: 0
    }, 'intent-1');

    expect(fetcher).toHaveBeenCalledWith('/api/v1/sales/sale%2F1/items', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'idempotency-key': 'intent-1' })
    }));
  });

  it('parses decimal input into integer minor units without floating point', () => {
    expect(parseMinorUnits('12,30', 2)).toBe(1230);
    expect(parseMinorUnits('12', 2)).toBe(1200);
    expect(() => parseMinorUnits('12.345', 2)).toThrow('MONEY_INPUT_SCALE');
    expect(() => parseMinorUnits('12.3x', 2)).toThrow('MONEY_INPUT_INVALID');
  });
});
