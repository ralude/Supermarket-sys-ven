import { describe, expect, it } from 'vitest';
import type { AuditEntry } from '@supermarket/core';
import { DrizzleAuditWriter } from './audit-writer.js';
import { openDatabase } from './connection.js';
import { applyMigrations } from './migrations.js';
import { SqliteUnitOfWork } from './unit-of-work.js';

const entry: AuditEntry = {
  auditId: 'audit-001', actorId: 'user-001', actorRoleCodes: ['MANAGER'],
  action: 'SALE_VOIDED', entityType: 'Sale', entityId: 'sale-001',
  before: { status: 'DRAFT' },
  after: { status: 'VOIDED', token: 'secret-token', nested: { pin: '1234', safe: 'visible' } },
  reason: 'Customer request', terminalId: 'terminal-001', originNodeId: 'node-001',
  occurredAt: new Date('2026-08-29T10:00:00Z'), correlationId: 'correlation-001'
};

describe('DrizzleAuditWriter', () => {
  it('stores append-only evidence and redacts sensitive values', async () => {
    const handle = openDatabase(':memory:');
    applyMigrations(handle.sqlite);
    const writer = new DrizzleAuditWriter(handle);
    const unitOfWork = new SqliteUnitOfWork(handle.sqlite);
    await unitOfWork.execute(() => writer.append([entry]));

    const row = handle.sqlite.prepare(
      'select actor_role_codes, after_state, reason from audit_log where audit_id = ?'
    ).get('audit-001') as { actor_role_codes: string; after_state: string; reason: string };
    expect(JSON.parse(row.actor_role_codes)).toEqual(['MANAGER']);
    expect(JSON.parse(row.after_state)).toEqual({
      status: 'VOIDED', token: '[REDACTED]', nested: { pin: '[REDACTED]', safe: 'visible' }
    });
    expect(row.reason).toBe('Customer request');
    expect(() => handle.sqlite.prepare('update audit_log set reason = ?').run('Changed')).toThrow();
    expect(() => handle.sqlite.prepare('delete from audit_log').run()).toThrow();
    handle.close();
  });

  it('rejects writes outside UnitOfWork', async () => {
    const handle = openDatabase(':memory:');
    applyMigrations(handle.sqlite);
    await expect(new DrizzleAuditWriter(handle).append([entry]))
      .rejects.toMatchObject({ code: 'DATABASE_TRANSACTION_REQUIRED' });
    handle.close();
  });
});
