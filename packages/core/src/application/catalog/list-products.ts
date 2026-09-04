import { ok, type Result, type AppError } from '@supermarket/shared';
import type { CatalogReadRepository } from '../ports/index.js';
import type { ProductDto } from './dtos.js';
import { toProductDto } from './mappers.js';

export class ListProducts {
  constructor(private readonly repository: CatalogReadRepository) {}

  async execute(query = ''): Promise<Result<readonly ProductDto[], AppError>> {
    const normalized = query.trim().toLowerCase();
    const products = await this.repository.findAll();
    return ok(products
      .filter((product) => normalized.length === 0
        || product.name.toLowerCase().includes(normalized)
        || product.barcodes.some((barcode) => barcode.value.includes(normalized)))
      .map(toProductDto));
  }
}
