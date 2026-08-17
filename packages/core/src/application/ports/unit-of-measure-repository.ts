import type { UnitOfMeasure } from '../../domain/catalog/index.js';

/** Las unidades se administran como configuración del catálogo. */
export interface UnitOfMeasureRepository {
  findByCode(code: string): Promise<UnitOfMeasure | null>;
}
