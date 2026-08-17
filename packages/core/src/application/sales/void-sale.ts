import { ApplicationError, DomainError, err, ok, type AppError, type Result } from '@supermarket/shared';
import type { ExecutionContext } from '../execution-context.js';
import type { AuthorizationService, Clock, IdGenerator, SaleRepository } from '../ports/index.js';
import type { SaleDto, VoidSaleInput } from './dtos.js';
import { toSaleDto } from './mappers.js';
import { SALE_PERMISSIONS } from './permissions.js';

export class VoidSale {
  constructor(
    private readonly repository: SaleRepository,
    private readonly authorization: AuthorizationService,
    private readonly eventIdGenerator: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(input: VoidSaleInput, context: ExecutionContext): Promise<Result<SaleDto, AppError>> {
    if (!(await this.authorization.authorize(context, SALE_PERMISSIONS.VOID))) {
      return err(new ApplicationError('FORBIDDEN', 'Actor is not authorized to void sales.'));
    }
    try {
      const sale = await this.repository.findById(input.saleId);
      if (sale === null) return err(new ApplicationError('SALE_NOT_FOUND', 'Sale was not found.'));
      sale.void({
        reason: input.reason,
        voidedBy: context.actorId,
        voidedAt: this.clock.now(),
        eventId: this.eventIdGenerator.generate()
      });
      await this.repository.save(sale);
      return ok(toSaleDto(sale));
    } catch (error) {
      if (error instanceof DomainError) return err(error);
      throw error;
    }
  }
}
