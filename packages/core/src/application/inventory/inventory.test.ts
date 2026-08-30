import { describe, expect, it } from 'vitest';
import { Quantity } from '@supermarket/shared';
import { StockItem } from '../../domain/inventory/index.js';
import type { ExecutionContext } from '../execution-context.js';
import type { BusinessEventV1 } from '../events/index.js';
import type {
  AuditEntry,
  AuditWriter,
  BusinessEventStore,
  IdGenerator,
  StockItemRepository,
  UnitOfWork
} from '../ports/index.js';
import { ApplySaleCompletedToInventory } from './apply-sale-completed-to-inventory.js';
import { GetKardex } from './get-kardex.js';
import { ReceivePurchase } from './receive-purchase.js';
import { RegisterStockAdjustment } from './register-stock-adjustment.js';

const context: ExecutionContext = {
  actorId: 'user-001',
  actorRoleCodes: ['inventory-manager'],
  terminalId: 'terminal-001',
  originNodeId: 'node-001',
  correlationId: 'correlation-001'
};

class FakeStockItemRepository implements StockItemRepository {
  saves = 0;
  constructor(public stored: StockItem | null = null) {}
  async save(item: StockItem): Promise<void> { this.stored = item; this.saves += 1; }
  async findById(id: string): Promise<StockItem | null> {
    return this.stored?.id === id ? this.stored : null;
  }
  async findByProductId(productId: string): Promise<StockItem | null> {
    return this.stored?.productId === productId ? this.stored : null;
  }
}

const sequence = (prefix: string): IdGenerator => {
  let value = 0;
  return { generate: () => `${prefix}-${++value}` };
};

const evidence = () => ({ ledger: [] as string[], audit: [] as AuditEntry[] });
const unitOfWork: UnitOfWork = { execute: async (work) => work() };
const eventStore = (ledger: string[]): BusinessEventStore => ({
  append: async (events) => { ledger.push(...events.map((event) => event.eventType)); },
  findByAggregate: async () => []
});
const auditWriter = (audit: AuditEntry[]): AuditWriter => ({
  append: async (entries) => { audit.push(...entries); }
});

const stockedBatches = (): StockItem => {
  const item = StockItem.create({
    id: 'stock-001', productId: 'product-001', unitCode: 'UNIT',
    quantityScale: 0, tracksBatches: true
  });
  item.registerBatch({
    id: 'batch-late', lotNumber: 'LATE', expiresAt: new Date('2027-02-01T00:00:00.000Z')
  });
  item.registerBatch({
    id: 'batch-first', lotNumber: 'FIRST', expiresAt: new Date('2027-01-01T00:00:00.000Z')
  });
  item.registerMovement({
    id: 'receipt-late', eventId: 'receipt-event-late', type: 'PURCHASE_RECEIPT',
    quantity: Quantity.fromScaled(5, 0), batchId: 'batch-late', actorId: 'user-001',
    reason: 'Purchase', referenceId: 'receipt-001', occurredAt: new Date('2026-08-01T10:00:00.000Z')
  });
  item.registerMovement({
    id: 'receipt-first', eventId: 'receipt-event-first', type: 'PURCHASE_RECEIPT',
    quantity: Quantity.fromScaled(2, 0), batchId: 'batch-first', actorId: 'user-001',
    reason: 'Purchase', referenceId: 'receipt-002', occurredAt: new Date('2026-08-02T10:00:00.000Z')
  });
  return item;
};

