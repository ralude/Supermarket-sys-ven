import type { AuditEntry, AuditWriter, JsonValue } from '@supermarket/core';
import type { DatabaseHandle } from './connection.js';
import { auditLogs } from './schema.js';
import { mapDatabaseError, requireTransaction } from './unit-of-work.js';

const sensitiveKey = /password|pin|token|secret|card.?number|\bpan\b/i;

const redact = (value: JsonValue): JsonValue => {
  if (Array.isArray(value)) return value.map(redact);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    sensitiveKey.test(key) ? '[REDACTED]' : redact(entry)
  ]));
};

export class DrizzleAuditWriter implements AuditWriter {
  constructor(private readonly handle: DatabaseHandle) {}

  async append(entries: readonly AuditEntry[]): Promise<void> {
    requireTransaction(this.handle.sqlite);
    if (entries.length === 0) return;
    try {
      this.handle.db.insert(auditLogs).values(entries.map((entry) => ({
        auditId: entry.auditId,
        actorId: entry.actorId,
        actorRoleCodes: JSON.stringify(entry.actorRoleCodes),
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        beforeState: entry.before === null ? null : JSON.stringify(redact(entry.before)),
        afterState: entry.after === null ? null : JSON.stringify(redact(entry.after)),
        reason: entry.reason,
        terminalId: entry.terminalId,
        originNodeId: entry.originNodeId,
        occurredAt: entry.occurredAt.getTime(),
        correlationId: entry.correlationId
      }))).run();
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }
}
