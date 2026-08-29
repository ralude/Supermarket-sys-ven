import type { JsonValue } from '../events/index.js';

export type AuditEntry = {
  readonly auditId: string;
  readonly actorId: string;
  readonly actorRoleCodes: readonly string[];
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly before: JsonValue | null;
  readonly after: JsonValue | null;
  readonly reason: string;
  readonly terminalId: string;
  readonly originNodeId: string;
  readonly occurredAt: Date;
  readonly correlationId: string;
};

export interface AuditWriter {
  append(entries: readonly AuditEntry[]): Promise<void>;
}
