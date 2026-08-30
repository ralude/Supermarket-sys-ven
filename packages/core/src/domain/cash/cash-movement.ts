import { DomainError, type Money } from '@supermarket/shared';
import type { PaymentMethod } from '../currency/index.js';

export const CASH_MOVEMENT_TYPES = [
  'OPENING_FLOAT',
  'INCOME',
  'WITHDRAWAL',
  'SALE_PAYMENT'
] as const;
export type CashMovementType = (typeof CASH_MOVEMENT_TYPES)[number];

export type CashMovementReference = {
  sourceId: string;
  sourceEventId: string;
};

export type CashMovementProps = {
  id: string;
  type: CashMovementType;
  method: PaymentMethod;
  amount: Money;
  reason: string;
  registeredBy: string;
  registeredAt: Date;
  reference?: CashMovementReference;
};

export class CashMovement {
  private readonly occurredAt: Date;

  private constructor(
    readonly id: string,
    readonly type: CashMovementType,
    readonly method: PaymentMethod,
    readonly amount: Money,
    readonly reason: string,
    readonly registeredBy: string,
    registeredAt: Date,
    readonly reference: CashMovementReference | null
  ) {
    this.occurredAt = new Date(registeredAt);
  }

  static create(props: CashMovementProps): CashMovement {
    const id = props.id.trim();
    if (id.length === 0) {
      throw new DomainError('CASH_MOVEMENT_ID_REQUIRED', 'Cash movement ID is required.');
    }
    if (!CASH_MOVEMENT_TYPES.includes(props.type)) {
      throw new DomainError('CASH_MOVEMENT_INVALID_TYPE', 'Cash movement type is invalid.');
    }
    if (props.amount.minorUnits <= 0) {
      throw new DomainError('CASH_MOVEMENT_INVALID_AMOUNT', 'Cash movement amount must be positive.');
    }
    if (!props.method.isActive) {
      throw new DomainError('PAYMENT_METHOD_INACTIVE', 'Payment method is inactive.');
    }
    if (props.type !== 'SALE_PAYMENT' && props.method.kind !== 'CASH') {
      throw new DomainError('CASH_PAYMENT_METHOD_REQUIRED', 'Cash movements require a cash payment method.');
    }
    if (props.method.currencyCode !== props.amount.currency) {
      throw new DomainError(
        'PAYMENT_METHOD_CURRENCY_MISMATCH',
        'Payment method currency must match movement currency.'
      );
    }
    const reason = props.reason.trim();
    if (reason.length === 0) {
      throw new DomainError('CASH_MOVEMENT_REASON_REQUIRED', 'Cash movement reason is required.');
    }
    const registeredBy = props.registeredBy.trim();
    if (registeredBy.length === 0) {
      throw new DomainError('CASH_MOVEMENT_ACTOR_REQUIRED', 'Cash movement actor is required.');
    }
    if (Number.isNaN(props.registeredAt.getTime())) {
      throw new DomainError('CASH_MOVEMENT_INVALID_TIMESTAMP', 'Cash movement timestamp is invalid.');
    }
    const reference = props.reference
      ? {
          sourceId: props.reference.sourceId.trim(),
          sourceEventId: props.reference.sourceEventId.trim()
        }
      : null;
    if (props.type === 'SALE_PAYMENT' && (
      reference === null || reference.sourceId.length === 0 || reference.sourceEventId.length === 0
    )) {
      throw new DomainError(
        'CASH_SALE_PAYMENT_REFERENCE_REQUIRED',
        'Sale payments require their sale and source event identifiers.'
      );
    }
    return new CashMovement(
      id,
      props.type,
      props.method,
      props.amount,
      reason,
      registeredBy,
      props.registeredAt,
      reference
    );
  }

  get registeredAt(): Date {
    return new Date(this.occurredAt);
  }

  matches(props: CashMovementProps): boolean {
    return this.type === props.type &&
      this.method.code === props.method.code &&
      this.amount.currency === props.amount.currency &&
      this.amount.minorUnits === props.amount.minorUnits &&
      this.reason === props.reason.trim() &&
      this.registeredBy === props.registeredBy.trim() &&
      this.occurredAt.getTime() === props.registeredAt.getTime() &&
      this.reference?.sourceId === props.reference?.sourceId.trim() &&
      this.reference?.sourceEventId === props.reference?.sourceEventId.trim();
  }
}
