import { describe, expect, it } from 'vitest';
import { DomainError } from '@supermarket/shared';
import { Category } from './category.js';

describe('Category', () => {
  it('requires a non-empty name', () => {
    expect(() =>
      Category.create({ id: 'category-001', name: '  ', isActive: true })
    ).toThrowError(new DomainError('CATEGORY_NAME_REQUIRED', 'Category name is required.'));
  });

  it('normalizes its name and defaults to active', () => {
    const category = Category.create({ id: 'category-001', name: '  Grocery  ' });

    expect(category.name).toBe('Grocery');
    expect(category.isActive).toBe(true);
  });
});
