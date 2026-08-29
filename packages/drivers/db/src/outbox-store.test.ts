import { describe, expect, it } from 'vitest';
import { application, type BusinessEventV1 } from '@supermarket/core';
import { openDatabase } from './connection.js';
import { applyMigrations } from './migrations.js';
import { DrizzleOutboxStore } from './outbox-store.js';
import { SqliteUnitOfWork } from './unit-of-work.js';

const event: BusinessEventV1 = {
  eventId: 'event-001', eventType: 'SaleCompleted', contractVersion: 1,
  aggregateId: 'sale-001', aggregateType: 'Sale', aggregateVersion: 5,
  originNodeId: 'node-001', correlationId: 'correlation-001', actorId: 'user-001',
  occurredAt: new Date('2026-08-29T10:00:00Z'), payload: { totalMinorUnits: 1000 }
};

describe('outbox delivery', () => {
  it('survives commit, retries safely and publishes without holding a transaction', async () => {
    const handle = openDatabase(':memory:');
    applyMigrations(handle.sqlite);
    const store = new DrizzleOutboxStore(handle);
    const unitOfWork = new SqliteUnitOfWork(handle.sqlite);
    await unitOfWork.execute(() => store.enqueue([event, event]));

    let now = new Date('2026-08-29T10:00:00Z');
    let attempts = 0;
    const relay = new application.OutboxRelay(
      store,
      { publish: async () => {
        expect(handle.sqlite.inTransaction).toBe(false);
        attempts += 1;
        if (attempts === 1) throw new Error('Network unavailable.');
      } },
      unitOfWork,
      { now: () => now }
    );

    expect(await relay.runBatch()).toBe(1);
    expect(handle.sqlite.prepare('select status, attempts, last_error from outbox_event').get())
      .toEqual({ status: 'PENDING', attempts: 1, last_error: 'EVENT_PUBLICATION_FAILED' });
    now = new Date('2026-08-29T10:00:02Z');
    expect(await relay.runBatch()).toBe(1);
    expect(handle.sqlite.prepare('select status, attempts from outbox_event').get())
      .toEqual({ status: 'PUBLISHED', attempts: 2 });
    handle.close();
  });

  it('reclaims an event after its processing lease expires', async () => {
    const handle = openDatabase(':memory:');
    applyMigrations(handle.sqlite);
    const store = new DrizzleOutboxStore(handle);
    const unitOfWork = new SqliteUnitOfWork(handle.sqlite);
    await unitOfWork.execute(() => store.enqueue([event]));
    await unitOfWork.execute(() => store.claimAvailable(
      new Date('2026-08-29T10:00:00Z'),
      new Date('2026-08-29T10:00:30Z'),
      1
    ));
    expect(await unitOfWork.execute(() => store.claimAvailable(
      new Date('2026-08-29T10:00:31Z'),
      new Date('2026-08-29T10:01:01Z'),
      1
    ))).toHaveLength(1);
    handle.close();
  });
});
