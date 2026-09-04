import { describe, expect, it } from 'vitest';
import { PaymentMethod } from '../../domain/currency/index.js';
import type { PaymentMethodRepository } from '../ports/index.js';
import { ListPaymentMethods } from './list-payment-methods.js';

class FakePaymentMethodRepository implements PaymentMethodRepository {
  constructor(private readonly methods: readonly PaymentMethod[]) {}

  async findByCode(code: string): Promise<PaymentMethod | null> {
    return this.methods.find((method) => method.code === code) ?? null;
  }

  async findAll(): Promise<readonly PaymentMethod[]> {
    return this.methods;
  }
}

describe('ListPaymentMethods', () => {
  it('lists only active methods with their settlement currency', async () => {
    const cash = PaymentMethod.create({ code: 'CASH', name: 'Efectivo', kind: 'CASH', currencyCode: 'USD' });
    const card = PaymentMethod.create({ code: 'CARD', name: 'Tarjeta', kind: 'CARD', currencyCode: 'VES' });
    const retired = PaymentMethod.create({
      code: 'OLD', name: 'Retirado', kind: 'OTHER', currencyCode: 'USD', isActive: false
    });
    const useCase = new ListPaymentMethods(new FakePaymentMethodRepository([cash, card, retired]));

    const result = await useCase.execute();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([
      { code: 'CASH', name: 'Efectivo', kind: 'CASH', currencyCode: 'USD' },
      { code: 'CARD', name: 'Tarjeta', kind: 'CARD', currencyCode: 'VES' }
    ]);
  });
});
