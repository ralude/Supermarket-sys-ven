import type { AppError, Result } from '@supermarket/shared';
import type { ExchangeRateProvider } from '../ports/index.js';
import type { ExchangeRateSuggestionDto } from './dtos.js';

export class GetSuggestedExchangeRate {
  constructor(private readonly provider: ExchangeRateProvider) {}

  execute(
    baseCurrency: string,
    quoteCurrency: string
  ): Promise<Result<ExchangeRateSuggestionDto, AppError>> {
    return this.provider.getSuggestedRate(baseCurrency, quoteCurrency);
  }
}
