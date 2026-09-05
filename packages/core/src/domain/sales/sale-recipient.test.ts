import { describe, expect, it } from 'vitest';
import { createSaleRecipientSnapshot, saleRecipientTypeFor } from './sale-recipient.js';

describe('sale recipient snapshot', () => {
  it('canonicalizes a Venezuelan identification without applying a checksum', () => {
    const snapshot = createSaleRecipientSnapshot({
      country: 've', type: 'rif', value: ' j-12.345.678-9 ',
      name: '  Bodega Central  ', address: ' Av. Urdaneta '
    });

    expect(snapshot).toEqual({
      country: 'VE', type: 'RIF', value: 'j-12.345.678-9', normalizedValue: 'J123456789',
      name: 'Bodega Central', address: 'Av. Urdaneta'
    });
  });

  it('accepts a natural person through the V prefix', () => {
    expect(createSaleRecipientSnapshot({
      country: 'VE', type: 'RIF', value: 'V-12345678-9'
    }).normalizedValue).toBe('V123456789');
  });

  it('keeps name and address null when the operator omits them', () => {
    const snapshot = createSaleRecipientSnapshot({
      country: 'VE', type: 'RIF', value: 'J123456789', name: '   ', address: null
    });

    expect(snapshot.name).toBeNull();
    expect(snapshot.address).toBeNull();
  });

  it('normalizes a generic identification outside Venezuela', () => {
    expect(createSaleRecipientSnapshot({
      country: 'co', type: 'TAX_ID', value: ' 900 123 456 '
    })).toEqual({
      country: 'CO', type: 'TAX_ID', value: '900 123 456', normalizedValue: '900123456',
      name: null, address: null
    });
  });

  it('rejects a malformed Venezuelan identification', () => {
    expect(() => createSaleRecipientSnapshot({
      country: 'VE', type: 'RIF', value: 'J-1234-5'
    })).toThrowError(expect.objectContaining({ code: 'SALE_RECIPIENT_IDENTIFICATION_INVALID' }));
    expect(() => createSaleRecipientSnapshot({
      country: 'VE', type: 'RIF', value: 'X123456789'
    })).toThrowError(expect.objectContaining({ code: 'SALE_RECIPIENT_IDENTIFICATION_INVALID' }));
  });

  it('rejects an unsupported type, an invalid country and an empty value', () => {
    expect(() => createSaleRecipientSnapshot({
      country: 'VE', type: 'CI', value: 'V123456789'
    })).toThrowError(expect.objectContaining({ code: 'SALE_RECIPIENT_TYPE_INVALID' }));
    expect(() => createSaleRecipientSnapshot({
      country: 'VEN', type: 'RIF', value: 'V123456789'
    })).toThrowError(expect.objectContaining({ code: 'SALE_RECIPIENT_COUNTRY_INVALID' }));
    expect(() => createSaleRecipientSnapshot({
      country: 'VE', type: 'RIF', value: '   '
    })).toThrowError(expect.objectContaining({ code: 'SALE_RECIPIENT_IDENTIFICATION_REQUIRED' }));
  });

  it('maps the supported type per country', () => {
    expect(saleRecipientTypeFor('VE')).toBe('RIF');
    expect(saleRecipientTypeFor('CO')).toBe('TAX_ID');
  });

  it('derives the type from the country when the operator omits it', () => {
    expect(createSaleRecipientSnapshot({ country: 'VE', value: 'J123456789' }).type).toBe('RIF');
    expect(createSaleRecipientSnapshot({ country: 'CO', value: '900123456' }).type).toBe('TAX_ID');
  });
});
