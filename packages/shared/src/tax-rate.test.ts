import { describe, expect, it } from 'vitest';
import { DomainError, Money, TaxRate } from './index.js';

describe('TaxRate', () => {
  it('is defined in basis points', () => {
    const vat = TaxRate.fromBasisPoints(1600);

    expect(vat.basisPoints).toBe(1600);
  });

  it('rejects fractional or negative rates', () => {
    expect(() => TaxRate.fromBasisPoints(15.5)).toThrowError(DomainError);
    expect(() => TaxRate.fromBasisPoints(15.5)).toThrowError(
      'Tax rate must be a non-negative safe integer in basis points.'
    );
    expect(() => TaxRate.fromBasisPoints(-100)).toThrowError(
      'Tax rate must be a non-negative safe integer in basis points.'
    );
  });

  it('computes IVA over a taxable amount with deterministic rounding', () => {
    const vat = TaxRate.fromBasisPoints(1600);
    const taxable = Money.fromMinorUnits(999, 'VES');

    const tax = vat.applyTo(taxable);

    expect(tax.minorUnits).toBe(160);
    expect(tax.currency).toBe('VES');
  });

  it('computes IGTF over a foreign currency amount', () => {
    const igtf = TaxRate.fromBasisPoints(300);
    const taxable = Money.fromMinorUnits(1000, 'USD');

    const tax = igtf.applyTo(taxable);

    expect(tax.minorUnits).toBe(30);
    expect(tax.currency).toBe('USD');
  });

  it('returns zero tax over a zero amount', () => {
    const vat = TaxRate.fromBasisPoints(1600);

    expect(vat.applyTo(Money.zero('VES')).minorUnits).toBe(0);
  });
});
