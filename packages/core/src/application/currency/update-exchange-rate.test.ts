import { describe, expect, it } from 'vitest';
import { ExchangeRate } from '../../domain/currency/index.js';
import type { ExchangeRateRepository, IdGenerator } from '../ports/index.js';
import { UpdateExchangeRate } from './update-exchange-rate.js';

class FakeIdGenerator implements IdGenerator {
  nextId = 'generated-rate-id';
  generate(): string {
    return this.nextId;
  }
}

class FakeExchangeRateRepository implements ExchangeRateRepository {
  rates: ExchangeRate[] = [];

  async save(rate: ExchangeRate): Promise<void> {
    this.rates.push(rate);
  }

  async findCurrentByPair(): Promise<ExchangeRate | null> {
    return null;
  }

  async findById(): Promise<ExchangeRate | null> {
    return null;
  }
}

describe('UpdateExchangeRate', () => {
  it('registers a new exchange rate', async () => {
    const idGenerator = new FakeIdGenerator();
    const repository = new FakeExchangeRateRepository();
    const useCase = new UpdateExchangeRate(idGenerator, repository);

    const result = await useCase.execute({
      baseCurrency: 'USD',
      quoteCurrency: 'VES',
      rateValue: 36500,
      rateScale: 3,
      source: 'BCV',
      validFrom: new Date('2026-08-01T00:00:00Z'),
      registeredBy: 'user-001'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.id).toBe('generated-rate-id');
    expect(result.value.baseCurrency).toBe('USD');
    expect(result.value.quoteCurrency).toBe('VES');
    expect(repository.rates).toHaveLength(1);
    expect(repository.rates[0]?.id).toBe('generated-rate-id');
  });

  it('returns a domain error for invalid input', async () => {
    const idGenerator = new FakeIdGenerator();
    const repository = new FakeExchangeRateRepository();
    const useCase = new UpdateExchangeRate(idGenerator, repository);

    const result = await useCase.execute({
      baseCurrency: 'USD',
      quoteCurrency: 'USD',
      rateValue: 36500,
      rateScale: 3,
      source: 'BCV',
      validFrom: new Date('2026-08-01T00:00:00Z'),
      registeredBy: 'user-001'
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe('EXCHANGE_RATE_INVALID_PAIR');
    expect(repository.rates).toHaveLength(0);
  });
});
