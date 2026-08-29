import { ApplicationError, DomainError, err, ok, type AppError, type Result } from '@supermarket/shared';
import type { ExecutionContext } from '../execution-context.js';
import { toBusinessEvents, type JsonValue } from '../events/index.js';
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
    const key = context.idempotencyKey ?? null;
    const scope = `${context.originNodeId}:CompleteSale`;
    const fingerprint = JSON.stringify(input);
    try {
      const execute = async (): Promise<Result<SaleDto, AppError>> => {
        const now = this.clock.now();
        if (key !== null && this.idempotencyStore) {
          const previous = await this.idempotencyStore.find(scope, key, now);
          if (previous) {
            if (previous.requestFingerprint !== fingerprint) {
              return err(new ApplicationError(
                'IDEMPOTENCY_KEY_CONFLICT',
                'Idempotency key was already used with another request.'
              ));
            }
            return ok(this.restoreResult(previous.result));
          }
        }

        const sale = await this.repository.findById(input.saleId);
        if (sale === null) return err(new ApplicationError('SALE_NOT_FOUND', 'Sale was not found.'));
        sale.complete({ completedAt: now, eventId: this.eventIdGenerator.generate() });
        await this.repository.save(sale);
        const events = toBusinessEvents(sale.domainEvents, context);
        if (this.eventStore) await this.eventStore.append(events);
        if (this.outboxStore) {
          await this.outboxStore.enqueue(events.filter((event) => event.eventType === 'SaleCompleted'));
        }
        const dto = toSaleDto(sale);
        if (key !== null && this.idempotencyStore) {
          await this.idempotencyStore.save({
            scope,
            key,
            requestFingerprint: fingerprint,
            status: 'COMPLETED',
            result: JSON.parse(JSON.stringify(dto)) as JsonValue,
            createdAt: now,
            expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
          });
        }
        return ok(dto);
      };
      return this.unitOfWork ? await this.unitOfWork.execute(execute) : await execute();
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
