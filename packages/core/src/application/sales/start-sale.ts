import {
  DomainError,
  err,
  ok,
  type AppError,
  type Result
} from '@supermarket/shared';
import { Sale } from '../../domain/sales/index.js';
import type { ExecutionContext } from '../execution-context.js';
import type { Clock, IdGenerator, SaleRepository } from '../ports/index.js';
import type { SaleDto, StartSaleInput } from './dtos.js';
import { toSaleDto } from './mappers.js';

export class StartSale {
  constructor(
    private readonly saleIdGenerator: IdGenerator,
    private readonly eventIdGenerator: IdGenerator,
    private readonly repository: SaleRepository,
    private readonly clock: Clock
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
      await this.repository.save(sale);
      return ok(toSaleDto(sale));
    } catch (error) {
      if (error instanceof DomainError) return err(error);
      throw error;
    }
  }
}
