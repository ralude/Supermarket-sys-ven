import { ApplicationError, err, ok, type AppError, type Result } from '@supermarket/shared';
import type { StockItemRepository } from '../ports/index.js';
import type { GetKardexInput, KardexDto } from './dtos.js';
import { toStockMovementDto } from './mappers.js';

export class GetKardex {
  constructor(private readonly repository: StockItemRepository) {}

  async execute(input: GetKardexInput): Promise<Result<KardexDto, AppError>> {
    const item = await this.repository.findByProductId(input.productId);
    if (!item) return err(new ApplicationError('STOCK_ITEM_NOT_FOUND', 'Stock item was not found.'));
    const reason = input.reason?.trim().toLowerCase();
    const movements = item.movements.filter((movement) =>
      (input.batchId === undefined || movement.batchId === input.batchId) &&
      (input.from === undefined || movement.occurredAt.getTime() >= input.from.getTime()) &&
      (input.to === undefined || movement.occurredAt.getTime() <= input.to.getTime()) &&
      (!reason || movement.reason.toLowerCase().includes(reason))
    ).sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime());
    const currentBalance = input.batchId === undefined ? item.balance : item.balanceForBatch(input.batchId);
    return ok({ id: item.id, productId: item.productId, unitCode: item.unitCode, quantityScale: item.quantityScale,
      currentBalanceScaled: currentBalance.scaledValue,
      batches: item.batches.map((batch) => ({
        id: batch.id, lotNumber: batch.lotNumber, expiresAt: batch.expiresAt
      })),
      movements: movements.map(toStockMovementDto) });
  }
}
