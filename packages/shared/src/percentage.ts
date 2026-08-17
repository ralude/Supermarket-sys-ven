import { DomainError } from './errors/app-error.js';

/**
 * Porcentaje expresado en puntos base enteros (1600 equivale a 16.00%).
 * Nunca se representa con floats.
 */
export class Percentage {
  private constructor(readonly basisPoints: number) {}

  static fromBasisPoints(basisPoints: number): Percentage {
    if (!Number.isSafeInteger(basisPoints) || basisPoints < 0) {
      throw new DomainError(
        'PERCENTAGE_INVALID_BASIS_POINTS',
        'Percentage must be a non-negative safe integer in basis points.'
      );
    }

    return new Percentage(basisPoints);
  }
}
