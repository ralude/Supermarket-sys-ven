import { describe, expect, it } from 'vitest';
import { Category } from '../../domain/catalog/index.js';
import type { CategoryRepository } from '../ports/index.js';
import { ListCategories } from './list-categories.js';

class FakeCategoryRepository implements CategoryRepository {
  constructor(private readonly categories: readonly Category[]) {}

  async findById(categoryId: string): Promise<Category | null> {
    return this.categories.find((category) => category.id === categoryId) ?? null;
  }

  async findAll(): Promise<readonly Category[]> {
    return this.categories;
  }
}

describe('ListCategories', () => {
  it('lists only active categories, without exposing the inactive flag', async () => {
    const active = Category.create({ id: 'category-001', name: 'Grocery' });
    const inactive = Category.create({ id: 'category-002', name: 'Discontinued', isActive: false });
    const useCase = new ListCategories(new FakeCategoryRepository([active, inactive]));

    const result = await useCase.execute();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([{ id: 'category-001', name: 'Grocery' }]);
  });

  it('returns an empty list rather than failing when no category is configured', async () => {
    const useCase = new ListCategories(new FakeCategoryRepository([]));

    const result = await useCase.execute();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([]);
  });
});
