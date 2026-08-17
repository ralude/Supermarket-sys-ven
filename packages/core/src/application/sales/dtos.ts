export type SaleItemDto = {
  id: string;
  productId: string;
  description: string;
  quantityScaled: number;
  quantityScale: number;
  unitCode: string;
  grossMinorUnits: number;
  discountMinorUnits: number;
  taxableMinorUnits: number;
  taxMinorUnits: number;
  totalMinorUnits: number;
  discountBasisPoints: number | null;
};

export type SalePaymentDto = {
  id: string;
  methodCode: string;
  methodKind: string;
  currencyCode: string;
  amountMinorUnits: number;
  amountInSaleCurrencyMinorUnits: number;
  exchangeRateId: string | null;
};

export type SaleDto = {
  id: string;
  currencyCode: string;
  terminalId: string;
  originNodeId: string;
  status: string;
  version: number;
  items: SaleItemDto[];
  payments: SalePaymentDto[];
  subtotalMinorUnits: number;
  discountTotalMinorUnits: number;
  taxableBaseMinorUnits: number;
  taxTotalMinorUnits: number;
  financialTransactionTaxMinorUnits: number;
  totalMinorUnits: number;
  paidTotalMinorUnits: number;
  balanceMinorUnits: number;
  completedAt: Date | null;
  voidedAt: Date | null;
  voidReason: string | null;
};

export type StartSaleInput = {
  currencyCode: string;
};

export type AddItemToSaleInput = {
  saleId: string;
  barcode: string;
  quantityScaled: number;
  quantityScale: number;
};

export type RemoveItemFromSaleInput = {
  saleId: string;
  itemId: string;
};

export type ApplyDiscountToSaleInput = {
  saleId: string;
  itemId: string;
  basisPoints: number;
  reason: string;
};

export type RegisterMixedPaymentInput = {
  saleId: string;
  payments: Array<{
    methodCode: string;
    amountMinorUnits: number;
    currencyCode: string;
    exchangeRateId?: string;
  }>;
};

export type CompleteSaleInput = {
  saleId: string;
};

export type VoidSaleInput = {
  saleId: string;
  reason: string;
};
