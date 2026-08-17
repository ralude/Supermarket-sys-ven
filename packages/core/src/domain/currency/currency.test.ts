import { describe, expect, it } from 'vitest';
import { Currency } from './currency.js';

describe('Currency', () => {
  it('creates an active currency with a valid ISO-style code', () => {
    const currency = Currency.create({
      code: 'VES',
      name: 'Bolívar Soberano',
      minorUnitExponent: 2
    });

    expect(currency.code).toBe('VES');
    expect(currency.name).toBe('Bolívar Soberano');
    expect(currency.minorUnitExponent).toBe(2);
    expect(currency.isActive).toBe(true);
  });

  it('accepts an explicit active flag', () => {
    const currency = Currency.create({
      code: 'USD',
      name: 'US Dollar',
      minorUnitExponent: 2,
      isActive: false
    });

    expect(currency.isActive).toBe(false);
  });

  it('rejects invalid currency codes', () => {
    expect(() =>
      Currency.create({ code: 'ves', name: 'Bolívar', minorUnitExponent: 2 })
    ).toThrowError('Currency code must be an uppercase three-letter code.');
    expect(() =>
      Currency.create({ code: 'US', name: 'Dollar', minorUnitExponent: 2 })
    ).toThrowError('Currency code must be an uppercase three-letter code.');
  });

  it('rejects empty names', () => {
    expect(() =>
      Currency.create({ code: 'VES', name: '  ', minorUnitExponent: 2 })
    ).toThrowError('Currency name is required.');
  });

  it('rejects invalid minor unit exponents', () => {
    expect(() =>
      Currency.create({ code: 'VES', name: 'Bolívar', minorUnitExponent: -1 })
    ).toThrowError('Currency minor unit exponent must be an integer between 0 and 6.');
    expect(() =>
      Currency.create({ code: 'VES', name: 'Bolívar', minorUnitExponent: 2.5 })
    ).toThrowError('Currency minor unit exponent must be an integer between 0 and 6.');
    expect(() =>
      Currency.create({ code: 'VES', name: 'Bolívar', minorUnitExponent: 7 })
    ).toThrowError('Currency minor unit exponent must be an integer between 0 and 6.');
  });
});
