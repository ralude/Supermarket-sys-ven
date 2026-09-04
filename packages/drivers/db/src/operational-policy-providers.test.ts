import { afterEach, describe, expect, it } from 'vitest';
import { applyMigrations } from './migrations.js';
import { openDatabase, type DatabaseHandle } from './connection.js';
import {
  SqliteDiscountPolicyProvider,
  SqliteFinancialTransactionTaxPolicyProvider
} from './operational-policy-providers.js';

describe('operational policy providers', () => {
  const handles: DatabaseHandle[] = [];
  afterEach(() => handles.splice(0).forEach((handle) => handle.close()));

  const setup = () => {
    const handle = openDatabase(':memory:');
    handles.push(handle);
    applyMigrations(handle.sqlite);
    return handle;
  };

  it('fails closed when no active policy exists', async () => {
    const handle = setup();
    await expect(new SqliteDiscountPolicyProvider(handle).getPolicy())
      .rejects.toMatchObject({ code: 'POLICY_NOT_CONFIGURED' });
    await expect(new SqliteFinancialTransactionTaxPolicyProvider(handle).getPolicy())
      .rejects.toMatchObject({ code: 'POLICY_NOT_CONFIGURED' });
  });

  it('restores explicit versioned discount and tax configuration', async () => {
    const handle = setup();
    handle.sqlite.exec(`
      insert into operational_policy_versions
        (id, policy_type, version, is_active, valid_from, created_by, created_at, reason)
      values
        ('discount-v1', 'DISCOUNT', 1, 1, 1, 'admin-001', 1, 'Initial policy'),
        ('igtf-v1', 'FINANCIAL_TRANSACTION_TAX', 1, 1, 1, 'admin-001', 1, 'Initial policy');
      insert into discount_policy_configuration (policy_id, maximum_basis_points)
        values ('discount-v1', 1500);
      insert into financial_transaction_tax_policy_configuration (policy_id, rate_basis_points)
        values ('igtf-v1', 300);
      insert into financial_transaction_tax_payment_methods (policy_id, payment_method_code)
        values ('igtf-v1', 'CASH_USD');
      insert into financial_transaction_tax_currencies (policy_id, currency_code)
        values ('igtf-v1', 'USD');
    `);

    await expect(new SqliteDiscountPolicyProvider(handle).getPolicy()).resolves.toEqual({
      id: 'discount-v1', maximumBasisPoints: 1500
    });
    const tax = await new SqliteFinancialTransactionTaxPolicyProvider(handle).getPolicy();
    expect(tax).toMatchObject({
      id: 'igtf-v1', rate: { basisPoints: 300 },
      eligiblePaymentMethodCodes: ['CASH_USD'], eligibleCurrencies: ['USD']
    });
  });
});
