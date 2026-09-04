import { ApplicationError, DomainError, err, ok, type AppError, type Result } from '@supermarket/shared';
import type { ExecutionContext } from '../execution-context.js';
import { persistBusinessChange, type JsonValue } from '../events/index.js';
import { executeIdempotentCommand } from '../idempotency/index.js';
import type {
  BusinessEventStore,
  Clock,
  IdGenerator,
  IdempotencyStore,
  OutboxStore,
  SaleRepository,
  UnitOfWork
} from '../ports/index.js';
import type { CompleteSaleInput, SaleDto } from './dtos.js';
import { toSaleDto } from './mappers.js';

export class CompleteSale {
  constructor(
    private readonly repository: SaleRepository,
    private readonly eventIdGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly unitOfWork?: UnitOfWork,
    private readonly eventStore?: BusinessEventStore,
    private readonly outboxStore?: OutboxStore,
    private readonly idempotencyStore?: IdempotencyStore
  ) {}

  async execute(input: CompleteSaleInput, context: ExecutionContext): Promise<Result<SaleDto, AppError>> {
    try {
      return await executeIdempotentCommand({
        operation: 'CompleteSale', input, context, now: this.clock.now(),
        ...(this.unitOfWork ? { unitOfWork: this.unitOfWork } : {}),
        ...(this.idempotencyStore ? { idempotencyStore: this.idempotencyStore } : {}),
        execute: async () => {
          const sale = await this.repository.findById(input.saleId);
          if (sale === null || sale.terminalId !== context.terminalId ||
            sale.originNodeId !== context.originNodeId) {
            return err(new ApplicationError('SALE_NOT_FOUND', 'Sale was not found.'));
          }
          sale.complete({
            completedAt: this.clock.now(), eventId: this.eventIdGenerator.generate()
          });
          await persistBusinessChange(
            () => this.repository.save(sale), sale.domainEvents, context,
            undefined, this.eventStore, this.outboxStore, ['SaleCompleted']
          );
          return ok(toSaleDto(sale));
        },
        serialize: (output) => JSON.parse(JSON.stringify(output)) as JsonValue,
        restore: (value) => this.restoreResult(value)
      });
    } catch (error) {
      if (error instanceof DomainError) return err(error);
      throw error;
    }
  }

  private restoreResult(value: JsonValue): SaleDto {
    const dto = value as unknown as SaleDto & { completedAt: string | null; voidedAt: string | null };
    return {
      ...dto,
      completedAt: dto.completedAt === null ? null : new Date(dto.completedAt),
      voidedAt: dto.voidedAt === null ? null : new Date(dto.voidedAt)
    };
  }
}
