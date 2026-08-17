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
import type {
  Clock,
  IdGenerator,
  ProductSnapshotProvider,
  SaleRepository
} from '../ports/index.js';
import type { AddItemToSaleInput, SaleDto } from './dtos.js';
import { toSaleDto } from './mappers.js';

export class AddItemToSale {
  constructor(
    private readonly repository: SaleRepository,
    private readonly snapshotProvider: ProductSnapshotProvider,
    private readonly itemIdGenerator: IdGenerator,
    private readonly eventIdGenerator: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(input: AddItemToSaleInput, context: ExecutionContext): Promise<Result<SaleDto, AppError>> {
    void context;
    try {
      const sale = await this.repository.findById(input.saleId);
      if (sale === null) return err(new ApplicationError('SALE_NOT_FOUND', 'Sale was not found.'));
      const snapshot = await this.snapshotProvider.findSnapshotByBarcode(input.barcode.trim().toUpperCase());
      if (snapshot === null) return err(new ApplicationError('PRODUCT_NOT_FOUND', 'Product was not found.'));
      sale.addItem({
        id: this.itemIdGenerator.generate(),
        eventId: this.eventIdGenerator.generate(),
        snapshot,
        quantity: Quantity.fromScaled(input.quantityScaled, input.quantityScale),
        occurredAt: this.clock.now()
      });
      await this.repository.save(sale);
      return ok(toSaleDto(sale));
    } catch (error) {
      if (error instanceof DomainError) return err(error);
      throw error;
    }
  }
}
