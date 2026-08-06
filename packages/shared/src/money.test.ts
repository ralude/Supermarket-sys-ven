import { describe, expect, it } from 'vitest';
import { DomainError, Money } from './index.js';

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
});
