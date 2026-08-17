import { ok, err, type Result, type AppError, ApplicationError, Money } from '@supermarket/shared';
import { calculateMixedPaymentTotal } from '../../domain/currency/index.js';
import type { ExchangeRate } from '../../domain/currency/index.js';
import type { Clock } from '../ports/clock.js';
import type { ExchangeRateRepository } from '../ports/exchange-rate-repository.js';
import type { MixedPaymentInput, MixedPaymentOutput } from './dtos.js';

/**
 * Caso de uso para calcular el total de pagos mixtos en una moneda objetivo.
 * Cada conversión requiere una tasa vigente explícita; de lo contrario falla.
 */
export class CalculateMixedPaymentTotals {
  constructor(
    private readonly clock: Clock,
    private readonly repository: ExchangeRateRepository
  ) {}

  async execute(
    input: MixedPaymentInput
  ): Promise<Result<MixedPaymentOutput, AppError>> {
    const at = this.clock.now();
    const payments = input.payments.map((payment) =>
      Money.fromMinorUnits(payment.amountMinorUnits, payment.currencyCode)
    );

    const neededCurrencies = new Set(
      payments
        .map((payment) => payment.currency)
        .filter((currency) => currency !== input.targetCurrency)
    );

    const rates: ExchangeRate[] = [];
    for (const currency of neededCurrencies) {
      const rate =
        (await this.repository.findCurrentByPair(
          currency,
          input.targetCurrency,
          at
        )) ??
        (await this.repository.findCurrentByPair(
          input.targetCurrency,
          currency,
          at
        ));

      if (!rate) {
        return err(
          new ApplicationError(
            'CURRENCY_RATE_MISSING',
            `No current exchange rate found for ${currency} to ${input.targetCurrency}.`
          )
        );
      }

      rates.push(rate);
    }

    const total = calculateMixedPaymentTotal(
      payments,
      input.targetCurrency,
      rates,
      at
    );

    return ok({
      totalMinorUnits: total.minorUnits,
      totalCurrency: total.currency
    });
  }
}
