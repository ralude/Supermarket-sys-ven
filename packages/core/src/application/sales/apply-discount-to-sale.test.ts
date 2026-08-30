import { describe, expect, it } from 'vitest';
import { Money, Quantity, TaxRate } from '@supermarket/shared';
import { ProductSnapshot } from '../../domain/catalog/index.js';
import { Sale } from '../../domain/sales/index.js';
import type { ExecutionContext } from '../execution-context.js';
import type { AuditEntry, AuthorizationService, SaleRepository } from '../ports/index.js';
import { ApplyDiscountToSale } from './apply-discount-to-sale.js';

const context: ExecutionContext = {
  actorId: 'user-001',
  terminalId: 'terminal-001',
  originNodeId: 'node-001',
  correlationId: 'correlation-001',
  actorRoleCodes: ['MANAGER']
};

class FakeSaleRepository implements SaleRepository {
  stored: Sale;

  constructor() {
    this.stored = Sale.start({
      id: 'sale-001', shiftId: 'shift-001',
      currencyCode: 'USD',
      terminalId: 'terminal-001',
      originNodeId: 'node-001',
      startedBy: 'user-001',
      startedAt: new Date('2026-08-15T10:00:00.000Z'),
      eventId: 'event-001'
    });
    this.stored.addItem({
      id: 'item-001',
      snapshot: ProductSnapshot.create({
        productId: 'product-001',
        description: 'Coffee',
        price: Money.fromMinorUnits(1000, 'USD'),
        taxRate: TaxRate.fromBasisPoints(1600),
        unitCode: 'UNIT',
        unitScale: 0
      }),
      quantity: Quantity.fromScaled(1, 0),
      occurredAt: new Date('2026-08-15T10:00:30.000Z'),
      eventId: 'event-002'
    });
  }

  async save(sale: Sale): Promise<void> {
    this.stored = sale;
  }

  async findById(): Promise<Sale | null> {
    return this.stored;
  }
}

describe('ApplyDiscountToSale', () => {
  it('requires authorization and applies the configured line limit', async () => {
    const repository = new FakeSaleRepository();
    const auditEntries: AuditEntry[] = [];
    const authorizationCalls: Parameters<AuthorizationService['authorize']>[] = [];
    const useCase = new ApplyDiscountToSale(
      repository,
      { generate: () => 'discount-001' },
      { generate: () => 'event-003' },
      { now: () => new Date('2026-08-15T10:01:00.000Z') },
      { getPolicy: async () => ({ id: 'policy-001', maximumBasisPoints: 1000 }) },
      {
        authorize: async (...args) => {
          authorizationCalls.push(args);
          return true;
        }
      },
      undefined,
      undefined,
      { append: async (entries) => { auditEntries.push(...entries); } }
    );

    const result = await useCase.execute(
      { saleId: 'sale-001', itemId: 'item-001', basisPoints: 1000, reason: 'Promotion' },
      context
    );

    expect(result.ok).toBe(true);
    expect(repository.stored.discountTotal.minorUnits).toBe(100);
    expect(repository.stored.taxTotal.minorUnits).toBe(144);
    expect(authorizationCalls).toEqual([[context, 'sale.apply_discount']]);
    expect(auditEntries).toMatchObject([{
      action: 'SALE_DISCOUNT_OVERRIDE_APPLIED', actorRoleCodes: ['MANAGER'], reason: 'Promotion'
    }]);
  });
});
