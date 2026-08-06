import { DomainError } from './errors/app-error.js';

export type CurrencyCode = string;

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

export class Money {
  private constructor(
    readonly minorUnits: number,
    readonly currency: CurrencyCode
  ) {}

  static fromMinorUnits(minorUnits: number, currency: CurrencyCode): Money {
    if (!Number.isSafeInteger(minorUnits)) {
      throw new DomainError(
        'MONEY_INVALID_AMOUNT',
        'Money amount must be a safe integer in minor units.'
      );
    }

    if (!CURRENCY_CODE_PATTERN.test(currency)) {
      throw new DomainError(
        'MONEY_INVALID_CURRENCY',
        'Currency must be an uppercase three-letter code.'
      );
    }

    return new Money(minorUnits, currency);
  }

  static zero(currency: CurrencyCode): Money {
    return Money.fromMinorUnits(0, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.fromMinorUnits(this.minorUnits + other.minorUnits, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.fromMinorUnits(this.minorUnits - other.minorUnits, this.currency);
  }

  isZero(): boolean {
    return this.minorUnits === 0;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new DomainError(
        'MONEY_CURRENCY_MISMATCH',
        'Money values must use the same currency for arithmetic.'
      );
    }
  }
}
