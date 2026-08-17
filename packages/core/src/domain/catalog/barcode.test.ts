import { describe, expect, it } from 'vitest';
import { DomainError } from '@supermarket/shared';
import { Barcode } from './barcode.js';

describe('Barcode', () => {
  it('normalizes a barcode before storing it', () => {
    const barcode = Barcode.create({
      id: 'barcode-001',
      value: '  0123456789  '
    });

    expect(barcode.value).toBe('0123456789');
    expect(barcode.isActive).toBe(true);
  });

  it('rejects empty and malformed values', () => {
    expect(() => Barcode.create({ id: 'barcode-001', value: ' ' })).toThrowError(
      new DomainError('BARCODE_REQUIRED', 'Barcode is required.')
    );
    expect(() => Barcode.create({ id: 'barcode-001', value: '12/34' })).toThrowError(
      new DomainError('BARCODE_INVALID_FORMAT', 'Barcode must contain only letters and digits.')
    );
  });
});