describe('inventory application', () => {
  it('receives a purchase by lot and records supplier, ledger and audit evidence', async () => {
    const repository = new FakeStockItemRepository();
    const recorded = evidence();
    const service = new ReceivePurchase(
      repository,
      { authorize: async (_context, permission) => permission === 'inventory.purchase.receive' },
      sequence('movement'), sequence('batch'), sequence('event'), sequence('audit'),
      { now: () => new Date('2026-08-20T10:00:00.000Z') }, unitOfWork,
      eventStore(recorded.ledger), auditWriter(recorded.audit)
    );

    const result = await service.execute({
      stockItemId: 'stock-001', productId: 'product-001', unitCode: 'UNIT',
      quantityScale: 0, tracksBatches: true, quantityScaled: 10,
      supplierId: 'supplier-001', receiptId: 'receipt-001', reason: 'Supplier delivery',
      lot: { lotNumber: 'lot-001', expiresAt: new Date('2027-08-20T00:00:00.000Z') }
    }, context);

    expect(result.ok).toBe(true);
    expect(repository.stored?.balance.scaledValue).toBe(10);
    expect(repository.stored?.batches[0]?.lotNumber).toBe('LOT-001');
    expect(recorded.ledger).toEqual(['StockMovementRegistered']);
    expect(recorded.audit).toMatchObject([{
      action: 'PURCHASE_RECEIPT_REGISTERED',
      after: { supplierId: 'supplier-001', receiptId: 'receipt-001' }
    }]);
  });

  it('applies SaleCompleted with FEFO and ignores an identical redelivery', async () => {
    const repository = new FakeStockItemRepository(stockedBatches());
    const recorded = evidence();
    const service = new ApplySaleCompletedToInventory(
      repository, sequence('stock-event'), sequence('audit'), unitOfWork,
      eventStore(recorded.ledger), auditWriter(recorded.audit)
    );
    const sale: BusinessEventV1 = {
      eventId: 'sale-event-001', eventType: 'SaleCompleted', contractVersion: 1,
      aggregateId: 'sale-001', aggregateType: 'Sale', aggregateVersion: 5,
      originNodeId: 'node-001', correlationId: 'correlation-001', actorId: 'user-001',
      occurredAt: new Date('2026-08-20T11:00:00.000Z'),
      payload: {
        terminalId: 'terminal-001',
        items: [{ itemId: 'line-001', productId: 'product-001', quantityScaled: 3, quantityScale: 0 }]
      }
    };

    expect((await service.execute(sale)).ok).toBe(true);
    expect(repository.stored?.balance.scaledValue).toBe(4);
    expect(repository.stored?.balanceForBatch('batch-first').scaledValue).toBe(0);
    expect(repository.stored?.balanceForBatch('batch-late').scaledValue).toBe(4);
    expect(repository.stored?.movements.filter((movement) => movement.type === 'SALE_ISSUE'))
      .toHaveLength(2);
    expect((await service.execute(sale)).ok).toBe(true);
    expect(repository.saves).toBe(1);
    expect(recorded.ledger).toEqual(['StockMovementRegistered', 'StockMovementRegistered']);
    expect(recorded.audit).toMatchObject([{ action: 'SALE_STOCK_ISSUED' }]);
  });

  it('authorizes waste and records the balance before and after the adjustment', async () => {
    const repository = new FakeStockItemRepository(stockedBatches());
    const recorded = evidence();
    const requestedPermissions: string[] = [];
    const service = new RegisterStockAdjustment(
      repository,
      { authorize: async (_context, permission) => {
        requestedPermissions.push(permission);
        return true;
      } },
      sequence('movement'), sequence('event'), sequence('audit'),
      { now: () => new Date('2026-08-20T12:00:00.000Z') }, unitOfWork,
      eventStore(recorded.ledger), auditWriter(recorded.audit)
    );

    const result = await service.execute({
      stockItemId: 'stock-001', type: 'WASTE', quantityScaled: 1, quantityScale: 0,
      batchId: 'batch-first', reason: 'Damaged package', referenceId: 'waste-001'
    }, context);

    expect(result.ok).toBe(true);
    expect(requestedPermissions).toEqual(['inventory.waste.register']);
    expect(recorded.audit).toMatchObject([{
      action: 'STOCK_WASTE_REGISTERED',
      before: { balanceScaled: 7 }, after: { balanceScaled: 6 }, reason: 'Damaged package'
    }]);
  });

  it('queries kardex by batch, date and reason while deriving its current balance', async () => {
    const repository = new FakeStockItemRepository(stockedBatches());
    const result = await new GetKardex(repository).execute({
      productId: 'product-001', batchId: 'batch-first',
      from: new Date('2026-08-02T00:00:00.000Z'),
      to: new Date('2026-08-03T00:00:00.000Z'), reason: 'purchase'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.currentBalanceScaled).toBe(2);
    expect(result.value.movements).toMatchObject([{
      id: 'receipt-first', batchId: 'batch-first', reason: 'Purchase'
    }]);
  });
});
