import { ApplicationError, err, ok, type AppError, type Result } from '@supermarket/shared';
import type { ExchangeRateHistoryRepository } from '../ports/index.js';
import type { ExchangeRateDto } from './dtos.js';

const toDto = (rate: import('../../domain/currency/index.js').ExchangeRate): ExchangeRateDto => ({
  id: rate.id,
  baseCurrency: rate.baseCurrency,
  quoteCurrency: rate.quoteCurrency,
  rateValue: rate.rateValue,
  rateScale: rate.rateScale,
  source: rate.source,
  validFrom: rate.validFrom,
  validUntil: rate.validUntil,
  registeredBy: rate.registeredBy
});

export class GetExchangeRateHistory {
  constructor(private readonly repository: ExchangeRateHistoryRepository) {}

  async execute(
    baseCurrency: string,
    quoteCurrency: string,
    limit = 100
  ): Promise<Result<readonly ExchangeRateDto[], AppError>> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
      return err(new ApplicationError('CURRENCY_HISTORY_LIMIT_INVALID', 'History limit is invalid.'));
    }
    const rates = await this.repository.findHistoryByPair(baseCurrency, quoteCurrency, limit);
    return ok(rates.map(toDto));
  }
}
