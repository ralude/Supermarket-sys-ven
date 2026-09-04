export type CategoryDto = {
  id: string;
  name: string;
};

export type UnitOfMeasureDto = {
  code: string;
  name: string;
  quantityScale: number;
};

export type ProductMoneyDto = {
  amountMinorUnits: number;
  currencyCode: string;
};

export type ProductSnapshotDto = {
  productId: string;
  description: string;
  priceMinorUnits: number;
  currencyCode: string;
  taxRateBasisPoints: number;
  unitCode: string;
  unitScale: number;
};

export type ProductDto = {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  unitCode: string;
  unitScale: number;
  barcodes: string[];
  price: ProductMoneyDto;
  taxRateBasisPoints: number;
  isActive: boolean;
  version: number;
  snapshot: ProductSnapshotDto;
};

export type CreateProductInput = {
  name: string;
  description: string;
  categoryId: string;
  unitCode: string;
  barcodes: string[];
  priceMinorUnits: number;
  currencyCode: string;
  taxRateBasisPoints: number;
  reason: string;
};

export type UpdateProductInput = {
  productId: string;
  name?: string;
  description?: string;
  categoryId?: string;
  unitCode?: string;
  barcodes?: string[];
  isActive?: boolean;
  reason: string;
};

export type UpdatePriceInput = {
  productId: string;
  priceMinorUnits: number;
  currencyCode: string;
  reason: string;
};

export type FindProductByBarcodeInput = {
  barcode: string;
};

export type ProductLookupOutput = {
  product: ProductDto;
  snapshot: ProductSnapshotDto;
};
