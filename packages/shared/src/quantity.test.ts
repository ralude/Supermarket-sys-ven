import { describe, expect, it } from 'vitest';
import { DomainError, Quantity } from './index.js';

describe('Quantity', () => {
  it('stores a scaled integer value', () => {
    const quantity = Quantity.fromScaled(15, 1);

    expect(quantity.scaledValue).toBe(15);
    expect(quantity.scale).toBe(1);
  });

  it('creates zero quantities at a given scale', () => {
    const zero = Quantity.zero(3);

    expect(zero.scaledValue).toBe(0);
    expect(zero.scale).toBe(3);
    expect(zero.isZero()).toBe(true);
  });

  it('rejects fractional scaled values', () => {
    expect(() => Quantity.fromScaled(1.5, 1)).toThrowError(DomainError);
    expect(() => Quantity.fromScaled(1.5, 1)).toThrowError(
      'Quantity value must be a safe integer in scaled units.'
    );
  });

  it('rejects invalid scales', () => {
    expect(() => Quantity.fromScaled(1, -1)).toThrowError(
      'Quantity scale must be an integer between 0 and 6.'
    );
    expect(() => Quantity.fromScaled(1, 2.5)).toThrowError(
      'Quantity scale must be an integer between 0 and 6.'
    );
    expect(() => Quantity.fromScaled(1, 7)).toThrowError(
      'Quantity scale must be an integer between 0 and 6.'
    );
  });

  it('scales the decimal text written by the operator', () => {
    expect(Quantity.fromDecimal('12', 3).scaledValue).toBe(12000);
    expect(Quantity.fromDecimal(' 12,5 ', 2).scaledValue).toBe(1250);
    expect(Quantity.fromDecimal('0.750', 3).scaledValue).toBe(750);
    expect(Quantity.fromDecimal('7', 0).scaledValue).toBe(7);
  });

  it('rejects decimal text that is not a positive number', () => {
    expect(() => Quantity.fromDecimal('-1', 0)).toThrowError(
      'Quantity must be written as a positive decimal number.'
    );
    expect(() => Quantity.fromDecimal('dos', 0)).toThrowError(DomainError);
    expect(() => Quantity.fromDecimal('', 0)).toThrowError(DomainError);
  });

  it('rejects more decimals than the unit of measure allows', () => {
    expect(() => Quantity.fromDecimal('1.5', 0)).toThrowError(
      'Quantity has more decimals than the unit of measure allows.'
    );
    expect(() => Quantity.fromDecimal('1.555', 2)).toThrowError(DomainError);
  });

  it('adds and subtracts quantities with the same scale', () => {
    const total = Quantity.fromScaled(15, 1).add(Quantity.fromScaled(5, 1));
    const difference = Quantity.fromScaled(15, 1).subtract(
      Quantity.fromScaled(20, 1)
    );

    expect(total.scaledValue).toBe(20);
    expect(total.scale).toBe(1);
    expect(difference.scaledValue).toBe(-5);
  });

  it('rejects arithmetic across different scales', () => {
    expect(() =>
      Quantity.fromScaled(15, 1).add(Quantity.fromScaled(15, 2))
    ).toThrowError('Quantity values must use the same scale for arithmetic.');
    expect(() =>
      Quantity.fromScaled(15, 1).subtract(Quantity.fromScaled(15, 2))
    ).toThrowError(DomainError);
  });

  it('rejects results beyond the safe integer range', () => {
    expect(() =>
      Quantity.fromScaled(Number.MAX_SAFE_INTEGER, 0).add(
        Quantity.fromScaled(1, 0)
      )
    ).toThrowError('Quantity value must be a safe integer in scaled units.');
  });
});
