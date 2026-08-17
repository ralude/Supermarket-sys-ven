import { describe, expect, it } from 'vitest';
import { PaymentMethod } from './payment-method.js';

describe('PaymentMethod', () => {
  it('creates a payment method for a currency', () => {
    const method = PaymentMethod.create({
      code: 'CASH_VES',
      name: 'Efectivo en bolívares',
      kind: 'CASH',
      currencyCode: 'VES'
    });

    expect(method.code).toBe('CASH_VES');
    expect(method.name).toBe('Efectivo en bolívares');
    expect(method.kind).toBe('CASH');
    expect(method.currencyCode).toBe('VES');
    expect(method.isActive).toBe(true);
  });

  it('rejects invalid codes', () => {
    expect(() =>
      PaymentMethod.create({
        code: '',
        name: 'Cash',
        kind: 'CASH',
        currencyCode: 'VES'
      })
    ).toThrowError('Payment method code must be uppercase letters, numbers or underscores.');
  });

  it('rejects empty names', () => {
    expect(() =>
      PaymentMethod.create({
        code: 'CASH_VES',
        name: '   ',
        kind: 'CASH',
        currencyCode: 'VES'
      })
    ).toThrowError('Payment method name is required.');
  });

  it('rejects unknown kinds', () => {
    expect(() =>
      PaymentMethod.create({
        code: 'CASH_VES',
        name: 'Cash',
        kind: 'GOLD' as 'CASH',
        currencyCode: 'VES'
      })
    ).toThrowError('Payment method kind must be CASH, CARD, MOBILE_PAYMENT, BANK_TRANSFER or OTHER.');
  });

  it('rejects invalid currency codes', () => {
    expect(() =>
      PaymentMethod.create({
        code: 'CASH_VES',
        name: 'Cash',
        kind: 'CASH',
        currencyCode: 'ves'
      })
    ).toThrowError('Currency code must be an uppercase three-letter code.');
  });
});
