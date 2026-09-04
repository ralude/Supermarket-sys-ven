export type ReceivePurchaseInput = {
  stockItemId: string;
  productId: string;
  unitCode: string;
  quantityScale: number;
  tracksBatches: boolean;
  quantityScaled: number;
  supplierId: string;
  receiptId: string;
  reason: string;
  lot?: { lotNumber: string; expiresAt?: Date };
};

export type RegisterStockAdjustmentInput = {
  stockItemId: string;
  type: 'WASTE' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
  quantityScaled: number;
  quantityScale: number;
  batchId?: string;
  reason: string;
  referenceId: string;
};

export type StockMovementDto = {
  id: string;
  type: string;
  direction: 'IN' | 'OUT';
  quantityScaled: number;
  quantityScale: number;
  batchId: string | null;
  actorId: string;
  reason: string;
  referenceId: string;
  occurredAt: Date;
};

export type StockItemDto = {
  id: string;
  productId: string;
  unitCode: string;
  quantityScale: number;
  tracksBatches: boolean;
  balanceScaled: number;
  movements: StockMovementDto[];
};

export type GetKardexInput = {
  productId: string;
  batchId?: string;
  from?: Date;
  to?: Date;
  reason?: string;
};

export type KardexDto = {
  productId: string;
  unitCode: string;
  quantityScale: number;
  currentBalanceScaled: number;
  batches: { id: string; lotNumber: string; expiresAt: Date | null }[];
  movements: StockMovementDto[];
};
