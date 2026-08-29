import { ApplicationError, DomainError, err, ok, type AppError, type Result } from '@supermarket/shared';
import type { ExecutionContext } from '../execution-context.js';
import { persistBusinessChange } from '../events/index.js';
import type { BusinessEventStore, Clock, IdGenerator, SaleRepository, UnitOfWork } from '../ports/index.js';
import type { RemoveItemFromSaleInput, SaleDto } from './dtos.js';
import { toSaleDto } from './mappers.js';

export class RemoveItemFromSale {
  constructor(
    private readonly repository: SaleRepository,
    private readonly eventIdGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly unitOfWork?: UnitOfWork,
    private readonly eventStore?: BusinessEventStore
  ) {}

  async execute(input: RemoveItemFromSaleInput, context: ExecutionContext): Promise<Result<SaleDto, AppError>> {
    void context;
    try {
      const sale = await this.repository.findById(input.saleId);
      if (sale === null) return err(new ApplicationError('SALE_NOT_FOUND', 'Sale was not found.'));
      sale.removeItem(input.itemId, this.clock.now(), this.eventIdGenerator.generate());
      await persistBusinessChange(
        () => this.repository.save(sale), sale.domainEvents, context,
        this.unitOfWork, this.eventStore
      );
      return ok(toSaleDto(sale));
    } catch (error) {
      if (error instanceof DomainError) return err(error);
      throw error;
    }
  }
}
