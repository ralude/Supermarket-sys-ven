import { ok, type Result, type AppError } from '@supermarket/shared';
import type { UnitOfMeasureRepository } from '../ports/index.js';
import type { UnitOfMeasureDto } from './dtos.js';

/**
 * Lista las unidades activas para que la interfaz las ofrezca como selector.
 * La escala de cantidad que declara cada unidad es la única que el dominio
 * acepta para un producto que la use.
 */
export class ListUnitsOfMeasure {
  constructor(private readonly repository: UnitOfMeasureRepository) {}

  async execute(): Promise<Result<readonly UnitOfMeasureDto[], AppError>> {
    const units = await this.repository.findAll();
    return ok(units
      .filter((unit) => unit.isActive)
      .map((unit) => ({ code: unit.code, name: unit.name, quantityScale: unit.quantityScale })));
  }
}
