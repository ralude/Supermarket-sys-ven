import { DomainError } from './errors/app-error.js';

const MAX_QUANTITY_SCALE = 6;

/**
 * Cantidad entera o fraccionaria representada como entero escalado:
 * scaledValue / 10^scale. La unidad de medida define la escala. Nunca se
 * representa con floats.
 */
export class Quantity {
  private constructor(
    readonly scaledValue: number,
    readonly scale: number
  ) {}

  static fromScaled(scaledValue: number, scale: number): Quantity {
    if (!Number.isSafeInteger(scaledValue)) {
      throw new DomainError(
        'QUANTITY_INVALID_VALUE',
        'Quantity value must be a safe integer in scaled units.'
      );
    }

    if (
      !Number.isInteger(scale) ||
      scale < 0 ||
      scale > MAX_QUANTITY_SCALE
    ) {
      throw new DomainError(
        'QUANTITY_INVALID_SCALE',
        'Quantity scale must be an integer between 0 and 6.'
      );
    }

    return new Quantity(scaledValue, scale);
  }

  /**
   * Convierte el texto decimal que escribe el operador a un entero escalado
   * usando la escala que define la unidad de medida. No pasa por `float`: los
   * dígitos se concatenan y la fracción se completa hasta la escala.
   */
  static fromDecimal(text: string, scale: number): Quantity {
    const normalized = text.trim().replace(',', '.');
    const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized);
    if (!match) {
      throw new DomainError(
        'QUANTITY_INVALID_TEXT',
        'Quantity must be written as a positive decimal number.'
      );
    }

    const fraction = match[2] ?? '';
    if (fraction.length > scale) {
      throw new DomainError(
        'QUANTITY_SCALE_EXCEEDED',
        'Quantity has more decimals than the unit of measure allows.'
      );
    }

    return Quantity.fromScaled(Number(`${match[1]}${fraction.padEnd(scale, '0')}`), scale);
  }

  static zero(scale: number): Quantity {
    return Quantity.fromScaled(0, scale);
  }

  add(other: Quantity): Quantity {
    this.assertSameScale(other);
    return Quantity.fromScaled(this.scaledValue + other.scaledValue, this.scale);
  }

  subtract(other: Quantity): Quantity {
    this.assertSameScale(other);
    return Quantity.fromScaled(this.scaledValue - other.scaledValue, this.scale);
  }

  isZero(): boolean {
    return this.scaledValue === 0;
  }

  private assertSameScale(other: Quantity): void {
    if (this.scale !== other.scale) {
      throw new DomainError(
        'QUANTITY_SCALE_MISMATCH',
        'Quantity values must use the same scale for arithmetic.'
      );
    }
  }
}
