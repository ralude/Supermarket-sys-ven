import type { ExchangeRate } from '../../domain/currency/index.js';

export interface ExchangeRateHistoryRepository {
  findHistoryByPair(
    baseCurrency: string,
    quoteCurrency: string,
    limit?: number
  ): Promise<readonly ExchangeRate[]>;
}
