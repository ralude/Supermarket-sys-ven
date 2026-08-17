import {
  ApplicationError,
  DomainError,
  err,
  Money,
  ok,
  type AppError,
  type Result
} from '@supermarket/shared';
import type { Clock, IdGenerator, ProductRepository } from '../ports/index.js';
import type { ProductDto, UpdatePriceInput } from './dtos.js';
import { toProductDto } from './mappers.js';

export class UpdatePrice {
  constructor(
    private readonly repository: ProductRepository,
    private readonly priceHistoryIdGenerator: IdGenerator,
    private readonly eventIdGenerator: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(input: UpdatePriceInput): Promise<Result<ProductDto, AppError>> {
    try {
      const product = await this.repository.findById(input.productId);
      if (product === null) {
        return err(new ApplicationError('PRODUCT_NOT_FOUND', 'Product was not found.'));
      }

      product.changePrice({
        price: Money.fromMinorUnits(input.priceMinorUnits, input.currencyCode),
        priceHistoryId: this.priceHistoryIdGenerator.generate(),
        changedBy: input.changedBy,
        reason: input.reason,
        occurredAt: this.clock.now(),
        eventId: this.eventIdGenerator.generate()
      });
      await this.repository.save(product);
      return ok(toProductDto(product));
    } catch (error) {
      if (error instanceof DomainError) return err(error);
      throw error;
    }
  }
}
