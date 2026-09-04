import type {
  DiscountPolicy,
  DiscountPolicyProvider,
  FinancialTransactionTaxPolicy,
  FinancialTransactionTaxPolicyProvider
} from '@supermarket/core';
import { ApplicationError, TaxRate } from '@supermarket/shared';
import type { DatabaseHandle } from './connection.js';
import { mapDatabaseError } from './unit-of-work.js';

type DiscountRow = { id: string; maximumBasisPoints: number };
type TaxRow = { id: string; rateBasisPoints: number };

const missing = (type: string): ApplicationError => new ApplicationError(
  'POLICY_NOT_CONFIGURED',
  `${type} policy is not configured.`
);

export class SqliteDiscountPolicyProvider implements DiscountPolicyProvider {
  constructor(private readonly handle: DatabaseHandle) {}

  async getPolicy(): Promise<DiscountPolicy> {
    try {
      const row = this.handle.sqlite.prepare(`
        select p.id, c.maximum_basis_points as maximumBasisPoints
        from operational_policy_versions p
        join discount_policy_configuration c on c.policy_id = p.id
        where p.policy_type = 'DISCOUNT' and p.is_active = 1
        order by p.version desc limit 1
      `).get() as DiscountRow | undefined;
      if (!row) throw missing('Discount');
      return row;
    } catch (error) {
      if (error instanceof ApplicationError) throw error;
      throw mapDatabaseError(error);
    }
  }
}

export class SqliteFinancialTransactionTaxPolicyProvider
implements FinancialTransactionTaxPolicyProvider {
  constructor(private readonly handle: DatabaseHandle) {}

  async getPolicy(): Promise<FinancialTransactionTaxPolicy> {
    try {
      const row = this.handle.sqlite.prepare(`
        select p.id, c.rate_basis_points as rateBasisPoints
        from operational_policy_versions p
        join financial_transaction_tax_policy_configuration c on c.policy_id = p.id
        where p.policy_type = 'FINANCIAL_TRANSACTION_TAX' and p.is_active = 1
        order by p.version desc limit 1
      `).get() as TaxRow | undefined;
      if (!row) throw missing('Financial transaction tax');
      const methods = this.handle.sqlite.prepare(`
        select payment_method_code from financial_transaction_tax_payment_methods
        where policy_id = ? order by payment_method_code
      `).pluck().all(row.id) as string[];
      const currencies = this.handle.sqlite.prepare(`
        select currency_code from financial_transaction_tax_currencies
        where policy_id = ? order by currency_code
      `).pluck().all(row.id) as string[];
      return {
        id: row.id,
        rate: TaxRate.fromBasisPoints(row.rateBasisPoints),
        eligiblePaymentMethodCodes: methods,
        eligibleCurrencies: currencies
      };
    } catch (error) {
      if (error instanceof ApplicationError) throw error;
      throw mapDatabaseError(error);
    }
  }
}
