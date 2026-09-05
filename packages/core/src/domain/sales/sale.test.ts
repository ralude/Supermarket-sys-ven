import { describe, expect, it } from 'vitest';
import {
  Money,
  Percentage,
  Quantity,
  TaxRate
} from '@supermarket/shared';
import { ProductSnapshot } from '../catalog/index.js';
import { PaymentMethod } from '../currency/index.js';
import { createSaleRecipientSnapshot, Payment, Sale } from './index.js';

const snapshot = ProductSnapshot.create({
  productId: 'product-001',
  description: 'Coffee',
  price: Money.fromMinorUnits(1000, 'USD'),
  taxRate: TaxRate.fromBasisPoints(1600),
  unitCode: 'UNIT',
  unitScale: 0
});

function startSale(): Sale {
  return Sale.start({
    id: 'sale-001',
    shiftId: 'shift-001',
    currencyCode: 'USD',
    terminalId: 'terminal-001',
    originNodeId: 'node-001',
    startedBy: 'user-001',
    startedAt: new Date('2026-08-15T10:00:00.000Z'),
    eventId: 'event-001'
  });
}

function payment(): Payment {
  return Payment.create({
    id: 'payment-001',
    method: PaymentMethod.create({
      code: 'CASH_USD',
      name: 'Cash USD',
      kind: 'CASH',
      currencyCode: 'USD'
    }),
    amount: Money.fromMinorUnits(1044, 'USD'),
    amountInSaleCurrency: Money.fromMinorUnits(1044, 'USD'),
    exchangeRate: null,
    registeredBy: 'user-001',
    registeredAt: new Date('2026-08-15T10:01:00.000Z')
  });
}

describe('Sale', () => {
  it('calculates line discount and IVA before completing', () => {
    const sale = startSale();
    sale.addItem({
      id: 'item-001',
      snapshot,
      quantity: Quantity.fromScaled(1, 0),
      occurredAt: new Date('2026-08-15T10:00:30.000Z'),
      eventId: 'event-002'
    });
    sale.applyDiscount({
      id: 'discount-001',
      lineItemId: 'item-001',
      percentage: Percentage.fromBasisPoints(1000),
      reason: 'Promotion',
      appliedBy: 'user-001',
      occurredAt: new Date('2026-08-15T10:00:40.000Z'),
      eventId: 'event-003',
      maximumBasisPoints: 10_000
    });

    expect(sale.subtotal.minorUnits).toBe(1000);
    expect(sale.discountTotal.minorUnits).toBe(100);
    expect(sale.taxTotal.minorUnits).toBe(144);
    expect(sale.commercialTotal.minorUnits).toBe(1044);

    sale.registerPayments({
      payments: [payment()],
      financialTransactionTax: Money.zero('USD'),
      occurredAt: new Date('2026-08-15T10:01:00.000Z'),
      eventIds: ['event-004']
    });
    sale.complete({
      completedAt: new Date('2026-08-15T10:01:30.000Z'),
      eventId: 'event-005'
    });

    expect(sale.status).toBe('COMPLETED');
    expect(sale.total.minorUnits).toBe(1044);
    expect(sale.domainEvents.map((event) => event.type)).toEqual([
      'SaleStarted',
      'SaleItemAdded',
      'DiscountApplied',
      'PaymentRegistered',
      'SaleCompleted'
    ]);
    expect(sale.domainEvents.at(-1)?.payload).toMatchObject({
      shiftId: 'shift-001',
      terminalId: 'terminal-001',
      payments: [{
        paymentId: 'payment-001', methodCode: 'CASH_USD',
        currencyCode: 'USD', amountMinorUnits: 1044
      }],
      items: [{
        itemId: 'item-001', productId: 'product-001', quantityScaled: 1, quantityScale: 0
      }]
    });
  });

  it('rejects quantities with a different scale and voids only drafts', () => {
    const sale = startSale();
    expect(() =>
      sale.addItem({
        id: 'item-001',
        snapshot,
        quantity: Quantity.fromScaled(10, 1),
        occurredAt: new Date('2026-08-15T10:00:30.000Z'),
        eventId: 'event-002'
      })
    ).toThrowError('Sale item quantity scale must match the product unit scale.');

    sale.void({
      reason: 'Customer cancelled',
      voidedBy: 'user-001',
      voidedAt: new Date('2026-08-15T10:02:00.000Z'),
      eventId: 'event-003'
    });
    expect(sale.status).toBe('VOIDED');
  });

  it('stays anonymous until a recipient is attached and freezes it once completed', () => {
    const sale = startSale();
    expect(sale.recipient).toBeNull();

    sale.addItem({
      id: 'item-001', snapshot, quantity: Quantity.fromScaled(1, 0),
      occurredAt: new Date('2026-08-15T10:00:30.000Z'), eventId: 'event-002'
    });
    sale.setRecipient({
      recipient: createSaleRecipientSnapshot({
        country: 'VE', type: 'RIF', value: 'J-12345678-9', name: 'Bodega Central'
      }),
      occurredAt: new Date('2026-08-15T10:00:45.000Z'), eventId: 'event-003'
    });
    expect(sale.recipient?.normalizedValue).toBe('J123456789');

    const changed = sale.domainEvents.at(-1);
    expect(changed?.type).toBe('SaleRecipientChanged');
    expect(changed?.payload).toEqual({ attached: true, country: 'VE', type: 'RIF' });
    expect(JSON.stringify(changed?.payload)).not.toContain('J123456789');
    expect(JSON.stringify(changed?.payload)).not.toContain('Bodega Central');

    sale.registerPayments({
      payments: [Payment.create({
        id: 'payment-001',
        method: PaymentMethod.create({
          code: 'CASH_USD', name: 'Cash USD', kind: 'CASH', currencyCode: 'USD'
        }),
        amount: Money.fromMinorUnits(1160, 'USD'),
        amountInSaleCurrency: Money.fromMinorUnits(1160, 'USD'),
        exchangeRate: null,
        registeredBy: 'user-001',
        registeredAt: new Date('2026-08-15T10:01:00.000Z')
      })],
      financialTransactionTax: Money.zero('USD'),
      occurredAt: new Date('2026-08-15T10:01:00.000Z'), eventIds: ['event-004']
    });
    sale.setRecipient({
      recipient: null, occurredAt: new Date('2026-08-15T10:01:10.000Z'), eventId: 'event-005'
    });
    expect(sale.recipient).toBeNull();

    sale.complete({ completedAt: new Date('2026-08-15T10:02:00.000Z'), eventId: 'event-006' });
    expect(() => sale.setRecipient({
      recipient: null, occurredAt: new Date('2026-08-15T10:03:00.000Z'), eventId: 'event-007'
    })).toThrowError(expect.objectContaining({ code: 'SALE_INVALID_STATE' }));
  });

  it('does not expose the stored recipient to callers that mutate the copy', () => {
    const sale = startSale();
    sale.setRecipient({
      recipient: createSaleRecipientSnapshot({ country: 'VE', type: 'RIF', value: 'J123456789' }),
      occurredAt: new Date('2026-08-15T10:00:45.000Z'), eventId: 'event-002'
    });

    const copy = sale.recipient as { normalizedValue: string };
    copy.normalizedValue = 'TAMPERED';
    expect(sale.recipient?.normalizedValue).toBe('J123456789');
  });
});
