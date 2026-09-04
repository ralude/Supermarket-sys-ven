import { ok, type Result, type AppError } from '@supermarket/shared';
import type { CashRegisterRepository } from '../ports/index.js';
import type { CashRegisterDto } from './dtos.js';

/** Lista las cajas activas para que la interfaz las ofrezca como selector. */
export class ListCashRegisters {
  constructor(private readonly repository: CashRegisterRepository) {}

  async execute(): Promise<Result<readonly CashRegisterDto[], AppError>> {
    const registers = await this.repository.findAll();
    return ok(registers
      .filter((register) => register.isActive)
      .map((register) => ({ id: register.id, name: register.name })));
  }
}
