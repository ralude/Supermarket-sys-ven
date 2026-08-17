import {
  ApplicationError,
  DomainError,
  err,
  ok,
  type AppError,
  type Result
} from '@supermarket/shared';
import { Barcode } from '../../domain/catalog/index.js';
import type { ProductRepository } from '../ports/index.js';
import type {
  FindProductByBarcodeInput,
  ProductLookupOutput
} from './dtos.js';
import { toProductDto, toSnapshotDto } from './mappers.js';

export class FindProductByBarcode {
  constructor(private readonly repository: ProductRepository) {}

  async execute(
    input: FindProductByBarcodeInput
  ): Promise<Result<ProductLookupOutput, AppError>> {
    try {
      const barcode = Barcode.create({ id: 'lookup', value: input.barcode });
      const product = await this.repository.findByActiveBarcode(barcode.value);
      if (product === null) {
        return err(new ApplicationError('PRODUCT_NOT_FOUND', 'Product was not found.'));
      }

      const snapshot = product.createSnapshot();
      return ok({
        product: toProductDto(product),
        snapshot: toSnapshotDto(snapshot)
      });
    } catch (error) {
      if (error instanceof DomainError) return err(error);
      throw error;
    }
  }
}
