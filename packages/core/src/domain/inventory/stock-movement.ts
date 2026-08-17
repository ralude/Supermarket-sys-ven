import { DomainError, type Quantity } from '@supermarket/shared';

export const STOCK_MOVEMENT_TYPES = [
  'PURCHASE_RECEIPT',
  'SALE_ISSUE',
  'WASTE',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT'
] as const;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];
export type StockMovementDirection = 'IN' | 'OUT';

export type StockMovementProps = {
  id: string;
  type: StockMovementType;
  quantity: Quantity;
  batchId?: string;
  actorId: string;
  reason: string;
  referenceId: string;
  occurredAt: Date;
};

const MOVEMENT_DIRECTIONS: Record<StockMovementType, StockMovementDirection> = {
  PURCHASE_RECEIPT: 'IN',
  SALE_ISSUE: 'OUT',
  WASTE: 'OUT',
  ADJUSTMENT_IN: 'IN',
  ADJUSTMENT_OUT: 'OUT'
};

export class StockMovement {
  private readonly occurrenceTimestamp: Date;

  private constructor(
    readonly id: string,
    readonly type: StockMovementType,
    readonly direction: StockMovementDirection,
    readonly quantity: Quantity,
    readonly batchId: string | null,
    readonly actorId: string,
    readonly reason: string,
    readonly referenceId: string,
    occurredAt: Date
  ) {
    this.occurrenceTimestamp = new Date(occurredAt);
  }

  static create(props: StockMovementProps): StockMovement {
    const id = StockMovement.requireText(
      props.id,
      'STOCK_MOVEMENT_ID_REQUIRED',
      'Stock movement ID is required.'
    );
    if (props.quantity.scaledValue <= 0) {
      throw new DomainError(
        'STOCK_MOVEMENT_QUANTITY_INVALID',
        'Stock movement quantity must be positive.'
      );
    }
    const batchId = props.batchId === undefined
      ? null
      : StockMovement.requireText(
          props.batchId,
          'STOCK_BATCH_ID_REQUIRED',
          'Stock batch ID is required.'
        );
    const actorId = StockMovement.requireText(
      props.actorId,
      'STOCK_MOVEMENT_ACTOR_REQUIRED',
      'Stock movement actor is required.'
    );
    const reason = StockMovement.requireText(
      props.reason,
      'STOCK_MOVEMENT_REASON_REQUIRED',
      'Stock movement reason is required.'
    );
    const referenceId = StockMovement.requireText(
      props.referenceId,
      'STOCK_MOVEMENT_REFERENCE_REQUIRED',
      'Stock movement reference is required.'
    );
    if (Number.isNaN(props.occurredAt.getTime())) {
      throw new DomainError(
        'STOCK_MOVEMENT_TIMESTAMP_INVALID',
        'Stock movement timestamp is invalid.'
      );
    }
    return new StockMovement(
      id,
      props.type,
      MOVEMENT_DIRECTIONS[props.type],
      props.quantity,
      batchId,
      actorId,
      reason,
      referenceId,
      props.occurredAt
    );
  }

  get occurredAt(): Date {
    return new Date(this.occurrenceTimestamp);
  }

  private static requireText(value: string, code: string, message: string): string {
    const normalized = value.trim();
    if (normalized.length === 0) throw new DomainError(code, message);
    return normalized;
  }
}
