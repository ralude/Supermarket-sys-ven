import { afterEach, describe, expect, it } from 'vitest';
import {
  applyMigrations,
  DrizzleCashRegisterRepository,
  DrizzlePaymentMethodRepository,
  openDatabase,
  SqliteDiscountPolicyProvider,
  SqliteFinancialTransactionTaxPolicyProvider,
  type DatabaseHandle
} from '@supermarket/driver-db';
import { bootstrapOperations } from './bootstrap-operations.ts';

const identity = {
  terminalId: '01991992-a860-7000-8000-000000000001',
  originNodeId: '01991992-a860-7000-8000-000000000002'
};

const options = {
  currencyCode: 'USD',
  discountMaximumBasisPoints: 1500,
  financialTransactionTaxBasisPoints: 300,
  financialTransactionTaxPaymentMethods: ['CARD'],
  financialTransactionTaxCurrencies: ['USD'],
  cashRegisterId: '0199a0f0-0000-7000-8000-000000005001',
  cashRegisterName: 'Caja 1'
};

describe('operations bootstrap', () => {
  let handle: DatabaseHandle | undefined;

  afterEach(() => {
    handle?.close();
    handle = undefined;
  });

  const setup = (): DatabaseHandle => {
    const opened = openDatabase(':memory:');
    handle = opened;
    applyMigrations(opened.sqlite);
    return opened;
  };

  it('provisions a cash register owned by the running node, its payment methods and both policies', async () => {
    const database = setup();

    const result = await bootstrapOperations(database, identity, options);

    expect(result).toMatchObject({
      cashRegisterId: options.cashRegisterId,
      paymentMethodCodes: ['CASH', 'CARD'],
      discountPolicyCreated: true,
      taxPolicyCreated: true
    });
    const register = await new DrizzleCashRegisterRepository(database)
      .findById(options.cashRegisterId);
    expect(() => register?.assertOperationalFor(identity.terminalId, identity.originNodeId))
      .not.toThrow();
    const cash = await new DrizzlePaymentMethodRepository(database).findByCode('CASH');
    expect(cash).toMatchObject({ kind: 'CASH', currencyCode: 'USD', isActive: true });
    await expect(new SqliteDiscountPolicyProvider(database).getPolicy())
      .resolves.toMatchObject({ maximumBasisPoints: 1500 });
    const tax = await new SqliteFinancialTransactionTaxPolicyProvider(database).getPolicy();
    expect(tax.rate.basisPoints).toBe(300);
    expect(tax.eligiblePaymentMethodCodes).toEqual(['CARD']);
  });

  it('is repeatable: a second run with the same configuration adds no policy version', async () => {
    const database = setup();

    const first = await bootstrapOperations(database, identity, options);
    const second = await bootstrapOperations(database, identity, options);

    expect(first.discountPolicyCreated).toBe(true);
    expect(second.discountPolicyCreated).toBe(false);
    expect(second.taxPolicyCreated).toBe(false);
    expect(second.discountPolicyVersion).toBe(first.discountPolicyVersion);
    expect(database.sqlite.prepare('select count(*) from operational_policy_versions')
      .pluck().get()).toBe(2);
    expect(database.sqlite.prepare('select count(*) from cash_registers').pluck().get()).toBe(1);
    expect(database.sqlite.prepare('select count(*) from payment_methods').pluck().get()).toBe(2);
  });

  it('rejects a cash register that would not belong to the running terminal', async () => {
    const database = setup();
    await bootstrapOperations(database, identity, options);

    const register = await new DrizzleCashRegisterRepository(database)
      .findById(options.cashRegisterId);

    expect(() => register?.assertOperationalFor('otro-terminal', identity.originNodeId))
      .toThrowError(expect.objectContaining({ code: 'CASH_REGISTER_OWNERSHIP_MISMATCH' }));
  });
});
