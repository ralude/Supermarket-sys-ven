import { ApplicationError, DomainError, err, ok, type AppError, type Result } from '@supermarket/shared';
import { createSaleRecipientSnapshot } from '../../domain/sales/index.js';
import type { ExecutionContext } from '../execution-context.js';
import { persistBusinessChange } from '../events/index.js';
import type { JsonValue } from '../events/index.js';
import { executeIdempotentCommand } from '../idempotency/index.js';
import type {
  BusinessEventStore, Clock, IdGenerator, IdempotencyStore, SaleRepository, UnitOfWork
} from '../ports/index.js';
import type { SaleDto, SetSaleRecipientInput } from './dtos.js';
import { toSaleDto } from './mappers.js';

/**
 * Adjunta, corrige o retira el receptor de una venta en borrador. No exige un
 * permiso propio: ADR-0018 no crea administración de clientes, así que el
 * comando comparte la frontera de sesión de la edición ordinaria de la venta.
 */
export class SetSaleRecipient {
  constructor(
    private readonly repository: SaleRepository,
    private readonly eventIdGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly unitOfWork?: UnitOfWork,
    private readonly eventStore?: BusinessEventStore,
    private readonly idempotencyStore?: IdempotencyStore
  ) {}

  async execute(
    input: SetSaleRecipientInput,
    context: ExecutionContext
  ): Promise<Result<SaleDto, AppError>> {
    try {
      return await executeIdempotentCommand({
        operation: 'SetSaleRecipient', input, context, now: this.clock.now(),
        ...(this.unitOfWork ? { unitOfWork: this.unitOfWork } : {}),
        ...(this.idempotencyStore ? { idempotencyStore: this.idempotencyStore } : {}),
        execute: async () => {
          const sale = await this.repository.findById(input.saleId);
          if (sale === null || sale.terminalId !== context.terminalId ||
            sale.originNodeId !== context.originNodeId) {
            return err(new ApplicationError('SALE_NOT_FOUND', 'Sale was not found.'));
          }
          sale.setRecipient({
            recipient: input.recipient === null
              ? null
              : createSaleRecipientSnapshot(input.recipient),
            occurredAt: this.clock.now(),
            eventId: this.eventIdGenerator.generate()
          });
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
