import { describe, expect, it } from 'vitest';
import { DrizzleIdempotencyStore } from './idempotency-store.js';
import { openDatabase } from './connection.js';
import { applyMigrations } from './migrations.js';
import { SqliteUnitOfWork } from './unit-of-work.js';

describe('DrizzleIdempotencyStore', () => {
  it('survives repository recreation and ignores expired results', async () => {
    const handle = openDatabase(':memory:');
    applyMigrations(handle.sqlite);
    const unitOfWork = new SqliteUnitOfWork(handle.sqlite);
    await unitOfWork.execute(() => new DrizzleIdempotencyStore(handle).save({
      scope: 'node-001:CompleteSale',
      key: 'complete-001',
      requestFingerprint: '{"saleId":"sale-001"}',
      status: 'COMPLETED',
      result: { id: 'sale-001', status: 'COMPLETED' },
      createdAt: new Date('2026-08-29T10:00:00Z'),
      expiresAt: new Date('2026-09-28T10:00:00Z')
    }));

    const recreated = new DrizzleIdempotencyStore(handle);
    expect((await recreated.find(
      'node-001:CompleteSale', 'complete-001', new Date('2026-08-30T10:00:00Z')
    ))?.result).toEqual({ id: 'sale-001', status: 'COMPLETED' });
    expect(await recreated.find(
      'node-001:CompleteSale', 'complete-001', new Date('2026-09-29T10:00:00Z')
    )).toBeNull();
    handle.close();
  });

  it('requires UnitOfWork and rejects duplicate keys', async () => {
    const handle = openDatabase(':memory:');
    applyMigrations(handle.sqlite);
    const store = new DrizzleIdempotencyStore(handle);
    const record = {
      scope: 'node-001:CompleteSale', key: 'complete-001', requestFingerprint: 'one',
      status: 'COMPLETED' as const,
      result: { ok: true } as const, createdAt: new Date('2026-08-29T10:00:00Z'),
      expiresAt: new Date('2026-09-28T10:00:00Z')
    };
    await expect(store.save(record)).rejects.toMatchObject({ code: 'DATABASE_TRANSACTION_REQUIRED' });
    const unitOfWork = new SqliteUnitOfWork(handle.sqlite);
    await unitOfWork.execute(() => store.save(record));
    await expect(unitOfWork.execute(() => store.save(record)))
      .rejects.toMatchObject({ code: 'DATABASE_CONSTRAINT_VIOLATION' });
    handle.close();
  });
});
