import { ok, err, type Result, type AppError, ApplicationError } from '@supermarket/shared';
import type { Clock } from '../ports/clock.js';
import type { ExchangeRateRepository } from '../ports/exchange-rate-repository.js';
import type { ExchangeRateDto } from './dtos.js';

function toDto(rate: import('../../domain/currency/index.js').ExchangeRate): ExchangeRateDto {
  return {
    id: rate.id,
    baseCurrency: rate.baseCurrency,
    quoteCurrency: rate.quoteCurrency,
    rateValue: rate.rateValue,
    rateScale: rate.rateScale,
    source: rate.source,
    validFrom: rate.validFrom,
    validUntil: rate.validUntil
  };
}

/**
 * Caso de uso para consultar la tasa de cambio vigente entre dos monedas.
 * Si no existe o está vencida, devuelve un error de aplicación controlado.
 */
export class GetCurrentExchangeRate {
  constructor(
    private readonly clock: Clock,
    private readonly repository: ExchangeRateRepository
  ) {}

  async execute(
    baseCurrency: string,
    quoteCurrency: string
  ): Promise<Result<ExchangeRateDto, AppError>> {
    const rate = await this.repository.findCurrentByPair(
      baseCurrency,
      quoteCurrency,
      this.clock.now()
    );

    if (!rate) {
      return err(
        new ApplicationError(
          'CURRENCY_RATE_MISSING',
          `No current exchange rate found for ${baseCurrency} to ${quoteCurrency}.`
        )
      );
    }

    return ok(toDto(rate));
  }
}
