import type { CashRegister } from '../../domain/cash/index.js';

/** Persistencia real de cajas en Fase 3. */
export interface CashRegisterRepository {
  findById(cashRegisterId: string): Promise<CashRegister | null>;
  findAll(): Promise<readonly CashRegister[]>;
}
