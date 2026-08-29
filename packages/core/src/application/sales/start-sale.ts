import {
  DomainError,
  err,
  ok,
  type AppError,
  type Result
} from '@supermarket/shared';
import { Sale } from '../../domain/sales/index.js';
import type { ExecutionContext } from '../execution-context.js';
import type { BusinessEventStore, Clock, IdGenerator, SaleRepository, UnitOfWork } from '../ports/index.js';
import { persistBusinessChange } from '../events/index.js';
import type { SaleDto, StartSaleInput } from './dtos.js';
import { toSaleDto } from './mappers.js';

export class StartSale {
  constructor(
    private readonly saleIdGenerator: IdGenerator,
    private readonly eventIdGenerator: IdGenerator,
    private readonly repository: SaleRepository,
    private readonly clock: Clock,
    private readonly unitOfWork?: UnitOfWork,
    private readonly eventStore?: BusinessEventStore
  ) {}

  async execute(input: StartSaleInput, context: ExecutionContext): Promise<Result<SaleDto, AppError>> {
    try {
      const sale = Sale.start({
        id: this.saleIdGenerator.generate(),
        eventId: this.eventIdGenerator.generate(),
        currencyCode: input.currencyCode,
        terminalId: context.terminalId,
        originNodeId: context.originNodeId,
        startedBy: context.actorId,
        startedAt: this.clock.now()
      });
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
