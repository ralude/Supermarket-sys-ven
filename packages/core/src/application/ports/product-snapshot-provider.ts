import type { ProductSnapshot } from '../../domain/catalog/index.js';

/** Contrato entre ventas y catálogo; no expone tablas del catálogo. */
export interface ProductSnapshotProvider {
  findSnapshotByBarcode(barcode: string): Promise<ProductSnapshot | null>;
}
