import type { Category } from '../../domain/catalog/index.js';

/** Las categorías se administran como configuración del catálogo. */
export interface CategoryRepository {
  findById(categoryId: string): Promise<Category | null>;
  findAll(): Promise<readonly Category[]>;
}
