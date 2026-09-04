import { describe, expect, it } from 'vitest';
import { err, ok, ApplicationError, type AppError, type Result } from '@supermarket/shared';
import type { ExchangeRateProvider } from '../ports/index.js';
import type { ExchangeRateSuggestionDto } from './dtos.js';
import { GetSuggestedExchangeRate } from './get-suggested-exchange-rate.js';

const suggestion: ExchangeRateSuggestionDto = {
  baseCurrency: 'USD', quoteCurrency: 'VES', rateValue: 365125, rateScale: 3,
  source: 'Proveedor de prueba', observedAt: new Date('2026-09-04T12:00:00.000Z'),
  validFrom: null, validUntil: null
};

class FakeExchangeRateProvider implements ExchangeRateProvider {
  calls: Array<{ baseCurrency: string; quoteCurrency: string }> = [];
  constructor(private readonly result: Result<ExchangeRateSuggestionDto, AppError>) {}

  async getSuggestedRate(
    baseCurrency: string,
    quoteCurrency: string
  ): Promise<Result<ExchangeRateSuggestionDto, AppError>> {
    this.calls.push({ baseCurrency, quoteCurrency });
    return this.result;
  }
}

describe('GetSuggestedExchangeRate', () => {
  it('passes the requested pair through to the provider and returns its suggestion unchanged', async () => {
    const provider = new FakeExchangeRateProvider(ok(suggestion));
    const useCase = new GetSuggestedExchangeRate(provider);

    const result = await useCase.execute('USD', 'VES');

    expect(result).toEqual({ ok: true, value: suggestion });
    expect(provider.calls).toEqual([{ baseCurrency: 'USD', quoteCurrency: 'VES' }]);
  });

  it('propagates a provider failure without wrapping or swallowing its error code', async () => {
    const failure = err(new ApplicationError('NETWORK_UNAVAILABLE', 'Exchange rate suggestion is unavailable.'));
    const provider = new FakeExchangeRateProvider(failure);
    const useCase = new GetSuggestedExchangeRate(provider);

    const result = await useCase.execute('USD', 'VES');

    expect(result).toEqual(failure);
  });

  it('never touches persistence: the use case has no port capable of writing a rate', () => {
    const provider = new FakeExchangeRateProvider(ok(suggestion));
    const useCase = new GetSuggestedExchangeRate(provider);

    expect(Object.keys(useCase)).toEqual(['provider']);
  });
});
