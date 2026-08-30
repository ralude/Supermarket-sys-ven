import { ApplicationError, DomainError, err, Quantity, ok, type AppError, type Result } from '@supermarket/shared';
import { StockItem } from '../../domain/inventory/index.js';
import type { ExecutionContext } from '../execution-context.js';
import { persistBusinessChange } from '../events/index.js';
import type { AuditWriter, AuthorizationService, BusinessEventStore, Clock, IdGenerator, StockItemRepository, UnitOfWork } from '../ports/index.js';
import type { ReceivePurchaseInput, StockItemDto } from './dtos.js';
import { toStockItemDto } from './mappers.js';
import { INVENTORY_PERMISSIONS } from './permissions.js';

export class ReceivePurchase {
  constructor(
    private readonly repository: StockItemRepository,
    private readonly authorization: AuthorizationService,
    private readonly movementIdGenerator: IdGenerator,
    private readonly batchIdGenerator: IdGenerator,
    private readonly eventIdGenerator: IdGenerator,
    private readonly auditIdGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly unitOfWork: UnitOfWork,
    private readonly eventStore: BusinessEventStore,
    private readonly auditWriter: AuditWriter
  ) {}

  async execute(input: ReceivePurchaseInput, context: ExecutionContext): Promise<Result<StockItemDto, AppError>> {
    if (!(await this.authorization.authorize(context, INVENTORY_PERMISSIONS.RECEIVE_PURCHASE))) {
      return err(new ApplicationError('FORBIDDEN', 'Actor is not authorized to receive purchases.'));
    }
    try {
      return await this.unitOfWork.execute(async () => {
        let item = await this.repository.findByProductId(input.productId);
        if (item === null) item = StockItem.create({
          id: input.stockItemId,
          productId: input.productId,
          unitCode: input.unitCode,
          quantityScale: input.quantityScale,
          tracksBatches: input.tracksBatches
        });
        if (item.id !== input.stockItemId || item.unitCode !== input.unitCode.trim().toUpperCase() ||
          item.quantityScale !== input.quantityScale || item.tracksBatches !== input.tracksBatches) {
          return err(new ApplicationError('STOCK_ITEM_CONFIGURATION_MISMATCH', 'Stock item configuration does not match.'));
        }
        let batchId: string | undefined;
        if (item.tracksBatches) {
          if (!input.lot) return err(new ApplicationError('STOCK_BATCH_REQUIRED', 'A lot is required for this receipt.'));
          const lotNumber = input.lot.lotNumber.trim().toUpperCase();
          const batch = item.batches.find((candidate) => candidate.lotNumber === lotNumber) ?? item.registerBatch({
            id: this.batchIdGenerator.generate(), lotNumber,
            ...(input.lot.expiresAt ? { expiresAt: input.lot.expiresAt } : {})
          });
          batchId = batch.id;
        } else if (input.lot) {
          return err(new ApplicationError('STOCK_BATCH_NOT_ACCEPTED', 'This stock item does not accept a lot.'));
        }
        const previousEventCount = item.domainEvents.length;
        const occurredAt = this.clock.now();
        const movement = item.registerMovement({
          id: this.movementIdGenerator.generate(), type: 'PURCHASE_RECEIPT',
          quantity: Quantity.fromScaled(input.quantityScaled, input.quantityScale),
          ...(batchId ? { batchId } : {}), actorId: context.actorId, reason: input.reason,
          referenceId: input.receiptId, occurredAt, eventId: this.eventIdGenerator.generate()
        });
        await persistBusinessChange(
          () => this.repository.save(item), item.domainEvents.slice(previousEventCount), context,
          undefined, this.eventStore, undefined, [], this.auditWriter, [{
            auditId: this.auditIdGenerator.generate(), actorId: context.actorId,
            actorRoleCodes: context.actorRoleCodes ?? [], action: 'PURCHASE_RECEIPT_REGISTERED',
            entityType: 'StockItem', entityId: item.id, before: null,
            after: { supplierId: input.supplierId, receiptId: input.receiptId, movementId: movement.id,
              quantityScaled: movement.quantity.scaledValue, quantityScale: movement.quantity.scale,
              batchId: movement.batchId },
            reason: movement.reason, terminalId: context.terminalId, originNodeId: context.originNodeId,
            occurredAt, correlationId: context.correlationId
          }]
        );
        return ok(toStockItemDto(item));
      });
    } catch (error) {
      if (error instanceof DomainError) return err(error);
      throw error;
    }
  }
}
