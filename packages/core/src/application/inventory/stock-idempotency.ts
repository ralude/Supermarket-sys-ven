import type { JsonValue } from '../events/index.js';
import type { StockItemDto } from './dtos.js';

export const serializeStockItemDto = (value: StockItemDto): JsonValue =>
  JSON.parse(JSON.stringify(value)) as JsonValue;

export const restoreStockItemDto = (value: JsonValue): StockItemDto => {
  const dto = value as unknown as Omit<StockItemDto, 'movements'> & {
    movements: Array<Omit<StockItemDto['movements'][number], 'occurredAt'> & { occurredAt: string }>;
  };
  return {
    ...dto,
    movements: dto.movements.map((movement) => ({
      ...movement, occurredAt: new Date(movement.occurredAt)
    }))
  };
};
