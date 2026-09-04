import { describe, expect, it } from 'vitest';
import { Category, Product, UnitOfMeasure } from '../../domain/catalog/index.js';
import { Money, TaxRate } from '@supermarket/shared';
import type {
  AuthorizationService,
  CategoryRepository,
  ProductRepository,
  UnitOfMeasureRepository
} from '../ports/index.js';
import type { ExecutionContext } from '../execution-context.js';
import { UpdateProduct } from './update-product.js';

const category = Category.create({ id: 'category-001', name: 'Grocery' });
const unit = UnitOfMeasure.create({ id: 'unit-001', code: 'UNIT', name: 'Unit', quantityScale: 0 });

function product(): Product {
  return Product.create({
    id: 'product-001',
    name: 'Coffee',
    description: 'Ground coffee',
    categoryId: category.id,
    unitOfMeasure: unit,
    barcodes: [],
    price: Money.fromMinorUnits(1250, 'USD'),
    taxRate: TaxRate.fromBasisPoints(1600),
    priceHistoryId: 'price-001',
    recordedBy: 'user-001',
    occurredAt: new Date('2026-08-15T10:00:00.000Z'),
    eventId: 'event-001'
  });
}

class FakeProductRepository implements ProductRepository {
  stored = product();
  saves = 0;

  async save(value: Product): Promise<void> {
    this.saves += 1;
    this.stored = value;
  }

  async findById(): Promise<Product | null> {
    return this.stored;
  }

  async findByActiveBarcode(): Promise<Product | null> {
    return null;
  }
}

const context: ExecutionContext = {
  actorId: 'user-002', terminalId: 'terminal-001', originNodeId: 'node-001',
  correlationId: 'correlation-001', actorRoleCodes: ['ADMIN']
};
const authorization = (allowed = true): AuthorizationService => ({ authorize: async () => allowed });

class FakeCategoryRepository implements CategoryRepository {
  async findById(): Promise<Category | null> {
    return category;
  }

  async findAll(): Promise<readonly Category[]> {
    return [category];
  }
}

class FakeUnitRepository implements UnitOfMeasureRepository {
  async findByCode(): Promise<UnitOfMeasure | null> {
    return unit;
  }

  async findAll(): Promise<readonly UnitOfMeasure[]> {
    return [unit];
  }
}

describe('UpdateProduct', () => {
  it('updates product details without changing its price', async () => {
    const repository = new FakeProductRepository();
    const useCase = new UpdateProduct(
      repository,
      new FakeCategoryRepository(),
      new FakeUnitRepository(),
      { generate: () => 'generated-barcode-id' },
      { now: () => new Date('2026-08-16T10:00:00.000Z') },
      authorization()
    );

    const result = await useCase.execute({
      productId: 'product-001',
      name: 'Premium Coffee',
      description: 'Premium ground coffee',
      categoryId: 'category-001',
      unitCode: 'UNIT',
      barcodes: ['0123456789'],
      isActive: true,
      reason: 'Improve description'
    }, context);

    expect(result.ok).toBe(true);
    expect(repository.stored.name).toBe('Premium Coffee');
    expect(repository.stored.price.minorUnits).toBe(1250);
  });

  it('does not load or save a product when permission is denied', async () => {
    const repository = new FakeProductRepository();
    let reads = 0;
    repository.findById = async () => { reads += 1; return repository.stored; };
    const useCase = new UpdateProduct(
      repository, new FakeCategoryRepository(), new FakeUnitRepository(),
      { generate: () => 'generated-barcode-id' },
      { now: () => new Date('2026-08-16T10:00:00.000Z') }, authorization(false)
    );

    const result = await useCase.execute({
      productId: 'product-001', name: 'Premium Coffee', reason: 'Improve description'
    }, context);

    expect(result).toEqual(expect.objectContaining({
      ok: false, error: expect.objectContaining({ code: 'FORBIDDEN' })
    }));
    expect(reads).toBe(0);
    expect(repository.saves).toBe(0);
  });
});
