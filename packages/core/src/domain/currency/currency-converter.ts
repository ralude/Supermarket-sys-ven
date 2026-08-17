import { DomainError, Money } from '@supermarket/shared';
import type { ExchangeRate } from './exchange-rate.js';

/**
 * Servicio de dominio que convierte montos entre monedas usando una tasa
 * explícita, su escala y su vigencia. No usa floats.
 */
export class CurrencyConverter {
  convert(money: Money, rate: ExchangeRate, at: Date): Money {
    if (!rate.isValidAt(at)) {
      throw new DomainError(
        'CURRENCY_RATE_EXPIRED',
        'Exchange rate is not valid at the requested time.'
      );
    }

    if (money.currency === rate.baseCurrency) {
      const converted = money.multiplyByQuantity(rate.toQuantity());
      return Money.fromMinorUnits(converted.minorUnits, rate.quoteCurrency);
    }

    if (money.currency === rate.quoteCurrency) {
      const converted = money.divideByQuantity(rate.toQuantity());
      return Money.fromMinorUnits(converted.minorUnits, rate.baseCurrency);
    }

    throw new DomainError(
      'CURRENCY_RATE_MISMATCH',
      'Exchange rate does not apply to the given currency.'
    );
  }
}
