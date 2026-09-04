import type { Product } from '../../domain/catalog/index.js';

export interface CatalogReadRepository {
  findAll(): Promise<readonly Product[]>;
  findById(productId: string): Promise<Product | null>;
}
