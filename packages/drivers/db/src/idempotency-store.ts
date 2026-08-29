import type { IdempotencyRecord, IdempotencyStore, JsonValue } from '@supermarket/core';
import { and, eq, gt } from 'drizzle-orm';
import type { DatabaseHandle } from './connection.js';
import { idempotencyKeys } from './schema.js';
import { mapDatabaseError, requireTransaction } from './unit-of-work.js';

export class DrizzleIdempotencyStore implements IdempotencyStore {
  constructor(private readonly handle: DatabaseHandle) {}

  async find(scope: string, key: string, at: Date): Promise<IdempotencyRecord | null> {
    try {
      const row = this.handle.db.select().from(idempotencyKeys).where(and(
        eq(idempotencyKeys.scope, scope),
        eq(idempotencyKeys.key, key),
        gt(idempotencyKeys.expiresAt, at.getTime())
      )).get();
      return row ? {
        scope: row.scope,
        key: row.key,
        requestFingerprint: row.requestFingerprint,
        status: 'COMPLETED',
        result: JSON.parse(row.result) as JsonValue,
        createdAt: new Date(row.createdAt),
        expiresAt: new Date(row.expiresAt)
      } : null;
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  async save(record: IdempotencyRecord): Promise<void> {
    requireTransaction(this.handle.sqlite);
    try {
      this.handle.db.insert(idempotencyKeys).values({
        scope: record.scope,
        key: record.key,
        requestFingerprint: record.requestFingerprint,
        status: record.status,
        result: JSON.stringify(record.result),
        createdAt: record.createdAt.getTime(),
        expiresAt: record.expiresAt.getTime()
      }).run();
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }
}
