import { DomainError, Quantity } from '@supermarket/shared';
import { Batch, type BatchProps } from './batch.js';
import { StockMovement, type StockMovementProps } from './stock-movement.js';

export type StockItemProps = {
  id: string;
  productId: string;
  unitCode: string;
  quantityScale: number;
  tracksBatches: boolean;
};

const UNIT_CODE_PATTERN = /^[A-Z][A-Z0-9_-]*$/;

export class StockItem {
  private readonly currentBatches: Batch[] = [];
  private readonly currentMovements: StockMovement[] = [];

  private constructor(
    readonly id: string,
    readonly productId: string,
    readonly unitCode: string,
    readonly quantityScale: number,
    readonly tracksBatches: boolean
  ) {}

  static create(props: StockItemProps): StockItem {
    const id = StockItem.requireText(props.id, 'STOCK_ITEM_ID_REQUIRED', 'Stock item ID is required.');
    const productId = StockItem.requireText(
      props.productId,
      'STOCK_PRODUCT_ID_REQUIRED',
      'Stock product ID is required.'
    );
    const unitCode = props.unitCode.trim().toUpperCase();
    if (!UNIT_CODE_PATTERN.test(unitCode)) {
      throw new DomainError('STOCK_UNIT_CODE_INVALID', 'Stock unit code is invalid.');
    }
    if (!Number.isInteger(props.quantityScale) || props.quantityScale < 0 || props.quantityScale > 6) {
      throw new DomainError(
        'STOCK_QUANTITY_SCALE_INVALID',
        'Stock quantity scale must be an integer between 0 and 6.'
      );
    }
    return new StockItem(id, productId, unitCode, props.quantityScale, props.tracksBatches);
  }

  get batches(): readonly Batch[] {
    return [...this.currentBatches];
  }

  get movements(): readonly StockMovement[] {
    return [...this.currentMovements];
  }

  get balance(): Quantity {
    return this.calculateBalance();
  }

  registerBatch(props: BatchProps): Batch {
    if (!this.tracksBatches) {
      throw new DomainError('STOCK_BATCH_NOT_TRACKED', 'This stock item does not track batches.');
    }
    const batch = Batch.create(props);
    if (this.currentBatches.some((existing) => existing.id === batch.id)) {
      throw new DomainError('STOCK_BATCH_DUPLICATE', 'Stock batch already exists.');
    }
    if (this.currentBatches.some((existing) => existing.lotNumber === batch.lotNumber)) {
      throw new DomainError(
        'STOCK_BATCH_LOT_DUPLICATE',
        'Stock batch lot number must be unique.'
      );
    }
    this.currentBatches.push(batch);
    return batch;
  }

  registerMovement(props: StockMovementProps): StockMovement {
    if (this.currentMovements.some((movement) => movement.id === props.id.trim())) {
      throw new DomainError('STOCK_MOVEMENT_DUPLICATE', 'Stock movement already exists.');
    }
    const movement = StockMovement.create(props);
    if (movement.quantity.scale !== this.quantityScale) {
      throw new DomainError(
        'STOCK_QUANTITY_SCALE_MISMATCH',
        'Stock movement quantity scale must match the stock item scale.'
      );
    }
    this.assertBatchPolicy(movement);
    if (movement.direction === 'OUT') {
      const available = movement.batchId === null
        ? this.balance
        : this.balanceForBatch(movement.batchId);
      if (movement.quantity.scaledValue > available.scaledValue) {
        throw new DomainError(
          'STOCK_INSUFFICIENT',
          'Stock movement exceeds the available balance.'
        );
      }
    }
    this.currentMovements.push(movement);
    return movement;
  }

  balanceForBatch(batchId: string): Quantity {
    if (!this.tracksBatches) {
      throw new DomainError('STOCK_BATCH_NOT_TRACKED', 'This stock item does not track batches.');
    }
    const normalized = batchId.trim();
    if (!this.currentBatches.some((batch) => batch.id === normalized)) {
      throw new DomainError('STOCK_BATCH_NOT_FOUND', 'Stock batch was not found.');
    }
    return this.calculateBalance(normalized);
  }

  private assertBatchPolicy(movement: StockMovement): void {
    if (!this.tracksBatches && movement.batchId !== null) {
      throw new DomainError('STOCK_BATCH_NOT_ACCEPTED', 'This stock item does not accept a batch.');
    }
    if (this.tracksBatches && movement.batchId === null) {
      throw new DomainError('STOCK_BATCH_REQUIRED', 'A batch is required for this stock item.');
    }
    if (
      movement.batchId !== null &&
      !this.currentBatches.some((batch) => batch.id === movement.batchId)
    ) {
      throw new DomainError('STOCK_BATCH_NOT_FOUND', 'Stock batch was not found.');
    }
  }

  private calculateBalance(batchId?: string): Quantity {
    let balance = Quantity.zero(this.quantityScale);
    for (const movement of this.currentMovements) {
      if (batchId !== undefined && movement.batchId !== batchId) continue;
      balance = movement.direction === 'IN'
        ? balance.add(movement.quantity)
        : balance.subtract(movement.quantity);
    }
    return balance;
  }

  private static requireText(value: string, code: string, message: string): string {
    const normalized = value.trim();
    if (normalized.length === 0) throw new DomainError(code, message);
    return normalized;
  }
}
