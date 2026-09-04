import { describe, expect, it } from 'vitest';
import { Category, Product, UnitOfMeasure } from '../../domain/catalog/index.js';
import type {
  AuthorizationService,
  CategoryRepository,
  IdGenerator,
  ProductRepository,
  UnitOfMeasureRepository
} from '../ports/index.js';
import type { ExecutionContext } from '../execution-context.js';
import { CreateProduct } from './create-product.js';

class FakeIdGenerator implements IdGenerator {
  private index = 0;

  generate(): string {
    this.index += 1;
    return `generated-${this.index}`;
  }
}

class FakeCategoryRepository implements CategoryRepository {
  category: Category | null = Category.create({ id: 'category-001', name: 'Grocery' });

  async findById(): Promise<Category | null> {
    return this.category;
  }
}

class FakeUnitRepository implements UnitOfMeasureRepository {
  unit: UnitOfMeasure | null = UnitOfMeasure.create({
    id: 'unit-001',
    code: 'UNIT',
    name: 'Unit',
    quantityScale: 0
  });

  async findByCode(): Promise<UnitOfMeasure | null> {
    return this.unit;
  }
}

class FakeProductRepository implements ProductRepository {
  products: Product[] = [];

  async save(product: Product): Promise<void> {
    this.products.push(product);
  }

  async findById(): Promise<Product | null> {
    return null;
  }

  async findByActiveBarcode(): Promise<Product | null> {
    return null;
  }
}

const context: ExecutionContext = {
  actorId: 'user-001',
  actorRoleCodes: ['ADMIN'],
  terminalId: 'terminal-001',
  originNodeId: 'node-001',
  correlationId: 'correlation-001'
};

const authorization = (allowed = true): AuthorizationService => ({
  authorize: async () => allowed
});

describe('CreateProduct', () => {
  it('creates a product after validating configurable references', async () => {
    const repository = new FakeProductRepository();
    const useCase = new CreateProduct(
      new FakeIdGenerator(),
      repository,
      new FakeCategoryRepository(),
      new FakeUnitRepository(),
      { now: () => new Date('2026-08-15T10:00:00.000Z') },
      authorization()
    );

    const result = await useCase.execute({
      name: 'Coffee',
      description: 'Ground coffee',
      categoryId: 'category-001',
      unitCode: 'unit',
      barcodes: ['0123456789'],
      priceMinorUnits: 1250,
      currencyCode: 'USD',
      taxRateBasisPoints: 1600,
      reason: 'Initial catalog load'
    }, context);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe('generated-1');
    expect(result.value.snapshot.priceMinorUnits).toBe(1250);
    expect(repository.products).toHaveLength(1);
  });

  it('does not save when the category is missing', async () => {
    const repository = new FakeProductRepository();
    const categories = new FakeCategoryRepository();
    categories.category = null;
    const useCase = new CreateProduct(
      new FakeIdGenerator(),
      repository,
      categories,
      new FakeUnitRepository(),
      { now: () => new Date('2026-08-15T10:00:00.000Z') },
      authorization()
    );

    const result = await useCase.execute({
      name: 'Coffee',
      description: 'Ground coffee',
      categoryId: 'category-missing',
      unitCode: 'UNIT',
      barcodes: ['0123456789'],
      priceMinorUnits: 1250,
      currencyCode: 'USD',
      taxRateBasisPoints: 1600,
      reason: 'Initial catalog load'
    }, context);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CATEGORY_NOT_FOUND');
    expect(repository.products).toHaveLength(0);
  });

  it('checks permission before reading references or saving', async () => {
    const repository = new FakeProductRepository();
    const categories = new FakeCategoryRepository();
    let categoryReads = 0;
    categories.findById = async () => {
      categoryReads += 1;
      return categories.category;
    };
    const useCase = new CreateProduct(
      new FakeIdGenerator(), repository, categories, new FakeUnitRepository(),
      { now: () => new Date('2026-08-15T10:00:00.000Z') }, authorization(false)
    );

    const result = await useCase.execute({
      name: 'Coffee', description: 'Ground coffee', categoryId: 'category-001',
      unitCode: 'UNIT', barcodes: [], priceMinorUnits: 1250,
      currencyCode: 'USD', taxRateBasisPoints: 1600, reason: 'Initial load'
    }, context);

    expect(result).toEqual(expect.objectContaining({
      ok: false, error: expect.objectContaining({ code: 'FORBIDDEN' })
    }));
    expect(categoryReads).toBe(0);
    expect(repository.products).toHaveLength(0);
  });
});
