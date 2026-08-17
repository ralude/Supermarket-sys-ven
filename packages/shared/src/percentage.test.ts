import { describe, expect, it } from 'vitest';
import { DomainError, Money, Percentage } from './index.js';

describe('Percentage', () => {
  it('stores an integer amount of basis points', () => {
    const percentage = Percentage.fromBasisPoints(1600);

    expect(percentage.basisPoints).toBe(1600);
  });

  it('rejects fractional or negative basis points', () => {
    expect(() => Percentage.fromBasisPoints(10.5)).toThrowError(DomainError);
    expect(() => Percentage.fromBasisPoints(10.5)).toThrowError(
      'Percentage must be a non-negative safe integer in basis points.'
    );
    expect(() => Percentage.fromBasisPoints(-1)).toThrowError(
      'Percentage must be a non-negative safe integer in basis points.'
    );
  });

  describe('applied to Money', () => {
    it('computes exact percentages without rounding', () => {
      const result = Money.fromMinorUnits(10000, 'VES').applyPercentage(
        Percentage.fromBasisPoints(1600)
      );

      expect(result.minorUnits).toBe(1600);
      expect(result.currency).toBe('VES');
    });

    it('keeps the full amount at 100 percent', () => {
      const result = Money.fromMinorUnits(999, 'USD').applyPercentage(
        Percentage.fromBasisPoints(10000)
      );

      expect(result.minorUnits).toBe(999);
    });

    it('rounds fractional minor units half away from zero', () => {
      expect(
        Money.fromMinorUnits(3, 'USD').applyPercentage(
          Percentage.fromBasisPoints(5000)
        ).minorUnits
      ).toBe(2);
      expect(
        Money.fromMinorUnits(-3, 'USD').applyPercentage(
          Percentage.fromBasisPoints(5000)
        ).minorUnits
      ).toBe(-2);
    });

    it('rounds down when the fraction is below half a minor unit', () => {
      const result = Money.fromMinorUnits(331, 'USD').applyPercentage(
        Percentage.fromBasisPoints(1600)
      );

      expect(result.minorUnits).toBe(53);
    });

    it('rejects results beyond the safe integer range', () => {
      expect(() =>
        Money.fromMinorUnits(Number.MAX_SAFE_INTEGER, 'USD').applyPercentage(
          Percentage.fromBasisPoints(20000)
        )
      ).toThrowError('Money operation result exceeds the safe integer range.');
    });
  });
});
