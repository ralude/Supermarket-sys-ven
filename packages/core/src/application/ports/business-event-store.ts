import type { BusinessEventV1 } from '../events/business-event.js';

export interface BusinessEventStore {
  append(events: readonly BusinessEventV1[]): Promise<void>;
  findByAggregate(aggregateType: string, aggregateId: string): Promise<readonly BusinessEventV1[]>;
}
