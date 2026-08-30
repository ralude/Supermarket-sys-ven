import type { StockItem, StockMovement } from '../../domain/inventory/index.js';
import type { StockItemDto, StockMovementDto } from './dtos.js';

export const toStockMovementDto = (movement: StockMovement): StockMovementDto => ({
  id: movement.id,
  type: movement.type,
  direction: movement.direction,
  quantityScaled: movement.quantity.scaledValue,
  quantityScale: movement.quantity.scale,
  batchId: movement.batchId,
  actorId: movement.actorId,
  reason: movement.reason,
  referenceId: movement.referenceId,
  occurredAt: movement.occurredAt
});

export const toStockItemDto = (item: StockItem): StockItemDto => ({
  id: item.id,
  productId: item.productId,
  unitCode: item.unitCode,
  quantityScale: item.quantityScale,
  tracksBatches: item.tracksBatches,
  balanceScaled: item.balance.scaledValue,
  movements: item.movements.map(toStockMovementDto)
});
