import { ApplicationError, DomainError, err, ok, type AppError, type Result } from '@supermarket/shared';
import type { ExecutionContext } from '../execution-context.js';
import { persistBusinessChange } from '../events/index.js';
import type { JsonValue } from '../events/index.js';
import { executeIdempotentCommand } from '../idempotency/index.js';
import type {
  BusinessEventStore, Clock, IdGenerator, IdempotencyStore, SaleRepository, UnitOfWork
} from '../ports/index.js';
import type { RemoveItemFromSaleInput, SaleDto } from './dtos.js';
import { toSaleDto } from './mappers.js';

export class RemoveItemFromSale {
  constructor(
    private readonly repository: SaleRepository,
    private readonly eventIdGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly unitOfWork?: UnitOfWork,
    private readonly eventStore?: BusinessEventStore,
    private readonly idempotencyStore?: IdempotencyStore
  ) {}

  async execute(input: RemoveItemFromSaleInput, context: ExecutionContext): Promise<Result<SaleDto, AppError>> {
    try {
      return await executeIdempotentCommand({
        operation: 'RemoveItemFromSale', input, context, now: this.clock.now(),
        ...(this.unitOfWork ? { unitOfWork: this.unitOfWork } : {}),
        ...(this.idempotencyStore ? { idempotencyStore: this.idempotencyStore } : {}),
        execute: async () => {
          const sale = await this.repository.findById(input.saleId);
          if (sale === null || sale.terminalId !== context.terminalId ||
            sale.originNodeId !== context.originNodeId) {
            return err(new ApplicationError('SALE_NOT_FOUND', 'Sale was not found.'));
          }
          sale.removeItem(input.itemId, this.clock.now(), this.eventIdGenerator.generate());
          await persistBusinessChange(
            () => this.repository.save(sale), sale.domainEvents, context,
            undefined, this.eventStore
          );
          return ok(toSaleDto(sale));
        },
        serialize: (output) => JSON.parse(JSON.stringify(output)) as JsonValue,
        restore: restoreSaleDto
      });
    } catch (error) {
      if (error instanceof DomainError) return err(error);
      throw error;
    }
  }
}

const restoreSaleDto = (value: JsonValue): SaleDto => {
  const dto = value as unknown as SaleDto & { completedAt: string | null; voidedAt: string | null };
  return { ...dto, completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
    voidedAt: dto.voidedAt ? new Date(dto.voidedAt) : null };
};
