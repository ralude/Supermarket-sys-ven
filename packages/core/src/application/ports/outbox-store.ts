import type { BusinessEventV1 } from '../events/index.js';

export type OutboxEvent = BusinessEventV1 & {
  readonly status: 'PROCESSING';
  readonly attempts: number;
};

export interface OutboxStore {
  enqueue(events: readonly BusinessEventV1[]): Promise<void>;
  claimAvailable(now: Date, leaseUntil: Date, limit: number): Promise<readonly OutboxEvent[]>;
  markPublished(eventId: string, publishedAt: Date): Promise<void>;
  markFailed(eventId: string, nextAttemptAt: Date, errorCode: string): Promise<void>;
}
