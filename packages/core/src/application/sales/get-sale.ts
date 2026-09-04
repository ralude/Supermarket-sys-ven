import { ApplicationError, err, ok, type AppError, type Result } from '@supermarket/shared';
import type { ExecutionContext } from '../execution-context.js';
import type { SaleRepository } from '../ports/index.js';
import type { SaleDto } from './dtos.js';
import { toSaleDto } from './mappers.js';

export class GetSale {
  constructor(private readonly repository: SaleRepository) {}

  async execute(saleId: string, context: ExecutionContext): Promise<Result<SaleDto, AppError>> {
    const sale = await this.repository.findById(saleId);
    if (sale === null || sale.terminalId !== context.terminalId ||
      sale.originNodeId !== context.originNodeId) {
      return err(new ApplicationError('SALE_NOT_FOUND', 'Sale was not found.'));
    }
    return ok(toSaleDto(sale));
  }
}
