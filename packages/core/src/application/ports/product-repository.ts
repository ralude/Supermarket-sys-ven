import type { Product } from '../../domain/catalog/index.js';

/** Persistencia real del catálogo en Fase 3. */
export interface ProductRepository {
  save(product: Product): Promise<void>;
  findById(productId: string): Promise<Product | null>;
  findByActiveBarcode(barcode: string): Promise<Product | null>;
}
