import type { AppError, Result } from '@supermarket/shared';
import type { ExchangeRateSuggestionDto } from '../currency/dtos.js';

export interface ExchangeRateProvider {
  getSuggestedRate(
    baseCurrency: string,
    quoteCurrency: string
  ): Promise<Result<ExchangeRateSuggestionDto, AppError>>;
}
