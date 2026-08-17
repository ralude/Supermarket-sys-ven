import { DomainError, Money } from '@supermarket/shared';
import type { ExchangeRate } from './exchange-rate.js';
import { CurrencyConverter } from './currency-converter.js';

/**
 * Calcula el total de pagos mixtos expresado en una moneda objetivo. Cada
 * conversión requiere una tasa vigente para el par. No usa floats.
 */
export function calculateMixedPaymentTotal(
  payments: Money[],
  targetCurrency: string,
  rates: ExchangeRate[],
  at: Date
): Money {
  const converter = new CurrencyConverter();

  const converted = payments.map((payment) => {
    if (payment.currency === targetCurrency) {
      return payment;
    }

    const rate = rates.find(
      (r) =>
        (r.baseCurrency === payment.currency &&
          r.quoteCurrency === targetCurrency) ||
        (r.baseCurrency === targetCurrency &&
          r.quoteCurrency === payment.currency)
    );

    if (!rate) {
      throw new DomainError(
        'CURRENCY_RATE_MISSING',
        `No exchange rate found for ${payment.currency} to ${targetCurrency}.`
      );
    }

    return converter.convert(payment, rate, at);
  });

  return converted.reduce(
    (sum, money) => sum.add(money),
    Money.zero(targetCurrency)
  );
}
