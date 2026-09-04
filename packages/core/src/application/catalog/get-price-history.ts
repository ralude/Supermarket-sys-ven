import { ApplicationError, err, ok, type AppError, type Result } from '@supermarket/shared';
import type { CatalogReadRepository } from '../ports/index.js';

export type PriceHistoryDto = {
  readonly id: string; readonly priceMinorUnits: number; readonly currencyCode: string;
  readonly recordedAt: Date; readonly recordedBy: string; readonly reason: string;
};

export class GetPriceHistory {
  constructor(private readonly repository: CatalogReadRepository) {}

  async execute(productId: string): Promise<Result<readonly PriceHistoryDto[], AppError>> {
    const product = await this.repository.findById(productId);
    if (!product) return err(new ApplicationError('PRODUCT_NOT_FOUND', 'Product was not found.'));
    return ok(product.priceHistory.map((entry) => ({
      id: entry.id, priceMinorUnits: entry.price.minorUnits, currencyCode: entry.price.currency,
      recordedAt: entry.recordedAt, recordedBy: entry.recordedBy, reason: entry.reason ?? ''
    })));
  }
}
