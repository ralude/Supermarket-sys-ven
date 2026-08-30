import type { Quantity } from '@supermarket/shared';
import type { StockMovementType } from './stock-movement.js';

export type StockMovementRegisteredEvent = {
  type: 'StockMovementRegistered';
  eventId: string;
  aggregateId: string;
  aggregateType: 'StockItem';
  aggregateVersion: number;
  occurredAt: Date;
  payload: {
    productId: string;
    movementId: string;
    movementType: StockMovementType;
    quantity: Quantity;
    batchId: string | null;
    actorId: string;
    reason: string;
    referenceId: string;
  };
};
