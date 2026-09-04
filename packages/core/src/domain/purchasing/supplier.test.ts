import { describe, expect, it } from 'vitest';
import { Supplier, createFiscalAddress, createTaxIdentity, taxIdentityTypeFor } from './supplier.js';

describe('Supplier', () => {
  it('normalizes equivalent Venezuelan RIF values and starts active', () => {
    const dashed = createTaxIdentity({ country: 've', type: 'rif', value: 'J-12345678-9' });
    const plain = createTaxIdentity({ country: 'VE', type: 'RIF', value: 'j123456789' });

    expect(dashed.normalizedValue).toBe('J123456789');
    expect(plain.normalizedValue).toBe(dashed.normalizedValue);
    expect(Supplier.create({
      id: 'supplier-1', code: 'sup-000001', legalName: ' Distribuidora Uno ',
      taxIdentity: dashed, createdAt: new Date('2026-09-04T12:00:00Z')
    }).status).toBe('ACTIVE');
  });

  it('rejects an invalid Venezuelan RIF without inventing checksum validation', () => {
    expect(() => createTaxIdentity({ country: 'VE', type: 'RIF', value: '123' }))
      .toThrowError(expect.objectContaining({ code: 'SUPPLIER_TAX_IDENTITY_INVALID' }));
    expect(() => createTaxIdentity({ country: 'VE', type: 'RIF', value: 'X-12345678-9' }))
      .toThrowError(expect.objectContaining({ code: 'SUPPLIER_TAX_IDENTITY_INVALID' }));
    expect(() => createTaxIdentity({ country: 'VE', type: 'RIF', value: 'J-12345678-90' }))
      .toThrowError(expect.objectContaining({ code: 'SUPPLIER_TAX_IDENTITY_INVALID' }));
  });

  /**
   * Un dígito verificador que no cuadraría bajo los algoritmos comunitarios se
   * acepta: sin fuente oficial verificable del SENIAT no se bloquea por
   * checksum. Esta prueba fija esa decisión para que no se cuele después.
   */
  it('accepts every supported prefix with nine digits and no checksum rule', () => {
    for (const prefix of ['V', 'E', 'J', 'P', 'G', 'C']) {
      expect(createTaxIdentity({
        country: 'VE', type: 'RIF', value: `${prefix}-12345678-8`
      }).normalizedValue).toBe(`${prefix}123456788`);
    }
  });

  it('uses a generic tax identity outside Venezuela and rejects mismatched types', () => {
    expect(taxIdentityTypeFor('VE')).toBe('RIF');
    expect(taxIdentityTypeFor('CO')).toBe('TAX_ID');
    expect(createTaxIdentity({ country: 'co', type: 'tax_id', value: ' 900 123 456 ' }))
      .toEqual({
        country: 'CO', type: 'TAX_ID', value: '900 123 456', normalizedValue: '900123456'
      });
    expect(() => createTaxIdentity({ country: 'CO', type: 'NIT', value: '900123456' }))
      .toThrowError(expect.objectContaining({ code: 'SUPPLIER_TAX_TYPE_INVALID' }));
    expect(() => createTaxIdentity({ country: 'VE', type: 'TAX_ID', value: 'J123456789' }))
      .toThrowError(expect.objectContaining({ code: 'SUPPLIER_TAX_TYPE_INVALID' }));
    expect(() => createTaxIdentity({ country: 'VEN', type: 'RIF', value: 'J123456789' }))
      .toThrowError(expect.objectContaining({ code: 'SUPPLIER_TAX_COUNTRY_INVALID' }));
  });

  it('keeps the fiscal address optional but never half written', () => {
    expect(createFiscalAddress({ countryCode: 've', addressLine: ' Av. Bolívar ' }))
      .toEqual({ countryCode: 'VE', addressLine: 'Av. Bolívar' });
    expect(() => createFiscalAddress({ countryCode: 'VE', addressLine: '   ' }))
      .toThrowError(expect.objectContaining({ code: 'SUPPLIER_FISCAL_ADDRESS_LINE_REQUIRED' }));
    expect(() => createFiscalAddress({ countryCode: '', addressLine: 'Av. Bolívar' }))
      .toThrowError(expect.objectContaining({ code: 'SUPPLIER_FISCAL_ADDRESS_COUNTRY_INVALID' }));
    expect(Supplier.create({
      id: 'supplier-1', code: 'SUP-000001', legalName: 'Distribuidora Uno',
      taxIdentity: { country: 'VE', type: 'RIF', value: 'J-12345678-9' },
      createdAt: new Date('2026-09-04T12:00:00Z')
    }).fiscalAddress).toBeNull();
  });

  it('updates commercial data, status and fiscal identity with a new version', () => {
    const supplier = Supplier.create({
      id: 'supplier-1', code: 'SUP-000001', legalName: 'Distribuidora Uno',
      taxIdentity: { country: 'VE', type: 'RIF', value: 'J-12345678-9' },
      createdAt: new Date('2026-09-04T12:00:00Z')
    });
    supplier.update(
      { tradeName: 'Uno', fiscalAddress: { countryCode: 've', addressLine: ' Caracas ' } },
      new Date('2026-09-04T13:00:00Z')
    );
    supplier.changeStatus('BLOCKED', new Date('2026-09-04T14:00:00Z'));
    supplier.correctTaxIdentity(
      { country: 'VE', type: 'RIF', value: 'J-12345677-0' },
      new Date('2026-09-04T15:00:00Z')
    );

    expect({
      tradeName: supplier.tradeName, fiscalAddress: supplier.fiscalAddress,
      status: supplier.status, taxIdentity: supplier.taxIdentity.normalizedValue,
      version: supplier.version
    }).toEqual({
      tradeName: 'Uno', fiscalAddress: { countryCode: 'VE', addressLine: 'Caracas' },
      status: 'BLOCKED', taxIdentity: 'J123456770', version: 4
    });
  });

  it('rejects an empty update and invalid restored state instead of trusting adapters', () => {
    const supplier = Supplier.create({
      id: 'supplier-1', code: 'SUP-000001', legalName: 'Distribuidora Uno',
      taxIdentity: { country: 'VE', type: 'RIF', value: 'J-12345678-9' },
      createdAt: new Date('2026-09-04T12:00:00Z')
    });
    expect(() => supplier.update({}, new Date('2026-09-04T13:00:00Z')))
      .toThrowError(expect.objectContaining({ code: 'SUPPLIER_UPDATE_REQUIRED' }));
    expect(() => Supplier.restore({
      id: supplier.id, code: supplier.code, legalName: supplier.legalName,
      taxIdentity: { ...supplier.taxIdentity, normalizedValue: 'ALTERED' },
      status: 'ACTIVE', createdAt: supplier.createdAt, updatedAt: supplier.updatedAt, version: 1
    })).toThrowError(expect.objectContaining({ code: 'SUPPLIER_TAX_IDENTITY_INVALID' }));
  });
});
