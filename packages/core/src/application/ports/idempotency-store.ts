import type { JsonValue } from '../events/index.js';

export type IdempotencyRecord = {
  readonly scope: string;
  readonly key: string;
  readonly requestFingerprint: string;
  readonly status: 'COMPLETED';
  readonly result: JsonValue;
  readonly createdAt: Date;
  readonly expiresAt: Date;
};

export interface IdempotencyStore {
  find(scope: string, key: string, at: Date): Promise<IdempotencyRecord | null>;
  save(record: IdempotencyRecord): Promise<void>;
}
