import type { Sale } from '../../domain/sales/index.js';

/** Persistencia real de ventas en Fase 3. */
export interface SaleRepository {
  save(sale: Sale): Promise<void>;
  findById(saleId: string): Promise<Sale | null>;
}
