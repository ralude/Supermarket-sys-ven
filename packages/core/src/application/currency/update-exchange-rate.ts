import { ok, err, type Result, type AppError, DomainError } from '@supermarket/shared';
import { ExchangeRate } from '../../domain/currency/index.js';
import type { IdGenerator } from '../ports/id-generator.js';
import type { ExchangeRateRepository } from '../ports/exchange-rate-repository.js';
import type { ExchangeRateDto, UpdateExchangeRateInput } from './dtos.js';

function toDto(rate: ExchangeRate): ExchangeRateDto {
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
 * Caso de uso para registrar una nueva tasa de cambio. No modifica tasas
 * históricas; cada registro crea una nueva entrada con vigencia explícita.
 */
export class UpdateExchangeRate {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: ExchangeRateRepository
  ) {}

  async execute(
    input: UpdateExchangeRateInput
  ): Promise<Result<ExchangeRateDto, AppError>> {
    try {
      const rate = ExchangeRate.create({
        id: this.idGenerator.generate(),
        ...input
      });
      await this.repository.save(rate);
      return ok(toDto(rate));
    } catch (error) {
      if (error instanceof DomainError) {
        return err(error);
      }
      throw error;
    }
  }
}
