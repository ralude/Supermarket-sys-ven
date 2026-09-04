import {
  ApplicationError,
  DomainError,
  err,
  ok,
  Quantity,
  type AppError,
  type Result
} from '@supermarket/shared';
import type { ExecutionContext } from '../execution-context.js';
import { persistBusinessChange } from '../events/index.js';
import type {
  Clock,
  IdGenerator,
  ProductSnapshotProvider,
  SaleRepository,
  BusinessEventStore,
  UnitOfWork,
  IdempotencyStore
} from '../ports/index.js';
import type { JsonValue } from '../events/index.js';
import { executeIdempotentCommand } from '../idempotency/index.js';
import type { AddItemToSaleInput, SaleDto } from './dtos.js';
import { toSaleDto } from './mappers.js';

export class AddItemToSale {
  constructor(
    private readonly repository: SaleRepository,
    private readonly snapshotProvider: ProductSnapshotProvider,
    private readonly itemIdGenerator: IdGenerator,
    private readonly eventIdGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly unitOfWork?: UnitOfWork,
    private readonly eventStore?: BusinessEventStore,
    private readonly idempotencyStore?: IdempotencyStore
  ) {}

  async execute(input: AddItemToSaleInput, context: ExecutionContext): Promise<Result<SaleDto, AppError>> {
    try {
      return await executeIdempotentCommand({
        operation: 'AddItemToSale', input, context, now: this.clock.now(),
        ...(this.unitOfWork ? { unitOfWork: this.unitOfWork } : {}),
        ...(this.idempotencyStore ? { idempotencyStore: this.idempotencyStore } : {}),
        execute: async () => {
          const sale = await this.repository.findById(input.saleId);
          if (sale === null || sale.terminalId !== context.terminalId ||
            sale.originNodeId !== context.originNodeId) {
            return err(new ApplicationError('SALE_NOT_FOUND', 'Sale was not found.'));
          }
          const snapshot = await this.snapshotProvider.findSnapshotByBarcode(
            input.barcode.trim().toUpperCase()
          );
          if (snapshot === null) {
            return err(new ApplicationError('PRODUCT_NOT_FOUND', 'Product was not found.'));
          }
          sale.addItem({
            id: this.itemIdGenerator.generate(),
            eventId: this.eventIdGenerator.generate(),
            snapshot,
            quantity: Quantity.fromScaled(input.quantityScaled, input.quantityScale),
            occurredAt: this.clock.now()
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
  return {
    ...dto,
    completedAt: dto.completedAt === null ? null : new Date(dto.completedAt),
    voidedAt: dto.voidedAt === null ? null : new Date(dto.voidedAt)
  };
};
