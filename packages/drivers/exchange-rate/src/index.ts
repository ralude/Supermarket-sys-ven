import { err, InfrastructureError, ok, type AppError, type Result } from '@supermarket/shared';
import type {
  ExchangeRateProvider,
  ExchangeRateSuggestionDto
} from '@supermarket/core';

export type ExchangeRateProviderConfig = {
  readonly endpoint: string | null;
  readonly source: string;
  readonly timeoutMs?: number;
  readonly fetcher?: typeof fetch;
};

type ProviderPayload = {
  readonly baseCurrency?: unknown;
  readonly quoteCurrency?: unknown;
  readonly rateValue?: unknown;
  readonly rateScale?: unknown;
  readonly rate?: unknown;
  readonly source?: unknown;
  readonly observedAt?: unknown;
  readonly validFrom?: unknown;
  readonly validUntil?: unknown;
};

const error = (code: string, message: string): Result<never, AppError> =>
  err(new InfrastructureError(code, message));

const decimalRate = (value: string): { value: number; scale: number } | null => {
  const match = /^([0-9]+)(?:\.([0-9]{1,8}))?$/.exec(value.trim());
  if (!match) return null;
  const fraction = match[2] ?? '';
  const digits = `${match[1]}${fraction}`;
  const parsed = Number(digits);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? { value: parsed, scale: fraction.length }
    : null;
};

const isoOrNull = (value: unknown): Date | null => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export class HttpExchangeRateProvider implements ExchangeRateProvider {
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly config: ExchangeRateProviderConfig) {
    this.fetcher = config.fetcher ?? globalThis.fetch;
    this.timeoutMs = config.timeoutMs ?? 5000;
  }

  async getSuggestedRate(
    baseCurrency: string,
    quoteCurrency: string
  ): Promise<Result<ExchangeRateSuggestionDto, AppError>> {
    if (!this.config.endpoint) {
      return error('EXCHANGE_RATE_PROVIDER_NOT_CONFIGURED', 'Exchange rate provider is not configured.');
    }
    const url = new URL(this.config.endpoint);
    url.searchParams.set('baseCurrency', baseCurrency);
    url.searchParams.set('quoteCurrency', quoteCurrency);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetcher(url, { method: 'GET', headers: { accept: 'application/json' }, signal: controller.signal });
    } catch {
      return error('NETWORK_UNAVAILABLE', 'Exchange rate suggestion is unavailable.');
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) return error('NETWORK_UNAVAILABLE', 'Exchange rate suggestion is unavailable.');
    let payload: ProviderPayload;
    try { payload = await response.json() as ProviderPayload; } catch {
      return error('EXCHANGE_RATE_PROVIDER_INVALID_RESPONSE', 'Exchange rate provider response is invalid.');
    }
    return this.toSuggestion(payload, baseCurrency, quoteCurrency);
  }

  private toSuggestion(
    payload: ProviderPayload,
    baseCurrency: string,
    quoteCurrency: string
  ): Result<ExchangeRateSuggestionDto, AppError> {
    if (payload.baseCurrency !== undefined && payload.baseCurrency !== baseCurrency) {
      return error('EXCHANGE_RATE_PAIR_UNSUPPORTED', 'Exchange rate provider returned a different currency pair.');
    }
    if (payload.quoteCurrency !== undefined && payload.quoteCurrency !== quoteCurrency) {
      return error('EXCHANGE_RATE_PAIR_UNSUPPORTED', 'Exchange rate provider returned a different currency pair.');
    }
    let rateValue: number;
    let rateScale: number;
    if (Number.isSafeInteger(payload.rateValue) && Number.isInteger(payload.rateScale)) {
      rateValue = payload.rateValue as number;
      rateScale = payload.rateScale as number;
    } else if (typeof payload.rate === 'string') {
      const parsed = decimalRate(payload.rate);
      if (!parsed) return error('EXCHANGE_RATE_PROVIDER_INVALID_RESPONSE', 'Exchange rate provider response is invalid.');
      rateValue = parsed.value;
      rateScale = parsed.scale;
    } else {
      return error('EXCHANGE_RATE_PROVIDER_INVALID_RESPONSE', 'Exchange rate provider response is invalid.');
    }
    if (rateValue <= 0 || rateScale < 0 || rateScale > 8) {
      return error('EXCHANGE_RATE_PROVIDER_INVALID_RESPONSE', 'Exchange rate provider response is invalid.');
    }
    const observedAt = isoOrNull(payload.observedAt) ?? new Date();
    const validFrom = isoOrNull(payload.validFrom);
    const validUntil = isoOrNull(payload.validUntil);
    if (validFrom && validUntil && validUntil <= validFrom) {
      return error('EXCHANGE_RATE_PROVIDER_INVALID_RESPONSE', 'Exchange rate provider response is invalid.');
    }
    return ok({
      baseCurrency,
      quoteCurrency,
      rateValue,
      rateScale,
      source: typeof payload.source === 'string' && payload.source.trim().length > 0
        ? payload.source.trim() : this.config.source,
      observedAt,
      validFrom,
      validUntil
    });
  }
}

export class UnavailableExchangeRateProvider implements ExchangeRateProvider {
  getSuggestedRate(
    baseCurrency: string,
    quoteCurrency: string
  ): Promise<Result<ExchangeRateSuggestionDto, AppError>> {
    return Promise.resolve(error(
      'EXCHANGE_RATE_PROVIDER_NOT_CONFIGURED',
      `Exchange rate provider is not configured for ${baseCurrency}/${quoteCurrency}.`
    ));
  }
}
