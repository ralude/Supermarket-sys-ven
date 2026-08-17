import { describe, expect, it } from 'vitest';
import { Sale } from '../../domain/sales/index.js';
import type { ExecutionContext } from '../execution-context.js';
import type { SaleRepository } from '../ports/index.js';
import { StartSale } from './start-sale.js';

class FakeSaleRepository implements SaleRepository {
  sale: Sale | null = null;

  async save(sale: Sale): Promise<void> {
    this.sale = sale;
  }

  async findById(): Promise<Sale | null> {
    return this.sale;
  }
}

const context: ExecutionContext = {
  actorId: 'user-001',
  terminalId: 'terminal-001',
  originNodeId: 'node-001',
  correlationId: 'correlation-001'
};

describe('StartSale', () => {
  it('starts a draft sale owned by the execution terminal', async () => {
    const repository = new FakeSaleRepository();
    const useCase = new StartSale(
      { generate: () => 'sale-001' },
      { generate: () => 'event-001' },
      repository,
      { now: () => new Date('2026-08-15T10:00:00.000Z') }
    );

    const result = await useCase.execute({ currencyCode: 'USD' }, context);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe('sale-001');
    expect(result.value.status).toBe('DRAFT');
    expect(repository.sale?.terminalId).toBe('terminal-001');
  });
});
