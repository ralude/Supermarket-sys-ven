import type { JsonValue } from '../events/index.js';
import type { StockCountDto } from './dtos.js';

type SerializedStockCountDto = Omit<StockCountDto, 'openedAt' | 'closedAt' | 'approvedAt' | 'rejectedAt'> & {
  openedAt: string;
  closedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
};

export const serializeStockCountDto = (value: StockCountDto): JsonValue =>
  JSON.parse(JSON.stringify(value)) as JsonValue;

export const restoreStockCountDto = (value: JsonValue): StockCountDto => {
  const dto = value as unknown as SerializedStockCountDto;
  return {
    ...dto,
    openedAt: new Date(dto.openedAt),
    closedAt: dto.closedAt === null ? null : new Date(dto.closedAt),
    approvedAt: dto.approvedAt === null ? null : new Date(dto.approvedAt),
    rejectedAt: dto.rejectedAt === null ? null : new Date(dto.rejectedAt)
  };
};
