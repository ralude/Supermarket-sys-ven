import { ApplicationError, DomainError, err, ok, type AppError, type Result } from '@supermarket/shared';
import type { ExecutionContext } from '../execution-context.js';
import type { Clock, IdGenerator, SaleRepository } from '../ports/index.js';
import type { CompleteSaleInput, SaleDto } from './dtos.js';
import { toSaleDto } from './mappers.js';

export class CompleteSale {
  private readonly idempotentResults = new Map<string, Result<SaleDto, AppError>>();

  constructor(
    private readonly repository: SaleRepository,
    private readonly eventIdGenerator: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(input: CompleteSaleInput, context: ExecutionContext): Promise<Result<SaleDto, AppError>> {
    const key = context.idempotencyKey === undefined
      ? null
      : `${input.saleId}:${context.idempotencyKey}`;
    if (key !== null) {
      const previous = this.idempotentResults.get(key);
      if (previous !== undefined) return previous;
    }
    try {
      const sale = await this.repository.findById(input.saleId);
      if (sale === null) return err(new ApplicationError('SALE_NOT_FOUND', 'Sale was not found.'));
      sale.complete({ completedAt: this.clock.now(), eventId: this.eventIdGenerator.generate() });
      await this.repository.save(sale);
      const result = ok(toSaleDto(sale));
      if (key !== null) this.idempotentResults.set(key, result);
      return result;
    } catch (error) {
      if (error instanceof DomainError) return err(error);
      throw error;
    }
  }
}
