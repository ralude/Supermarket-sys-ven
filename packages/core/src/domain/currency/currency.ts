import { DomainError } from '@supermarket/shared';

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;
const MAX_MINOR_UNIT_EXPONENT = 6;

export type CurrencyProps = {
  code: string;
  name: string;
  minorUnitExponent: number;
  isActive?: boolean;
};

/**
 * Moneda configurable del sistema (VES, USD, etc.). Su código actúa como
 * identidad; no es un agregado transaccional, pero su vigencia es atributo
 * de negocio.
 */
export class Currency {
  private constructor(
    readonly code: string,
    readonly name: string,
    readonly minorUnitExponent: number,
    readonly isActive: boolean
  ) {}

  static create(props: CurrencyProps): Currency {
    if (!CURRENCY_CODE_PATTERN.test(props.code)) {
      throw new DomainError(
        'CURRENCY_INVALID_CODE',
        'Currency code must be an uppercase three-letter code.'
      );
    }

    const trimmedName = props.name.trim();
    if (trimmedName.length === 0) {
      throw new DomainError(
        'CURRENCY_NAME_REQUIRED',
        'Currency name is required.'
      );
    }

    if (
      !Number.isInteger(props.minorUnitExponent) ||
      props.minorUnitExponent < 0 ||
      props.minorUnitExponent > MAX_MINOR_UNIT_EXPONENT
    ) {
      throw new DomainError(
        'CURRENCY_INVALID_EXPONENT',
        'Currency minor unit exponent must be an integer between 0 and 6.'
      );
    }

    return new Currency(
      props.code,
      trimmedName,
      props.minorUnitExponent,
      props.isActive ?? true
    );
  }
}
