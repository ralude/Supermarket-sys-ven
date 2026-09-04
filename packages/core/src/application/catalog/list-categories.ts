import { ok, type Result, type AppError } from '@supermarket/shared';
import type { CategoryRepository } from '../ports/index.js';
import type { CategoryDto } from './dtos.js';

/**
 * Lista las categorías activas para que la interfaz las ofrezca como selector,
 * en lugar de exigir que el operador escriba un identificador interno.
 */
export class ListCategories {
  constructor(private readonly repository: CategoryRepository) {}

  async execute(): Promise<Result<readonly CategoryDto[], AppError>> {
    const categories = await this.repository.findAll();
    return ok(categories
      .filter((category) => category.isActive)
      .map((category) => ({ id: category.id, name: category.name })));
  }
}
