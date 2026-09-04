import { afterEach, describe, expect, it } from 'vitest';
import { applyMigrations } from './migrations.js';
import { openDatabase, type DatabaseHandle } from './connection.js';
import { SqliteAuthenticationStore, SqliteAuthorizationService } from './authentication-store.js';

describe('SQLite authentication store', () => {
  const handles: DatabaseHandle[] = [];

  afterEach(() => {
    for (const handle of handles.splice(0)) handle.close();
  });

  const setup = async () => {
    const handle = openDatabase(':memory:');
    handles.push(handle);
    applyMigrations(handle.sqlite);
    const store = new SqliteAuthenticationStore(handle);
    await store.provisionInitialAdmin({
      userId: 'user-001', roleId: 'role-admin', operatorCode: 'OP001',
      displayName: 'Operador', pinHash: 'encoded', permissions: ['sale.void'],
      now: new Date(0)
    });
    return { handle, store };
  };

  it('atomically locks five concurrent failures per operator and node', async () => {
    const { handle, store } = await setup();
    await Promise.all(Array.from({ length: 5 }, () => store.completeAttempt({
      userId: 'user-001', credentialVersion: 1, pinVerified: false,
      terminalId: 'terminal-001', originNodeId: 'node-001', now: new Date(1_000)
    })));
    expect(handle.sqlite.prepare(`
      select failed_count as failedCount, locked_until as lockedUntil
      from auth_lockouts where origin_node_id = 'node-001' and user_id = 'user-001'
    `).get()).toEqual({ failedCount: 5, lockedUntil: 901_000 });

    await expect(store.completeAttempt({
      userId: 'user-001', credentialVersion: 1, pinVerified: true,
      tokenHash: 'blocked-token', terminalId: 'terminal-001', originNodeId: 'node-001',
      now: new Date(2_000), idleExpiresAt: new Date(3_000), absoluteExpiresAt: new Date(4_000)
    })).resolves.toEqual({ authenticated: false });
    expect(handle.sqlite.prepare('select count(*) from auth_sessions').pluck().get()).toBe(0);
  });

  it('creates, touches and revokes a session while using current permissions', async () => {
    const { store } = await setup();
    const completion = await store.completeAttempt({
      userId: 'user-001', credentialVersion: 1, pinVerified: true,
      tokenHash: 'token-hash', terminalId: 'terminal-001', originNodeId: 'node-001',
      now: new Date(1_000), idleExpiresAt: new Date(1_801_000),
      absoluteExpiresAt: new Date(28_801_000)
    });
    expect(completion.authenticated).toBe(true);
    const principal = await store.verifyAndTouchSession('token-hash', new Date(2_000));
    expect(principal).toMatchObject({
      actorId: 'user-001', roleCodes: ['ADMIN'], permissionCodes: ['sale.void'],
      terminalId: 'terminal-001', originNodeId: 'node-001'
    });
    const authorization = new SqliteAuthorizationService(store);
    await expect(authorization.authorize({
      actorId: 'user-001', terminalId: 'terminal-001', originNodeId: 'node-001',
      correlationId: 'corr-1'
    }, 'sale.void')).resolves.toBe(true);
    await store.revokeSession('token-hash', new Date(3_000));
    await expect(store.verifyAndTouchSession('token-hash', new Date(4_000))).resolves.toBeNull();
  });

  it('invalidates sessions after authorization version changes', async () => {
    const { handle, store } = await setup();
    await store.completeAttempt({
      userId: 'user-001', credentialVersion: 1, pinVerified: true,
      tokenHash: 'token-hash', terminalId: 'terminal-001', originNodeId: 'node-001',
      now: new Date(1_000), idleExpiresAt: new Date(2_000), absoluteExpiresAt: new Date(3_000)
    });
    handle.sqlite.prepare(
      'update identity_users set authorization_version = authorization_version + 1 where id = ?'
    ).run('user-001');
    await expect(store.verifyAndTouchSession('token-hash', new Date(1_500))).resolves.toBeNull();
  });

  it.each([
    { idleExpiresAt: 2_000, absoluteExpiresAt: 9_000, now: 2_000 },
    { idleExpiresAt: 2_000, absoluteExpiresAt: 2_000, now: 2_000 }
  ])('rejects idle or absolute expiration atomically', async ({ idleExpiresAt, absoluteExpiresAt, now }) => {
    const { handle, store } = await setup();
    await store.completeAttempt({
      userId: 'user-001', credentialVersion: 1, pinVerified: true,
      tokenHash: 'expired-token', terminalId: 'terminal-001', originNodeId: 'node-001',
      now: new Date(1_000), idleExpiresAt: new Date(idleExpiresAt),
      absoluteExpiresAt: new Date(absoluteExpiresAt)
    });
    await expect(store.verifyAndTouchSession('expired-token', new Date(now))).resolves.toBeNull();
    expect(handle.sqlite.prepare(
      'select revoked_at from auth_sessions where token_hash = ?'
    ).get('expired-token')).toEqual({ revoked_at: now });
  });
});
