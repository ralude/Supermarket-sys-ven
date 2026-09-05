import { describe, expect, it } from 'vitest';
import { Money, Quantity, TaxRate } from '@supermarket/shared';
import { ProductSnapshot } from '../../domain/catalog/index.js';
import { PaymentMethod } from '../../domain/currency/index.js';
import { Payment, Sale } from '../../domain/sales/index.js';
import type { ExecutionContext } from '../execution-context.js';
import type { SaleRepository } from '../ports/index.js';
import { SetSaleRecipient } from './set-sale-recipient.js';

const context: ExecutionContext = {
  actorId: 'user-001',
  terminalId: 'terminal-001',
  originNodeId: 'node-001',
  correlationId: 'correlation-001'
};

const startSale = (): Sale => {
  const sale = Sale.start({
    id: 'sale-001', shiftId: 'shift-001', currencyCode: 'USD',
    terminalId: 'terminal-001', originNodeId: 'node-001', startedBy: 'user-001',
    startedAt: new Date('2026-08-15T10:00:00.000Z'), eventId: 'event-001'
  });
  sale.addItem({
    id: 'item-001',
    snapshot: ProductSnapshot.create({
      productId: 'product-001', description: 'Coffee',
      price: Money.fromMinorUnits(1000, 'USD'), taxRate: TaxRate.fromBasisPoints(1600),
      unitCode: 'UNIT', unitScale: 0
    }),
    quantity: Quantity.fromScaled(1, 0),
    occurredAt: new Date('2026-08-15T10:00:30.000Z'), eventId: 'event-002'
  });
  return sale;
};

class FakeSaleRepository implements SaleRepository {
  stored: Sale = startSale();

  async save(sale: Sale): Promise<void> {
    this.stored = sale;
  }

  async findById(): Promise<Sale | null> {
    return this.stored;
  }
}

const useCaseFor = (repository: SaleRepository): SetSaleRecipient => new SetSaleRecipient(
  repository,
  { generate: () => 'event-003' },
  { now: () => new Date('2026-08-15T10:01:00.000Z') }
);

const venezuelanRecipient = {
  country: 'VE', type: 'RIF', value: 'J-12.345.678-9', name: 'Bodega Central',
  address: 'Av. Urdaneta'
};

describe('SetSaleRecipient', () => {
  it('attaches a canonicalized recipient to a draft sale', async () => {
    const repository = new FakeSaleRepository();

    const result = await useCaseFor(repository).execute(
      { saleId: 'sale-001', recipient: venezuelanRecipient }, context
    );

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.recipient).toEqual({
      country: 'VE', type: 'RIF', value: 'J-12.345.678-9', normalizedValue: 'J123456789',
      name: 'Bodega Central', address: 'Av. Urdaneta'
    });
    expect(repository.stored.recipient?.normalizedValue).toBe('J123456789');
  });

  it('removes the recipient and keeps the anonymous sale valid', async () => {
    const repository = new FakeSaleRepository();
    const useCase = useCaseFor(repository);
    await useCase.execute({ saleId: 'sale-001', recipient: venezuelanRecipient }, context);

    const result = await useCase.execute({ saleId: 'sale-001', recipient: null }, context);

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.recipient).toBeNull();
    expect(repository.stored.status).toBe('DRAFT');
  });

  it('rejects a malformed identification without touching the sale', async () => {
    const repository = new FakeSaleRepository();

    const result = await useCaseFor(repository).execute(
      { saleId: 'sale-001', recipient: { country: 'VE', type: 'RIF', value: 'J-123' } }, context
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('SALE_RECIPIENT_IDENTIFICATION_INVALID');
    expect(repository.stored.recipient).toBeNull();
  });

  it('hides a sale owned by another terminal or node', async () => {
    const repository = new FakeSaleRepository();
    const useCase = useCaseFor(repository);

    const otherTerminal = await useCase.execute(
      { saleId: 'sale-001', recipient: venezuelanRecipient },
      { ...context, terminalId: 'terminal-002' }
    );
    const otherNode = await useCase.execute(
      { saleId: 'sale-001', recipient: venezuelanRecipient },
      { ...context, originNodeId: 'node-002' }
    );

    expect(!otherTerminal.ok && otherTerminal.error.code).toBe('SALE_NOT_FOUND');
    expect(!otherNode.ok && otherNode.error.code).toBe('SALE_NOT_FOUND');
    expect(repository.stored.recipient).toBeNull();
  });

  it('freezes the recipient once the sale is completed', async () => {
    const repository = new FakeSaleRepository();
    const useCase = useCaseFor(repository);
    await useCase.execute({ saleId: 'sale-001', recipient: venezuelanRecipient }, context);
    repository.stored.registerPayments({
      payments: [Payment.create({
        id: 'payment-001',
        method: PaymentMethod.create({
          code: 'CASH_USD', name: 'Cash USD', kind: 'CASH', currencyCode: 'USD'
        }),
        amount: Money.fromMinorUnits(1160, 'USD'),
        amountInSaleCurrency: Money.fromMinorUnits(1160, 'USD'),
        exchangeRate: null, registeredBy: 'user-001',
        registeredAt: new Date('2026-08-15T10:01:00.000Z')
      })],
      financialTransactionTax: Money.zero('USD'),
      occurredAt: new Date('2026-08-15T10:01:00.000Z'), eventIds: ['event-004']
    });
    repository.stored.complete({
      completedAt: new Date('2026-08-15T10:02:00.000Z'), eventId: 'event-005'
    });

    const result = await useCase.execute({ saleId: 'sale-001', recipient: null }, context);

    expect(!result.ok && result.error.code).toBe('SALE_INVALID_STATE');
    expect(repository.stored.recipient?.normalizedValue).toBe('J123456789');
  });
});
