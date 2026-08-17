import type { TaxRate } from '@supermarket/shared';

export type FinancialTransactionTaxPolicy = {
  id: string;
  rate: TaxRate;
  eligiblePaymentMethodCodes: readonly string[];
  eligibleCurrencies: readonly string[];
};

export interface FinancialTransactionTaxPolicyProvider {
  getPolicy(): Promise<FinancialTransactionTaxPolicy>;
}
