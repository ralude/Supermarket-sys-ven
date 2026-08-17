import { describe, expect, it } from 'vitest';
import { DomainError } from '@supermarket/shared';
import { UnitOfMeasure } from './unit-of-measure.js';

describe('UnitOfMeasure', () => {
  it('normalizes a configurable unit code', () => {
    const unit = UnitOfMeasure.create({
      id: 'unit-001',
      code: ' kg ',
      name: 'Kilogram',
      quantityScale: 3
    });

    expect(unit.code).toBe('KG');
    expect(unit.quantityScale).toBe(3);
    expect(unit.isActive).toBe(true);
  });

  it('rejects an invalid quantity scale', () => {
    expect(() =>
      UnitOfMeasure.create({
        id: 'unit-001',
        code: 'KG',
        name: 'Kilogram',
        quantityScale: 7
      })
    ).toThrowError(
      new DomainError(
        'UNIT_OF_MEASURE_INVALID_SCALE',
        'Unit quantity scale must be an integer between 0 and 6.'
      )
    );
  });
});
