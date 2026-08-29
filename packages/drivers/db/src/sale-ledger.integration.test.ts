import { describe, expect, it } from 'vitest';
import { application, type BusinessEventStore } from '@supermarket/core';
import { InfrastructureError } from '@supermarket/shared';
import { DrizzleBusinessEventStore } from './business-event-store.js';
import { openDatabase } from './connection.js';
import { applyMigrations } from './migrations.js';
import { DrizzleSaleRepository } from './repositories.js';
import { SqliteUnitOfWork } from './unit-of-work.js';

const context = {
  actorId: 'user-001',
  terminalId: 'terminal-001',
  originNodeId: 'node-001',
  correlationId: 'correlation-001'
};

describe('sale and ledger transaction', () => {
  it('commits relational state and its business event together', async () => {
    const handle = openDatabase(':memory:');
    applyMigrations(handle.sqlite);
    const sales = new DrizzleSaleRepository(handle);
    const events = new DrizzleBusinessEventStore(handle);
    const useCase = new application.StartSale(
      { generate: () => 'sale-001' },
      { generate: () => 'event-001' },
      sales,
      { now: () => new Date('2026-08-29T10:00:00Z') },
      new SqliteUnitOfWork(handle.sqlite),
      events
    );

    expect((await useCase.execute({ currencyCode: 'USD' }, context)).ok).toBe(true);
    expect((await sales.findById('sale-001'))?.status).toBe('DRAFT');
    expect(await events.findByAggregate('Sale', 'sale-001')).toMatchObject([{
      eventId: 'event-001', eventType: 'SaleStarted', originNodeId: 'node-001'
    }]);
    handle.close();
  });

  it('rolls relational state back when ledger persistence fails', async () => {
    const handle = openDatabase(':memory:');
    applyMigrations(handle.sqlite);
    const sales = new DrizzleSaleRepository(handle);
    const failingEvents: BusinessEventStore = {
      append: async () => {
        throw new InfrastructureError('DATABASE_OPERATION_FAILED', 'Injected failure.');
      },
      findByAggregate: async () => []
    };
    const useCase = new application.StartSale(
      { generate: () => 'sale-001' },
      { generate: () => 'event-001' },
      sales,
      { now: () => new Date('2026-08-29T10:00:00Z') },
      new SqliteUnitOfWork(handle.sqlite),
      failingEvents
    );

    await expect(useCase.execute({ currencyCode: 'USD' }, context))
      .rejects.toMatchObject({ code: 'DATABASE_OPERATION_FAILED' });
    expect(await sales.findById('sale-001')).toBeNull();
    handle.close();
  });
});
