import type { BusinessEventStore, BusinessEventV1, JsonValue } from '@supermarket/core';
import { and, asc, eq } from 'drizzle-orm';
import type { DatabaseHandle } from './connection.js';
import { businessEvents } from './schema.js';
import { mapDatabaseError, requireTransaction } from './unit-of-work.js';

export class DrizzleBusinessEventStore implements BusinessEventStore {
  constructor(private readonly handle: DatabaseHandle) {}

  async append(events: readonly BusinessEventV1[]): Promise<void> {
    requireTransaction(this.handle.sqlite);
    if (events.length === 0) return;
    try {
      this.handle.db.insert(businessEvents).values(events.map((event) => ({
        ...event,
        occurredAt: event.occurredAt.getTime(),
        payload: JSON.stringify(event.payload)
      }))).onConflictDoNothing({ target: businessEvents.eventId }).run();
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  async findByAggregate(
    aggregateType: string,
    aggregateId: string
  ): Promise<readonly BusinessEventV1[]> {
    try {
      return this.handle.db.select().from(businessEvents).where(and(
        eq(businessEvents.aggregateType, aggregateType),
        eq(businessEvents.aggregateId, aggregateId)
      )).orderBy(asc(businessEvents.aggregateVersion)).all().map((row) => ({
        ...row,
        contractVersion: 1,
        occurredAt: new Date(row.occurredAt),
        payload: JSON.parse(row.payload) as JsonValue
      }));
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }
}
