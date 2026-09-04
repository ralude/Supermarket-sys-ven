import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type DatabaseHandle } from './connection.js';
import { applyMigrations } from './migrations.js';
import {
  SqliteDiscountPolicyProvider,
  SqliteFinancialTransactionTaxPolicyProvider
} from './operational-policy-providers.js';
import { SqliteOperationalPolicyWriter } from './operational-policy-writer.js';
import { SqliteUnitOfWork } from './unit-of-work.js';

const metadata = (policyId: string) => ({
  policyId, createdBy: 'bootstrap:test', reason: 'Configuración inicial de prueba',
  now: new Date('2026-09-04T00:00:00.000Z')
});

describe('operational policy writer', () => {
  const handles: DatabaseHandle[] = [];
  afterEach(() => handles.splice(0).forEach((handle) => handle.close()));

  const setup = (): { handle: DatabaseHandle; unitOfWork: SqliteUnitOfWork } => {
    const handle = openDatabase(':memory:');
    handles.push(handle);
    applyMigrations(handle.sqlite);
    return { handle, unitOfWork: new SqliteUnitOfWork(handle.sqlite) };
  };

  const activeVersions = (handle: DatabaseHandle, policyType: string): number =>
    handle.sqlite.prepare(
      'select count(*) from operational_policy_versions where policy_type = ? and is_active = 1'
    ).pluck().get(policyType) as number;

  it('requires an active transaction before writing a policy version', () => {
    const { handle } = setup();

    expect(() => new SqliteOperationalPolicyWriter(handle)
      .activateDiscountPolicy({ maximumBasisPoints: 1500 }, metadata('policy-1')))
      .toThrowError(expect.objectContaining({ code: 'DATABASE_TRANSACTION_REQUIRED' }));
  });

  it('activates a first version that the provider can read back', async () => {
    const { handle, unitOfWork } = setup();
    const writer = new SqliteOperationalPolicyWriter(handle);

    const activation = await unitOfWork.execute(async () =>
      writer.activateDiscountPolicy({ maximumBasisPoints: 1500 }, metadata('policy-discount-1')));

    expect(activation).toEqual({ created: true, policyId: 'policy-discount-1', version: 1 });
    await expect(new SqliteDiscountPolicyProvider(handle).getPolicy())
      .resolves.toEqual({ id: 'policy-discount-1', maximumBasisPoints: 1500 });
  });

  it('does not create a new version when the active configuration is identical', async () => {
    const { handle, unitOfWork } = setup();
    const writer = new SqliteOperationalPolicyWriter(handle);
    await unitOfWork.execute(async () =>
      writer.activateDiscountPolicy({ maximumBasisPoints: 1500 }, metadata('policy-discount-1')));

    const replay = await unitOfWork.execute(async () =>
      writer.activateDiscountPolicy({ maximumBasisPoints: 1500 }, metadata('policy-discount-2')));

    expect(replay).toEqual({ created: false, policyId: 'policy-discount-1', version: 1 });
    expect(handle.sqlite.prepare('select count(*) from operational_policy_versions').pluck().get()).toBe(1);
  });

  it('deactivates the previous version and appends a new one when the configuration changes', async () => {
    const { handle, unitOfWork } = setup();
    const writer = new SqliteOperationalPolicyWriter(handle);
    await unitOfWork.execute(async () =>
      writer.activateDiscountPolicy({ maximumBasisPoints: 1500 }, metadata('policy-discount-1')));

    const next = await unitOfWork.execute(async () =>
      writer.activateDiscountPolicy({ maximumBasisPoints: 2000 }, metadata('policy-discount-2')));

    expect(next).toEqual({ created: true, policyId: 'policy-discount-2', version: 2 });
    expect(activeVersions(handle, 'DISCOUNT')).toBe(1);
    expect(handle.sqlite.prepare('select count(*) from operational_policy_versions').pluck().get()).toBe(2);
    expect(handle.sqlite.prepare(
      'select is_active from operational_policy_versions where id = ?'
    ).pluck().get('policy-discount-1')).toBe(0);
    await expect(new SqliteDiscountPolicyProvider(handle).getPolicy())
      .resolves.toEqual({ id: 'policy-discount-2', maximumBasisPoints: 2000 });
  });

  it('stores the financial transaction tax rate with its normalized eligibility lists', async () => {
    const { handle, unitOfWork } = setup();
    const writer = new SqliteOperationalPolicyWriter(handle);

    await unitOfWork.execute(async () => writer.activateFinancialTransactionTaxPolicy({
      rateBasisPoints: 300,
      eligiblePaymentMethodCodes: ['card', 'CARD', ' transfer '],
      eligibleCurrencies: ['usd']
    }, metadata('policy-igtf-1')));

    const policy = await new SqliteFinancialTransactionTaxPolicyProvider(handle).getPolicy();
    expect(policy.id).toBe('policy-igtf-1');
    expect(policy.rate.basisPoints).toBe(300);
    expect(policy.eligiblePaymentMethodCodes).toEqual(['CARD', 'TRANSFER']);
    expect(policy.eligibleCurrencies).toEqual(['USD']);
  });

  it('treats a different eligibility list as a new version of the tax policy', async () => {
    const { handle, unitOfWork } = setup();
    const writer = new SqliteOperationalPolicyWriter(handle);
    const input = {
      rateBasisPoints: 300, eligiblePaymentMethodCodes: ['CARD'], eligibleCurrencies: ['USD']
    };
    await unitOfWork.execute(async () =>
      writer.activateFinancialTransactionTaxPolicy(input, metadata('policy-igtf-1')));

    const replay = await unitOfWork.execute(async () =>
      writer.activateFinancialTransactionTaxPolicy(input, metadata('policy-igtf-2')));
    const changed = await unitOfWork.execute(async () =>
      writer.activateFinancialTransactionTaxPolicy(
        { ...input, eligiblePaymentMethodCodes: ['CARD', 'TRANSFER'] }, metadata('policy-igtf-3')
      ));

    expect(replay.created).toBe(false);
    expect(changed).toEqual({ created: true, policyId: 'policy-igtf-3', version: 2 });
    expect(activeVersions(handle, 'FINANCIAL_TRANSACTION_TAX')).toBe(1);
  });
});
