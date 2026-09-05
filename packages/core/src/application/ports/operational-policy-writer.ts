export type DiscountPolicyInput = { readonly maximumBasisPoints: number };

export type FinancialTransactionTaxPolicyInput = {
  readonly rateBasisPoints: number;
  readonly eligiblePaymentMethodCodes: readonly string[];
  readonly eligibleCurrencies: readonly string[];
};

export type OperationalPolicyMetadata = {
  readonly policyId: string;
  readonly createdBy: string;
  readonly reason: string;
  readonly now: Date;
};

export type PolicyActivation = {
  /** `false` cuando la política activa ya tenía exactamente la misma configuración. */
  readonly created: boolean;
  readonly policyId: string;
  readonly version: number;
};

/**
 * Activa versiones de política operativa (ADR-0012) conservando el ledger
 * append-only: una versión nunca se edita ni se borra, solo se desactiva antes
 * de insertar la siguiente. Reactivar la misma configuración no crea una
 * versión nueva.
 */
export interface OperationalPolicyWriter {
  activateDiscountPolicy(
    input: DiscountPolicyInput,
    metadata: OperationalPolicyMetadata
  ): PolicyActivation;
  activateFinancialTransactionTaxPolicy(
    input: FinancialTransactionTaxPolicyInput,
    metadata: OperationalPolicyMetadata
  ): PolicyActivation;
}
