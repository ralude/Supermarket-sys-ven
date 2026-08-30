import type { StockItem } from '../../domain/inventory/index.js';

export interface StockItemRepository {
  save(item: StockItem): Promise<void>;
  findById(id: string): Promise<StockItem | null>;
  findByProductId(productId: string): Promise<StockItem | null>;
}
