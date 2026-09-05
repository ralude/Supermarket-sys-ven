import type { SaleReturn } from '../../domain/sales/index.js';

export interface SaleReturnRepository {
  save(saleReturn: SaleReturn): Promise<void>;
  findById(id: string): Promise<SaleReturn | null>;
  findBySaleId(saleId: string): Promise<SaleReturn | null>;
}
