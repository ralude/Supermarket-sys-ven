import { DomainError, Quantity } from '@supermarket/shared';

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;
const MAX_RATE_SCALE = 8;

export type ExchangeRateProps = {
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  rateValue: number;
  rateScale: number;
  source: string;
  validFrom: Date;
  validUntil?: Date | null;
  registeredBy: string;
};

/**
 * Tasa de cambio histórica, inmutable una vez registrada. La vigencia debe ser
 * explícita: cada conversión debe conocer fuente, escala y ventana de validez.
 */
export class ExchangeRate {
  private constructor(
    readonly id: string,
    readonly baseCurrency: string,
    readonly quoteCurrency: string,
    readonly rateValue: number,
    readonly rateScale: number,
    readonly source: string,
    readonly validFrom: Date,
    readonly validUntil: Date | null,
    readonly registeredBy: string
  ) {}

  static create(props: ExchangeRateProps): ExchangeRate {
    if (
      !CURRENCY_CODE_PATTERN.test(props.baseCurrency) ||
      !CURRENCY_CODE_PATTERN.test(props.quoteCurrency)
    ) {
      throw new DomainError(
        'EXCHANGE_RATE_INVALID_CURRENCY',
        'Currency code must be an uppercase three-letter code.'
      );
    }

    if (props.baseCurrency === props.quoteCurrency) {
      throw new DomainError(
        'EXCHANGE_RATE_INVALID_PAIR',
        'Base and quote currencies must be different.'
      );
    }

    if (!Number.isSafeInteger(props.rateValue) || props.rateValue <= 0) {
      throw new DomainError(
        'EXCHANGE_RATE_INVALID_VALUE',
        'Exchange rate value must be a positive safe integer.'
      );
    }

    if (
      !Number.isInteger(props.rateScale) ||
      props.rateScale < 0 ||
      props.rateScale > MAX_RATE_SCALE
    ) {
      throw new DomainError(
        'EXCHANGE_RATE_INVALID_SCALE',
        'Exchange rate scale must be an integer between 0 and 8.'
      );
    }

    const trimmedSource = props.source.trim();
    if (trimmedSource.length === 0) {
      throw new DomainError(
        'EXCHANGE_RATE_SOURCE_REQUIRED',
        'Exchange rate source is required.'
      );
    }

    const validUntil = props.validUntil ?? null;
    if (validUntil !== null && validUntil <= props.validFrom) {
      throw new DomainError(
        'EXCHANGE_RATE_INVALID_VALIDITY',
        'Exchange rate validUntil must be after validFrom.'
      );
    }

    return new ExchangeRate(
      props.id,
      props.baseCurrency,
      props.quoteCurrency,
      props.rateValue,
      props.rateScale,
      trimmedSource,
      props.validFrom,
      validUntil,
      props.registeredBy
    );
  }

  isValidAt(instant: Date): boolean {
    return (
      instant >= this.validFrom &&
      (this.validUntil === null || instant < this.validUntil)
    );
  }

  toQuantity(): Quantity {
    return Quantity.fromScaled(this.rateValue, this.rateScale);
  }
}
