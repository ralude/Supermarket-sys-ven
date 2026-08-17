import { describe, expect, it } from 'vitest';
import { ExchangeRate } from './exchange-rate.js';

describe('ExchangeRate', () => {
  const baseProps = {
    id: 'rate-001',
    baseCurrency: 'USD',
    quoteCurrency: 'VES',
    rateValue: 36500,
    rateScale: 3,
    source: 'BCV',
    validFrom: new Date('2026-08-01T00:00:00Z'),
    registeredBy: 'user-001'
  };

  it('creates a valid exchange rate with open-ended validity', () => {
    const rate = ExchangeRate.create(baseProps);

    expect(rate.id).toBe('rate-001');
    expect(rate.baseCurrency).toBe('USD');
    expect(rate.quoteCurrency).toBe('VES');
    expect(rate.rateValue).toBe(36500);
    expect(rate.rateScale).toBe(3);
    expect(rate.source).toBe('BCV');
    expect(rate.validUntil).toBeNull();
    expect(rate.toQuantity().scaledValue).toBe(36500);
    expect(rate.toQuantity().scale).toBe(3);
  });

  it('exposes its validity window', () => {
    const rate = ExchangeRate.create({
      ...baseProps,
      validUntil: new Date('2026-08-31T23:59:59Z')
    });

    expect(rate.isValidAt(new Date('2026-08-15T12:00:00Z'))).toBe(true);
    expect(rate.isValidAt(new Date('2026-08-01T00:00:00Z'))).toBe(true);
    expect(rate.isValidAt(new Date('2026-08-31T23:59:59Z'))).toBe(false);
    expect(rate.isValidAt(new Date('2026-07-31T23:59:59Z'))).toBe(false);
  });

  it('rejects identical base and quote currencies', () => {
    expect(() =>
      ExchangeRate.create({ ...baseProps, baseCurrency: 'VES', quoteCurrency: 'VES' })
    ).toThrowError('Base and quote currencies must be different.');
  });

  it('rejects invalid rate values', () => {
    expect(() =>
      ExchangeRate.create({ ...baseProps, rateValue: 0 })
    ).toThrowError('Exchange rate value must be a positive safe integer.');
    expect(() =>
      ExchangeRate.create({ ...baseProps, rateValue: -100 })
    ).toThrowError('Exchange rate value must be a positive safe integer.');
    expect(() =>
      ExchangeRate.create({ ...baseProps, rateValue: 100.5 })
    ).toThrowError('Exchange rate value must be a positive safe integer.');
  });

  it('rejects invalid rate scales', () => {
    expect(() =>
      ExchangeRate.create({ ...baseProps, rateScale: -1 })
    ).toThrowError('Exchange rate scale must be an integer between 0 and 8.');
    expect(() =>
      ExchangeRate.create({ ...baseProps, rateScale: 2.5 })
    ).toThrowError('Exchange rate scale must be an integer between 0 and 8.');
    expect(() =>
      ExchangeRate.create({ ...baseProps, rateScale: 9 })
    ).toThrowError('Exchange rate scale must be an integer between 0 and 8.');
  });

  it('rejects invalid currency codes', () => {
    expect(() =>
      ExchangeRate.create({ ...baseProps, baseCurrency: 'usd' })
    ).toThrowError('Currency code must be an uppercase three-letter code.');
  });

  it('rejects an empty source', () => {
    expect(() =>
      ExchangeRate.create({ ...baseProps, source: '  ' })
    ).toThrowError('Exchange rate source is required.');
  });

  it('rejects an inverted validity range', () => {
    expect(() =>
      ExchangeRate.create({
        ...baseProps,
        validFrom: new Date('2026-08-31T00:00:00Z'),
        validUntil: new Date('2026-08-01T00:00:00Z')
      })
    ).toThrowError('Exchange rate validUntil must be after validFrom.');
  });
});
