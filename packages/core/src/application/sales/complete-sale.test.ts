import { describe, expect, it } from 'vitest';
import { Money, Quantity, TaxRate } from '@supermarket/shared';
import { ProductSnapshot } from '../../domain/catalog/index.js';
import { PaymentMethod } from '../../domain/currency/index.js';
import { Payment, Sale } from '../../domain/sales/index.js';
import type { ExecutionContext } from '../execution-context.js';
import type { SaleRepository } from '../ports/index.js';
import { CompleteSale } from './complete-sale.js';

const context: ExecutionContext = {
  actorId: 'user-001', terminalId: 'terminal-001', originNodeId: 'node-001',
  correlationId: 'correlation-001', idempotencyKey: 'complete-001'
};

class FakeSaleRepository implements SaleRepository {
  stored: Sale;
  saves = 0;

  constructor() {
    this.stored = Sale.start({
      id: 'sale-001', currencyCode: 'USD', terminalId: 'terminal-001', originNodeId: 'node-001',
      startedBy: 'user-001', startedAt: new Date('2026-08-15T10:00:00.000Z'), eventId: 'event-001'
    });
    this.stored.addItem({
      id: 'item-001', snapshot: ProductSnapshot.create({ productId: 'product-001', description: 'Coffee', price: Money.fromMinorUnits(1000, 'USD'), taxRate: TaxRate.fromBasisPoints(0), unitCode: 'UNIT', unitScale: 0 }),
      quantity: Quantity.fromScaled(1, 0), occurredAt: new Date('2026-08-15T10:00:30.000Z'), eventId: 'event-002'
    });
    this.stored.registerPayments({
      payments: [Payment.create({ id: 'payment-001', method: PaymentMethod.create({ code: 'CASH_USD', name: 'Cash USD', kind: 'CASH', currencyCode: 'USD' }), amount: Money.fromMinorUnits(1000, 'USD'), amountInSaleCurrency: Money.fromMinorUnits(1000, 'USD'), exchangeRate: null, registeredBy: 'user-001', registeredAt: new Date('2026-08-15T10:01:00.000Z') })],
      financialTransactionTax: Money.zero('USD'), occurredAt: new Date('2026-08-15T10:01:00.000Z'), eventIds: ['event-003']
    });
  }

  async save(sale: Sale): Promise<void> { this.stored = sale; this.saves += 1; }
  async findById(): Promise<Sale | null> { return this.stored; }
}

describe('CompleteSale', () => {
  it('completes exactly once for an idempotency key', async () => {
    const repository = new FakeSaleRepository();
    const useCase = new CompleteSale(repository, { generate: () => 'event-004' }, { now: () => new Date('2026-08-15T10:02:00.000Z') });

    const first = await useCase.execute({ saleId: 'sale-001' }, context);
    const second = await useCase.execute({ saleId: 'sale-001' }, context);

    expect(first.ok).toBe(true);
    expect(second).toEqual(first);
    expect(repository.saves).toBe(1);
    expect(repository.stored.status).toBe('COMPLETED');
  });
});
