import type { CatalogReadRepository, Product } from '@supermarket/core';
import type { DatabaseHandle } from './connection.js';
import { products } from './schema.js';
import { DrizzleProductRepository } from './repositories.js';

export class DrizzleCatalogReadRepository implements CatalogReadRepository {
  private readonly productsRepository: DrizzleProductRepository;

  constructor(private readonly handle: DatabaseHandle) {
    this.productsRepository = new DrizzleProductRepository(handle);
  }

  async findAll(): Promise<readonly Product[]> {
    const rows = this.handle.db.select({ id: products.id }).from(products).all();
    const restored = await Promise.all(rows.map((row) => this.productsRepository.findById(row.id)));
    return restored.filter((product): product is Product => product !== null);
  }

  findById(productId: string): Promise<Product | null> {
    return this.productsRepository.findById(productId);
  }
}
