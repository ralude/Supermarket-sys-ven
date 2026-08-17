import type { Shift } from '../../domain/cash/index.js';

/** Persistencia real de turnos y unicidad transaccional en Fases 3 y 5. */
export interface ShiftRepository {
  save(shift: Shift): Promise<void>;
  findById(shiftId: string): Promise<Shift | null>;
  findOpenByCashRegisterId(cashRegisterId: string): Promise<Shift | null>;
}
