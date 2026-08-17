import { DomainError, Money, Quantity } from '@supermarket/shared';
import { ProductSnapshot } from '../catalog/index.js';
import { Discount, type DiscountProps } from './discount.js';

export type SaleItemProps = {
  id: string;
  snapshot: ProductSnapshot;
  quantity: Quantity;
};

export type ApplyItemDiscountProps = Omit<DiscountProps, 'amount' | 'appliedAt'> & {
  appliedAt: Date;
};

export class SaleItem {
  private currentDiscount: Discount | null = null;

  private constructor(
    readonly id: string,
    readonly snapshot: ProductSnapshot,
    readonly quantity: Quantity
  ) {}

  static create(props: SaleItemProps): SaleItem {
    if (props.quantity.scaledValue <= 0) {
      throw new DomainError('SALE_ITEM_INVALID_QUANTITY', 'Sale item quantity must be positive.');
    }
    if (props.quantity.scale !== props.snapshot.unitScale) {
      throw new DomainError(
        'SALE_ITEM_QUANTITY_SCALE_MISMATCH',
        'Sale item quantity scale must match the product unit scale.'
      );
    }

    return new SaleItem(props.id, props.snapshot, props.quantity);
  }

  get discount(): Discount | null {
    return this.currentDiscount;
  }

  get grossAmount(): Money {
    return this.snapshot.price.multiplyByQuantity(this.quantity);
  }

  get discountAmount(): Money {
    return this.currentDiscount?.amount ?? Money.zero(this.snapshot.price.currency);
  }

  get taxableAmount(): Money {
    return this.grossAmount.subtract(this.discountAmount);
  }

  get taxAmount(): Money {
    return this.snapshot.taxRate.applyTo(this.taxableAmount);
  }

  get total(): Money {
    return this.taxableAmount.add(this.taxAmount);
  }

  applyDiscount(props: ApplyItemDiscountProps): Discount {
    if (this.currentDiscount !== null) {
      throw new DomainError('SALE_ITEM_DISCOUNT_ALREADY_APPLIED', 'Sale item already has a discount.');
    }
    if (props.percentage.basisPoints > 10_000) {
      throw new DomainError('SALE_DISCOUNT_INVALID_PERCENTAGE', 'Discount cannot exceed 100 percent.');
    }

    const discount = Discount.create({
      ...props,
      amount: this.grossAmount.applyPercentage(props.percentage)
    });
    this.currentDiscount = discount;
    return discount;
  }
}
