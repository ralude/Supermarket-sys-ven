import type { JsonValue } from '../events/index.js';
import type { ShiftDto } from './dtos.js';

export const serializeShiftDto = (value: ShiftDto): JsonValue =>
  JSON.parse(JSON.stringify(value)) as JsonValue;

export const restoreShiftDto = (value: JsonValue): ShiftDto => {
  const dto = value as unknown as Omit<ShiftDto, 'openedAt' | 'closedAt' | 'movements'> & {
    openedAt: string; closedAt: string | null;
    movements: Array<Omit<ShiftDto['movements'][number], 'registeredAt'> & { registeredAt: string }>;
  };
  return {
    ...dto,
    openedAt: new Date(dto.openedAt),
    closedAt: dto.closedAt === null ? null : new Date(dto.closedAt),
    movements: dto.movements.map((movement) => ({
      ...movement, registeredAt: new Date(movement.registeredAt)
    }))
  };
};
