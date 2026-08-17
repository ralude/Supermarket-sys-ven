import {
  ApplicationError,
  DomainError,
  err,
  ok,
  type AppError,
  type Result
} from '@supermarket/shared';
import {
  Barcode,
  type ProductDetailsChanges
} from '../../domain/catalog/index.js';
import type {
  CategoryRepository,
  IdGenerator,
  ProductRepository,
  UnitOfMeasureRepository
} from '../ports/index.js';
import type { ProductDto, UpdateProductInput } from './dtos.js';
import { toProductDto } from './mappers.js';

export class UpdateProduct {
  constructor(
    private readonly repository: ProductRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly unitRepository: UnitOfMeasureRepository,
    private readonly idGenerator: IdGenerator
  ) {}

  async execute(input: UpdateProductInput): Promise<Result<ProductDto, AppError>> {
    try {
      const product = await this.repository.findById(input.productId);
      if (product === null) {
        return err(new ApplicationError('PRODUCT_NOT_FOUND', 'Product was not found.'));
      }

      const categoryId = input.categoryId;
      if (categoryId !== undefined) {
        const category = await this.categoryRepository.findById(categoryId);
        if (category === null) {
          return err(new ApplicationError('CATEGORY_NOT_FOUND', 'Category was not found.'));
        }
        if (!category.isActive) {
          return err(new ApplicationError('CATEGORY_INACTIVE', 'Category is inactive.'));
        }
      }

      let unit = undefined;
      if (input.unitCode !== undefined) {
        unit = await this.unitRepository.findByCode(input.unitCode.trim().toUpperCase());
        if (unit === null) {
          return err(new ApplicationError('UNIT_OF_MEASURE_NOT_FOUND', 'Unit of measure was not found.'));
        }
        if (!unit.isActive) {
          return err(new ApplicationError('UNIT_OF_MEASURE_INACTIVE', 'Unit of measure is inactive.'));
        }
      }

      let barcodes: Barcode[] | undefined;
      if (input.barcodes !== undefined) {
        barcodes = input.barcodes.map((value) =>
          Barcode.create({ id: this.idGenerator.generate(), value })
        );
        for (const barcode of barcodes) {
          const existing = await this.repository.findByActiveBarcode(barcode.value);
          if (existing !== null && existing.id !== product.id) {
            return err(new ApplicationError('BARCODE_CONFLICT', 'Barcode is already assigned to a product.'));
          }
        }
      }

      const changes: ProductDetailsChanges = {};
      if (input.name !== undefined) changes.name = input.name;
      if (input.description !== undefined) changes.description = input.description;
      if (categoryId !== undefined) changes.categoryId = categoryId;
      if (unit !== undefined) changes.unitOfMeasure = unit;
      if (barcodes !== undefined) changes.barcodes = barcodes;
      if (input.isActive !== undefined) changes.isActive = input.isActive;
      product.updateDetails(changes);
      await this.repository.save(product);
      return ok(toProductDto(product));
    } catch (error) {
      if (error instanceof DomainError) return err(error);
      throw error;
    }
  }
}
