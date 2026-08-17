import { DomainError, type Money } from '@supermarket/shared';
import type { PaymentMethod } from '../currency/index.js';

export const CASH_MOVEMENT_TYPES = ['OPENING_FLOAT', 'INCOME', 'WITHDRAWAL'] as const;
export type CashMovementType = (typeof CASH_MOVEMENT_TYPES)[number];

export type CashMovementProps = {
  id: string;
  type: CashMovementType;
  method: PaymentMethod;
  amount: Money;
  reason: string;
  registeredBy: string;
  registeredAt: Date;
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
    registeredAt: Date
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
    if (props.method.kind !== 'CASH') {
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
    return new CashMovement(
      id,
      props.type,
      props.method,
      props.amount,
      reason,
      registeredBy,
      props.registeredAt
    );
  }

  get registeredAt(): Date {
    return new Date(this.occurredAt);
  }
}
