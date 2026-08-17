import { ApplicationError, DomainError, err, ok, type AppError, type Result } from '@supermarket/shared';
import type { ExecutionContext } from '../execution-context.js';
import type { Clock, IdGenerator, SaleRepository } from '../ports/index.js';
import type { RemoveItemFromSaleInput, SaleDto } from './dtos.js';
import { toSaleDto } from './mappers.js';

export class RemoveItemFromSale {
  constructor(
    private readonly repository: SaleRepository,
    private readonly eventIdGenerator: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(input: RemoveItemFromSaleInput, context: ExecutionContext): Promise<Result<SaleDto, AppError>> {
    void context;
    try {
      const sale = await this.repository.findById(input.saleId);
      if (sale === null) return err(new ApplicationError('SALE_NOT_FOUND', 'Sale was not found.'));
      sale.removeItem(input.itemId, this.clock.now(), this.eventIdGenerator.generate());
      await this.repository.save(sale);
      return ok(toSaleDto(sale));
    } catch (error) {
      if (error instanceof DomainError) return err(error);
      throw error;
    }
  }
}
