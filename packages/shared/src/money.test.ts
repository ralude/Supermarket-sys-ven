import { describe, expect, it } from 'vitest';
import { DomainError, Money, Quantity } from './index.js';

describe('Money', () => {
  it('sums values in the same currency using minor units', () => {
    const total = Money.fromMinorUnits(1250, 'USD').add(
      Money.fromMinorUnits(275, 'USD')
    );

    expect(total.minorUnits).toBe(1525);
    expect(total.currency).toBe('USD');
  });

  it('rejects arithmetic across currencies', () => {
    expect(() =>
      Money.fromMinorUnits(100, 'USD').add(Money.fromMinorUnits(100, 'VES'))
    ).toThrowError(DomainError);
  });

  it('rejects fractional minor units and invalid currency codes', () => {
    expect(() => Money.fromMinorUnits(10.5, 'USD')).toThrowError(
      'Money amount must be a safe integer in minor units.'
    );
    expect(() => Money.fromMinorUnits(100, 'usd')).toThrowError(
      'Currency must be an uppercase three-letter code.'
    );
  });

  describe('multiply', () => {
    it('multiplies by an integer factor without losing precision', () => {
      const total = Money.fromMinorUnits(1250, 'USD').multiply(3);

      expect(total.minorUnits).toBe(3750);
      expect(total.currency).toBe('USD');
    });

    it('supports zero and negative factors', () => {
      expect(Money.fromMinorUnits(1250, 'USD').multiply(0).minorUnits).toBe(0);
      expect(Money.fromMinorUnits(1250, 'USD').multiply(-2).minorUnits).toBe(-2500);
    });

    it('rejects non-integer multiplication factors', () => {
      expect(() => Money.fromMinorUnits(100, 'USD').multiply(1.5)).toThrowError(
        DomainError
      );
      expect(() => Money.fromMinorUnits(100, 'USD').multiply(1.5)).toThrowError(
        'Money multiplication factor must be a safe integer.'
      );
    });

    it('rejects multiplication results beyond the safe integer range', () => {
      expect(() =>
        Money.fromMinorUnits(Number.MAX_SAFE_INTEGER, 'USD').multiply(2)
      ).toThrowError('Money operation result exceeds the safe integer range.');
    });
  });

  describe('multiplyByQuantity', () => {
    it('multiplies by an integer quantity exactly', () => {
      const price = Money.fromMinorUnits(1250, 'USD');
      const total = price.multiplyByQuantity(Quantity.fromScaled(3, 0));

      expect(total.minorUnits).toBe(3750);
    });

    it('multiplies by a fractional quantity using its scale', () => {
      const pricePerKilogram = Money.fromMinorUnits(1000, 'USD');
      const total = pricePerKilogram.multiplyByQuantity(
        Quantity.fromScaled(15, 1)
      );

      expect(total.minorUnits).toBe(1500);
    });

    it('rounds fractional minor units half away from zero', () => {
      const pricePerKilogram = Money.fromMinorUnits(333, 'USD');
      const total = pricePerKilogram.multiplyByQuantity(
        Quantity.fromScaled(5, 1)
      );

      expect(total.minorUnits).toBe(167);
    });

    it('rejects results beyond the safe integer range', () => {
      expect(() =>
        Money.fromMinorUnits(Number.MAX_SAFE_INTEGER, 'USD').multiplyByQuantity(
          Quantity.fromScaled(2, 0)
        )
      ).toThrowError('Money operation result exceeds the safe integer range.');
    });
  });

  describe('divideByQuantity', () => {
    it('divides by an integer quantity using the scale', () => {
      const unitPrice = Money.fromMinorUnits(1000, 'USD').divideByQuantity(
        Quantity.fromScaled(4, 0)
      );

      expect(unitPrice.minorUnits).toBe(250);
    });

    it('divides by a fractional quantity using its scale', () => {
      const price = Money.fromMinorUnits(1000, 'USD').divideByQuantity(
        Quantity.fromScaled(25, 1)
      );

      expect(price.minorUnits).toBe(400);
    });

    it('rounds fractional minor units half away from zero', () => {
      expect(
        Money.fromMinorUnits(105, 'USD').divideByQuantity(
          Quantity.fromScaled(6, 0)
        ).minorUnits
      ).toBe(18);
      expect(
        Money.fromMinorUnits(-105, 'USD').divideByQuantity(
          Quantity.fromScaled(6, 0)
        ).minorUnits
      ).toBe(-18);
    });

    it('rejects division by zero quantity', () => {
      expect(() =>
        Money.fromMinorUnits(100, 'USD').divideByQuantity(
          Quantity.fromScaled(0, 0)
        )
      ).toThrowError('Cannot divide money by a zero quantity.');
    });

    it('rejects results beyond the safe integer range', () => {
      expect(() =>
        Money.fromMinorUnits(Number.MAX_SAFE_INTEGER, 'USD').divideByQuantity(
          Quantity.fromScaled(1, 6)
        )
      ).toThrowError('Money operation result exceeds the safe integer range.');
    });
  });
});
