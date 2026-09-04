import { describe, expect, it } from 'vitest';
import { Supplier, createTaxIdentity } from './supplier.js';

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
  });

  it('updates commercial data, status and fiscal identity with a new version', () => {
    const supplier = Supplier.create({
      id: 'supplier-1', code: 'SUP-000001', legalName: 'Distribuidora Uno',
      taxIdentity: { country: 'VE', type: 'RIF', value: 'J-12345678-9' },
      createdAt: new Date('2026-09-04T12:00:00Z')
    });
    supplier.update({ tradeName: 'Uno', fiscalAddress: 'Caracas' }, new Date('2026-09-04T13:00:00Z'));
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
      tradeName: 'Uno', fiscalAddress: 'Caracas', status: 'BLOCKED',
      taxIdentity: 'J123456770', version: 4
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
