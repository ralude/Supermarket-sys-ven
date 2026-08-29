import { describe, expect, it } from 'vitest';
import type { BusinessEventV1 } from '@supermarket/core';
import { openDatabase } from './connection.js';
import { DrizzleBusinessEventStore } from './business-event-store.js';
import { applyMigrations } from './migrations.js';
import { SqliteUnitOfWork } from './unit-of-work.js';

const event = (version: number): BusinessEventV1 => ({
  eventId: `event-${version}`,
  eventType: version === 1 ? 'SaleStarted' : 'SaleItemAdded',
  contractVersion: 1,
  aggregateId: 'sale-001',
  aggregateType: 'Sale',
  aggregateVersion: version,
  originNodeId: 'node-001',
  correlationId: 'correlation-001',
  actorId: 'user-001',
  occurredAt: new Date(`2026-08-29T10:0${version}:00Z`),
  payload: { version }
});

describe('DrizzleBusinessEventStore', () => {
  it('appends, deduplicates and reads events in aggregate-version order', async () => {
    const handle = openDatabase(':memory:');
    applyMigrations(handle.sqlite);
    const store = new DrizzleBusinessEventStore(handle);
    const unitOfWork = new SqliteUnitOfWork(handle.sqlite);
    await unitOfWork.execute(() => store.append([event(2), event(1), event(1)]));

    const stored = await store.findByAggregate('Sale', 'sale-001');
    expect(stored.map((item) => item.aggregateVersion)).toEqual([1, 2]);
    expect(stored[0]?.occurredAt).toEqual(new Date('2026-08-29T10:01:00Z'));
    expect(stored[0]?.payload).toEqual({ version: 1 });
    handle.close();
  });

  it('requires a transaction and rolls ledger writes back with business state', async () => {
    const handle = openDatabase(':memory:');
    applyMigrations(handle.sqlite);
    const store = new DrizzleBusinessEventStore(handle);
    await expect(store.append([event(1)]))
      .rejects.toMatchObject({ code: 'DATABASE_TRANSACTION_REQUIRED' });
    const unitOfWork = new SqliteUnitOfWork(handle.sqlite);
    await expect(unitOfWork.execute(async () => {
      await store.append([event(1)]);
      throw new Error('Injected failure.');
    })).rejects.toMatchObject({ code: 'DATABASE_OPERATION_FAILED' });
    expect(await store.findByAggregate('Sale', 'sale-001')).toEqual([]);
    handle.close();
  });

  it('rejects update and delete at the SQLite boundary', async () => {
    const handle = openDatabase(':memory:');
    applyMigrations(handle.sqlite);
    const store = new DrizzleBusinessEventStore(handle);
    await new SqliteUnitOfWork(handle.sqlite).execute(() => store.append([event(1)]));
    expect(() => handle.sqlite.prepare('update business_event set event_type = ?').run('Changed'))
      .toThrow();
    expect(() => handle.sqlite.prepare('delete from business_event').run()).toThrow();
    handle.close();
  });
});
