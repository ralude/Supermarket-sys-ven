import { describe, expect, it } from 'vitest';
import { ApplicationError, err, ok } from './index.js';

describe('Result', () => {
  it('represents a successful value', () => {
    const result = ok({ id: 'sale-1' });

    expect(result).toEqual({ ok: true, value: { id: 'sale-1' } });
  });

  it('represents an expected application error', () => {
    const result = err(new ApplicationError('NOT_FOUND', 'Resource not found.'));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });
});
