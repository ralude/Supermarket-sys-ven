import { DomainError, Money } from '@supermarket/shared';
import type { ExchangeRate, PaymentMethod } from '../currency/index.js';

export type PaymentProps = {
  id: string;
  method: PaymentMethod;
  amount: Money;
  amountInSaleCurrency: Money;
  exchangeRate: ExchangeRate | null;
  registeredBy: string;
  registeredAt: Date;
};

export class Payment {
  private constructor(
    readonly id: string,
    readonly method: PaymentMethod,
    readonly amount: Money,
    readonly amountInSaleCurrency: Money,
    readonly exchangeRate: ExchangeRate | null,
    readonly registeredBy: string,
    readonly registeredAt: Date
  ) {}

  static create(props: PaymentProps): Payment {
    if (props.amount.minorUnits <= 0) {
      throw new DomainError('SALE_PAYMENT_INVALID_AMOUNT', 'Payment amount must be positive.');
    }
    if (!props.method.isActive) {
      throw new DomainError('SALE_PAYMENT_METHOD_INACTIVE', 'Payment method is inactive.');
    }
    if (props.amount.currency !== props.method.currencyCode) {
      throw new DomainError(
        'SALE_PAYMENT_METHOD_CURRENCY_MISMATCH',
        'Payment amount currency must match the payment method currency.'
      );
    }
    if (props.amountInSaleCurrency.minorUnits <= 0) {
      throw new DomainError(
        'SALE_PAYMENT_INVALID_CONVERTED_AMOUNT',
        'Converted payment amount must be positive.'
      );
    }

    return new Payment(
      props.id,
      props.method,
      props.amount,
      props.amountInSaleCurrency,
      props.exchangeRate,
      props.registeredBy,
      new Date(props.registeredAt)
    );
  }
}
