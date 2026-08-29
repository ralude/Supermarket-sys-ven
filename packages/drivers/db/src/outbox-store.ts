import type { BusinessEventV1, JsonValue, OutboxEvent, OutboxStore } from '@supermarket/core';
import { and, asc, eq, lte, or } from 'drizzle-orm';
import type { DatabaseHandle } from './connection.js';
import { outboxEvents } from './schema.js';
import { mapDatabaseError, requireTransaction } from './unit-of-work.js';

export class DrizzleOutboxStore implements OutboxStore {
  constructor(private readonly handle: DatabaseHandle) {}

  async enqueue(events: readonly BusinessEventV1[]): Promise<void> {
    requireTransaction(this.handle.sqlite);
    if (events.length === 0) return;
    try {
      this.handle.db.insert(outboxEvents).values(events.map((event) => ({
        ...event,
        occurredAt: event.occurredAt.getTime(),
        payload: JSON.stringify(event.payload),
        status: 'PENDING',
        attempts: 0,
        nextAttemptAt: event.occurredAt.getTime(),
        leaseUntil: null,
        lastError: null,
        publishedAt: null,
        createdAt: event.occurredAt.getTime()
      }))).onConflictDoNothing({ target: outboxEvents.eventId }).run();
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  async claimAvailable(now: Date, leaseUntil: Date, limit: number): Promise<readonly OutboxEvent[]> {
    requireTransaction(this.handle.sqlite);
    try {
      const rows = this.handle.db.select().from(outboxEvents).where(or(
        and(eq(outboxEvents.status, 'PENDING'), lte(outboxEvents.nextAttemptAt, now.getTime())),
        and(eq(outboxEvents.status, 'PROCESSING'), lte(outboxEvents.leaseUntil, now.getTime()))
      )).orderBy(asc(outboxEvents.createdAt)).limit(limit).all();
      for (const row of rows) {
        this.handle.db.update(outboxEvents).set({
          status: 'PROCESSING',
          attempts: row.attempts + 1,
          leaseUntil: leaseUntil.getTime()
        }).where(eq(outboxEvents.eventId, row.eventId)).run();
      }
      return rows.map((row) => ({
        eventId: row.eventId,
        eventType: row.eventType,
        contractVersion: 1,
        aggregateId: row.aggregateId,
        aggregateType: row.aggregateType,
        aggregateVersion: row.aggregateVersion,
        originNodeId: row.originNodeId,
        correlationId: row.correlationId,
        actorId: row.actorId,
        occurredAt: new Date(row.occurredAt),
        payload: JSON.parse(row.payload) as JsonValue,
        status: 'PROCESSING',
        attempts: row.attempts + 1
      }));
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  async markPublished(eventId: string, publishedAt: Date): Promise<void> {
    requireTransaction(this.handle.sqlite);
    this.handle.db.update(outboxEvents).set({
      status: 'PUBLISHED',
      publishedAt: publishedAt.getTime(),
      leaseUntil: null,
      lastError: null
    }).where(eq(outboxEvents.eventId, eventId)).run();
  }

  async markFailed(eventId: string, nextAttemptAt: Date, errorCode: string): Promise<void> {
    requireTransaction(this.handle.sqlite);
    this.handle.db.update(outboxEvents).set({
      status: 'PENDING',
      nextAttemptAt: nextAttemptAt.getTime(),
      leaseUntil: null,
      lastError: errorCode
    }).where(eq(outboxEvents.eventId, eventId)).run();
  }
}
