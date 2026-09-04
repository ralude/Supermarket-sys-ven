import { describe, expect, it } from 'vitest';
import { ExchangeRate } from '../../domain/currency/index.js';
import type { ExchangeRateHistoryRepository } from '../ports/index.js';
import { GetExchangeRateHistory } from './get-exchange-rate-history.js';

const rate = (id: string, validFrom: string): ExchangeRate => ExchangeRate.create({
  id, baseCurrency: 'USD', quoteCurrency: 'VES', rateValue: 365000, rateScale: 3,
  source: 'Carga manual', validFrom: new Date(validFrom), registeredBy: 'user-001'
});

class FakeExchangeRateHistoryRepository implements ExchangeRateHistoryRepository {
  calls: Array<{ baseCurrency: string; quoteCurrency: string; limit?: number }> = [];
  constructor(private readonly rates: readonly ExchangeRate[]) {}

  async findHistoryByPair(
    baseCurrency: string,
    quoteCurrency: string,
    limit?: number
  ): Promise<readonly ExchangeRate[]> {
    this.calls.push({ baseCurrency, quoteCurrency, ...(limit === undefined ? {} : { limit }) });
    return this.rates;
  }
}

describe('GetExchangeRateHistory', () => {
  it('maps repository history to the shared exchange rate DTO', async () => {
    const repository = new FakeExchangeRateHistoryRepository([
      rate('rate-2', '2026-09-02T00:00:00.000Z'), rate('rate-1', '2026-09-01T00:00:00.000Z')
    ]);
    const useCase = new GetExchangeRateHistory(repository);

    const result = await useCase.execute('USD', 'VES');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((entry) => entry.id)).toEqual(['rate-2', 'rate-1']);
    expect(result.value[0]).toMatchObject({ rateValue: 365000, rateScale: 3, source: 'Carga manual' });
  });

  it('defaults to a bounded limit and forwards an explicit one to the repository', async () => {
    const repository = new FakeExchangeRateHistoryRepository([]);
    const useCase = new GetExchangeRateHistory(repository);

    await useCase.execute('USD', 'VES');
    await useCase.execute('USD', 'VES', 25);

    expect(repository.calls).toEqual([
      { baseCurrency: 'USD', quoteCurrency: 'VES', limit: 100 },
      { baseCurrency: 'USD', quoteCurrency: 'VES', limit: 25 }
    ]);
  });

  it('rejects a limit outside the approved range before querying the repository', async () => {
    const repository = new FakeExchangeRateHistoryRepository([]);
    const useCase = new GetExchangeRateHistory(repository);

    const tooLow = await useCase.execute('USD', 'VES', 0);
    const tooHigh = await useCase.execute('USD', 'VES', 501);
    const fractional = await useCase.execute('USD', 'VES', 1.5);

    for (const result of [tooLow, tooHigh, fractional]) {
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.code).toBe('CURRENCY_HISTORY_LIMIT_INVALID');
    }
    expect(repository.calls).toEqual([]);
  });
});
