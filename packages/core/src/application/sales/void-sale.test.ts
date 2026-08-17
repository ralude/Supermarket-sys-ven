import { describe, expect, it } from 'vitest';
import { Sale } from '../../domain/sales/index.js';
import type { ExecutionContext } from '../execution-context.js';
import type { AuthorizationService, SaleRepository } from '../ports/index.js';
import { VoidSale } from './void-sale.js';

const context: ExecutionContext = {
  actorId: 'user-001', terminalId: 'terminal-001', originNodeId: 'node-001', correlationId: 'correlation-001'
};

class FakeSaleRepository implements SaleRepository {
  stored = Sale.start({ id: 'sale-001', currencyCode: 'USD', terminalId: 'terminal-001', originNodeId: 'node-001', startedBy: 'user-001', startedAt: new Date('2026-08-15T10:00:00.000Z'), eventId: 'event-001' });
  async save(sale: Sale): Promise<void> { this.stored = sale; }
  async findById(): Promise<Sale | null> { return this.stored; }
}

describe('VoidSale', () => {
  it('authorizes and voids a draft with a reason', async () => {
    const repository = new FakeSaleRepository();
    const authorizationCalls: Parameters<AuthorizationService['authorize']>[] = [];
    const useCase = new VoidSale(
      repository,
      {
        authorize: async (...args) => {
          authorizationCalls.push(args);
          return true;
        }
      },
      { generate: () => 'event-002' },
      { now: () => new Date('2026-08-15T10:01:00.000Z') }
    );

    const result = await useCase.execute({ saleId: 'sale-001', reason: 'Customer cancelled' }, context);

    expect(result.ok).toBe(true);
    expect(repository.stored.status).toBe('VOIDED');
    expect(authorizationCalls).toEqual([[context, 'sale.void']]);
  });
});
