import type { ExchangeRate } from '../../domain/currency/index.js';

/**
 * Puerto de repositorio para tasas de cambio. Persistencia real en Fase 3.
 */
export interface ExchangeRateRepository {
  save(rate: ExchangeRate): Promise<void>;
  findCurrentByPair(
    baseCurrency: string,
    quoteCurrency: string,
    at: Date
  ): Promise<ExchangeRate | null>;
  findById(rateId: string): Promise<ExchangeRate | null>;
}
