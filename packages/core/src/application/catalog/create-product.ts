import {
  ApplicationError,
  DomainError,
  err,
  Money,
  ok,
  TaxRate,
  type AppError,
  type Result
} from '@supermarket/shared';
import { Barcode, Product } from '../../domain/catalog/index.js';
import type {
  CategoryRepository,
  Clock,
  IdGenerator,
  ProductRepository,
  UnitOfMeasureRepository
} from '../ports/index.js';
import type { CreateProductInput, ProductDto } from './dtos.js';
import { toProductDto } from './mappers.js';

export class CreateProduct {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: ProductRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly unitRepository: UnitOfMeasureRepository,
    private readonly clock: Clock
  ) {}

  async execute(input: CreateProductInput): Promise<Result<ProductDto, AppError>> {
    try {
      const category = await this.categoryRepository.findById(input.categoryId);
      if (category === null) {
        return err(new ApplicationError('CATEGORY_NOT_FOUND', 'Category was not found.'));
      }
      if (!category.isActive) {
        return err(new ApplicationError('CATEGORY_INACTIVE', 'Category is inactive.'));
      }

      const unit = await this.unitRepository.findByCode(input.unitCode.trim().toUpperCase());
      if (unit === null) {
        return err(new ApplicationError('UNIT_OF_MEASURE_NOT_FOUND', 'Unit of measure was not found.'));
      }
      if (!unit.isActive) {
        return err(new ApplicationError('UNIT_OF_MEASURE_INACTIVE', 'Unit of measure is inactive.'));
      }

      const productId = this.idGenerator.generate();
      const barcodes = input.barcodes.map((value) =>
        Barcode.create({ id: this.idGenerator.generate(), value })
      );
      for (const barcode of barcodes) {
        const existing = await this.repository.findByActiveBarcode(barcode.value);
        if (existing !== null) {
          return err(new ApplicationError('BARCODE_CONFLICT', 'Barcode is already assigned to a product.'));
        }
      }

      const product = Product.create({
        id: productId,
        name: input.name,
        description: input.description,
        categoryId: category.id,
        unitOfMeasure: unit,
        barcodes,
        price: Money.fromMinorUnits(input.priceMinorUnits, input.currencyCode),
        taxRate: TaxRate.fromBasisPoints(input.taxRateBasisPoints),
        priceHistoryId: this.idGenerator.generate(),
        recordedBy: input.recordedBy,
        occurredAt: this.clock.now(),
        eventId: this.idGenerator.generate()
      });
      await this.repository.save(product);
      return ok(toProductDto(product));
    } catch (error) {
      if (error instanceof DomainError) return err(error);
      throw error;
    }
  }
}
