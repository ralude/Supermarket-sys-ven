import type { Product, ProductSnapshot } from '../../domain/catalog/index.js';
import type { ProductDto, ProductSnapshotDto } from './dtos.js';

export function toSnapshotDto(snapshot: ProductSnapshot): ProductSnapshotDto {
  return {
    productId: snapshot.productId,
    description: snapshot.description,
    priceMinorUnits: snapshot.price.minorUnits,
    currencyCode: snapshot.price.currency,
    taxRateBasisPoints: snapshot.taxRate.basisPoints,
    unitCode: snapshot.unitCode,
    unitScale: snapshot.unitScale
  };
}

export function toProductDto(product: Product): ProductDto {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    categoryId: product.categoryId,
    unitCode: product.unitOfMeasure.code,
    unitScale: product.unitOfMeasure.quantityScale,
    barcodes: product.barcodes.filter((barcode) => barcode.isActive).map((barcode) => barcode.value),
    price: {
      amountMinorUnits: product.price.minorUnits,
      currencyCode: product.price.currency
    },
    taxRateBasisPoints: product.taxRate.basisPoints,
    isActive: product.isActive,
    version: product.version,
    snapshot: toSnapshotDto(product.createSnapshot())
  };
}
