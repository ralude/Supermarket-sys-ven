import { describe, expect, it } from 'vitest';
import { Money } from '@supermarket/shared';
import { ExchangeRate } from './exchange-rate.js';
import { calculateMixedPaymentTotal } from './mixed-payment.js';

describe('calculateMixedPaymentTotal', () => {
  const at = new Date('2026-08-10T12:00:00Z');

  const usdToVes = ExchangeRate.create({
    id: 'rate-usd-ves',
    baseCurrency: 'USD',
    quoteCurrency: 'VES',
    rateValue: 36500,
    rateScale: 3,
    source: 'BCV',
    validFrom: new Date('2026-08-01T00:00:00Z'),
    registeredBy: 'user-001'
  });

  const eurToVes = ExchangeRate.create({
    id: 'rate-eur-ves',
    baseCurrency: 'EUR',
    quoteCurrency: 'VES',
    rateValue: 40000,
    rateScale: 3,
    source: 'BCV',
    validFrom: new Date('2026-08-01T00:00:00Z'),
    registeredBy: 'user-001'
  });

  it('sums payments already in the target currency without conversion', () => {
    const payments = [
      Money.fromMinorUnits(100000, 'VES'),
      Money.fromMinorUnits(50000, 'VES')
    ];

    const total = calculateMixedPaymentTotal(payments, 'VES', [], at);

    expect(total.minorUnits).toBe(150000);
    expect(total.currency).toBe('VES');
  });

  it('converts foreign payments to the target currency', () => {
    const payments = [
      Money.fromMinorUnits(1000, 'USD'), // 10.00 USD -> 365.00 VES
      Money.fromMinorUnits(50000, 'VES')
    ];

    const total = calculateMixedPaymentTotal(payments, 'VES', [usdToVes], at);

    expect(total.minorUnits).toBe(86500); // 36500 + 50000
  });

  it('converts multiple foreign currencies to the target currency', () => {
    const payments = [
      Money.fromMinorUnits(1000, 'USD'), // 36500 VES
      Money.fromMinorUnits(500, 'EUR') // 20000 VES (5.00 EUR * 40 VES/EUR)
    ];

    const total = calculateMixedPaymentTotal(
      payments,
      'VES',
      [usdToVes, eurToVes],
      at
    );

    expect(total.minorUnits).toBe(56500);
  });

  it('throws when a required rate is missing', () => {
    const payments = [Money.fromMinorUnits(1000, 'EUR')];

    expect(() =>
      calculateMixedPaymentTotal(payments, 'VES', [usdToVes], at)
    ).toThrowError('No exchange rate found for EUR to VES.');
  });

  it('throws when the only available rate is expired', () => {
    const expiredRate = ExchangeRate.create({
      id: 'rate-expired',
      baseCurrency: 'USD',
      quoteCurrency: 'VES',
      rateValue: 36000,
      rateScale: 3,
      source: 'BCV',
      validFrom: new Date('2026-07-01T00:00:00Z'),
      validUntil: new Date('2026-07-31T23:59:59Z'),
      registeredBy: 'user-001'
    });

    const payments = [Money.fromMinorUnits(1000, 'USD')];

    expect(() =>
      calculateMixedPaymentTotal(payments, 'VES', [expiredRate], at)
    ).toThrowError('Exchange rate is not valid at the requested time.');
  });
});
