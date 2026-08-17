import { DomainError, Money, Percentage } from '@supermarket/shared';

export type DiscountProps = {
  id: string;
  lineItemId: string;
  percentage: Percentage;
  amount: Money;
  reason: string;
  appliedBy: string;
  appliedAt: Date;
};

export class Discount {
  private constructor(
    readonly id: string,
    readonly lineItemId: string,
    readonly percentage: Percentage,
    readonly amount: Money,
    readonly reason: string,
    readonly appliedBy: string,
    readonly appliedAt: Date
  ) {}

  static create(props: DiscountProps): Discount {
    const reason = props.reason.trim();
    if (reason.length === 0) {
      throw new DomainError('SALE_DISCOUNT_REASON_REQUIRED', 'Discount reason is required.');
    }
    if (props.percentage.basisPoints > 10_000) {
      throw new DomainError('SALE_DISCOUNT_INVALID_PERCENTAGE', 'Discount cannot exceed 100 percent.');
    }
    if (props.amount.minorUnits < 0) {
      throw new DomainError('SALE_DISCOUNT_INVALID_AMOUNT', 'Discount amount cannot be negative.');
    }

    return new Discount(
      props.id,
      props.lineItemId,
      props.percentage,
      props.amount,
      reason,
      props.appliedBy,
      new Date(props.appliedAt)
    );
  }
}
