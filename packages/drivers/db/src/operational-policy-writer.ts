import type {
  DiscountPolicyInput,
  FinancialTransactionTaxPolicyInput,
  OperationalPolicyMetadata,
  OperationalPolicyWriter,
  PolicyActivation
} from '@supermarket/core';
import type { DatabaseHandle } from './connection.js';
import { mapDatabaseError, requireTransaction } from './unit-of-work.js';

type ActiveRow = { id: string; version: number };

const sameCodes = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const normalizeCodes = (codes: readonly string[]): readonly string[] =>
  [...new Set(codes.map((code) => code.trim().toUpperCase()).filter((code) => code.length > 0))]
    .sort((left, right) => left.localeCompare(right));

/**
 * Activa versiones de política operativa conservando el ledger append-only: una
 * versión nunca se edita ni se borra, solo se desactiva antes de insertar la
 * siguiente. Reactivar la misma configuración no crea una versión nueva.
 */
export class SqliteOperationalPolicyWriter implements OperationalPolicyWriter {
  constructor(private readonly handle: DatabaseHandle) {}

  activateDiscountPolicy(
    input: DiscountPolicyInput,
    metadata: OperationalPolicyMetadata
  ): PolicyActivation {
    return this.activate('DISCOUNT', metadata, (active) => {
      const current = this.handle.sqlite.prepare(
        'select maximum_basis_points as maximumBasisPoints from discount_policy_configuration where policy_id = ?'
      ).get(active.id) as { maximumBasisPoints: number } | undefined;
      return current?.maximumBasisPoints === input.maximumBasisPoints;
    }, (policyId) => {
      this.handle.sqlite.prepare(
        'insert into discount_policy_configuration (policy_id, maximum_basis_points) values (?, ?)'
      ).run(policyId, input.maximumBasisPoints);
    });
  }

  activateFinancialTransactionTaxPolicy(
    input: FinancialTransactionTaxPolicyInput,
    metadata: OperationalPolicyMetadata
  ): PolicyActivation {
    const methods = normalizeCodes(input.eligiblePaymentMethodCodes);
    const currencies = normalizeCodes(input.eligibleCurrencies);
    return this.activate('FINANCIAL_TRANSACTION_TAX', metadata, (active) => {
      const current = this.handle.sqlite.prepare(
        'select rate_basis_points as rateBasisPoints from financial_transaction_tax_policy_configuration where policy_id = ?'
      ).get(active.id) as { rateBasisPoints: number } | undefined;
      if (current?.rateBasisPoints !== input.rateBasisPoints) return false;
      const currentMethods = this.handle.sqlite.prepare(
        'select payment_method_code from financial_transaction_tax_payment_methods where policy_id = ? order by payment_method_code'
      ).pluck().all(active.id) as string[];
      const currentCurrencies = this.handle.sqlite.prepare(
        'select currency_code from financial_transaction_tax_currencies where policy_id = ? order by currency_code'
      ).pluck().all(active.id) as string[];
      return sameCodes(currentMethods, methods) && sameCodes(currentCurrencies, currencies);
    }, (policyId) => {
      this.handle.sqlite.prepare(
        'insert into financial_transaction_tax_policy_configuration (policy_id, rate_basis_points) values (?, ?)'
      ).run(policyId, input.rateBasisPoints);
      const insertMethod = this.handle.sqlite.prepare(
        'insert into financial_transaction_tax_payment_methods (policy_id, payment_method_code) values (?, ?)'
      );
      for (const code of methods) insertMethod.run(policyId, code);
      const insertCurrency = this.handle.sqlite.prepare(
        'insert into financial_transaction_tax_currencies (policy_id, currency_code) values (?, ?)'
      );
      for (const code of currencies) insertCurrency.run(policyId, code);
    });
  }

  private activate(
    policyType: 'DISCOUNT' | 'FINANCIAL_TRANSACTION_TAX',
    metadata: OperationalPolicyMetadata,
    isUnchanged: (active: ActiveRow) => boolean,
    insertConfiguration: (policyId: string) => void
  ): PolicyActivation {
    requireTransaction(this.handle.sqlite);
    try {
      const active = this.handle.sqlite.prepare(
        'select id, version from operational_policy_versions where policy_type = ? and is_active = 1'
      ).get(policyType) as ActiveRow | undefined;
      if (active && isUnchanged(active)) {
        return { created: false, policyId: active.id, version: active.version };
      }
      if (active) {
        this.handle.sqlite.prepare(
          'update operational_policy_versions set is_active = 0 where id = ?'
        ).run(active.id);
      }
      const version = ((this.handle.sqlite.prepare(
        'select max(version) as maximum from operational_policy_versions where policy_type = ?'
      ).get(policyType) as { maximum: number | null } | undefined)?.maximum ?? 0) + 1;
      this.handle.sqlite.prepare(`
        insert into operational_policy_versions
          (id, policy_type, version, is_active, valid_from, created_by, created_at, reason)
        values (?, ?, ?, 1, ?, ?, ?, ?)
      `).run(
        metadata.policyId, policyType, version, metadata.now.getTime(),
        metadata.createdBy, metadata.now.getTime(), metadata.reason
      );
      insertConfiguration(metadata.policyId);
      return { created: true, policyId: metadata.policyId, version };
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }
}
