import { describe, expect, it } from 'vitest';
import { UnitOfMeasure } from '../../domain/catalog/index.js';
import type { UnitOfMeasureRepository } from '../ports/index.js';
import { ListUnitsOfMeasure } from './list-units-of-measure.js';

class FakeUnitOfMeasureRepository implements UnitOfMeasureRepository {
  constructor(private readonly units: readonly UnitOfMeasure[]) {}

  async findByCode(code: string): Promise<UnitOfMeasure | null> {
    return this.units.find((unit) => unit.code === code) ?? null;
  }

  async findAll(): Promise<readonly UnitOfMeasure[]> {
    return this.units;
  }
}

describe('ListUnitsOfMeasure', () => {
  it('lists only active units with their quantity scale', async () => {
    const unit = UnitOfMeasure.create({ id: 'unit-001', code: 'UNIT', name: 'Unidad', quantityScale: 0 });
    const kg = UnitOfMeasure.create({ id: 'unit-002', code: 'KG', name: 'Kilogramo', quantityScale: 3 });
    const retired = UnitOfMeasure.create({
      id: 'unit-003', code: 'OLD', name: 'Retirada', quantityScale: 0, isActive: false
    });
    const useCase = new ListUnitsOfMeasure(new FakeUnitOfMeasureRepository([unit, kg, retired]));

    const result = await useCase.execute();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([
      { code: 'UNIT', name: 'Unidad', quantityScale: 0 },
      { code: 'KG', name: 'Kilogramo', quantityScale: 3 }
    ]);
  });
});
