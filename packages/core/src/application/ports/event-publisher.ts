import type { BusinessEventV1 } from '../events/index.js';

export interface EventPublisher {
  publish(event: BusinessEventV1): Promise<void>;
}
