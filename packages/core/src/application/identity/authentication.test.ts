import { describe, expect, it } from 'vitest';
import type { Clock } from '../ports/clock.js';
import {
  AuthenticateOperator,
  type AuthenticationStore,
  type PinHasher,
  type SessionTokenService
} from './authentication.js';

describe('AuthenticateOperator', () => {
  const clock: Clock = { now: () => new Date(1_000) };
  const tokens: SessionTokenService = {
    generate: () => ({ raw: 'raw-token', hash: 'token-hash' }),
    hash: (raw) => `hash:${raw}`
  };

  it('uses dummy verification and same public error for an unknown operator', async () => {
    let dummyCalls = 0;
    const store = { findByOperatorCode: async () => null } as unknown as AuthenticationStore;
    const hasher: PinHasher = {
      hash: async () => 'hash', verify: async () => false,
      verifyDummy: async () => { dummyCalls += 1; }
    };
    const result = await new AuthenticateOperator(store, hasher, tokens, clock).execute({
      operatorCode: 'missing', pin: '123456', terminalId: 'terminal-001', originNodeId: 'node-001'
    });
    expect(result).toEqual(expect.objectContaining({
      ok: false, error: expect.objectContaining({ code: 'AUTHENTICATION_FAILED' })
    }));
    expect(dummyCalls).toBe(1);
  });
});

