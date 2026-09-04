import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { stdout } from 'node:process';
import { CashRegister, PaymentMethod } from '@supermarket/core';
import {
  applyMigrations,
  DrizzleCashRegisterRepository,
  DrizzlePaymentMethodRepository,
  openDatabase,
  SqliteOperationalPolicyWriter,
  SqliteUnitOfWork,
  type DatabaseHandle
} from '@supermarket/driver-db';
import {
  loadNodeIdentity,
  SystemClock,
  UuidV7Generator,
  type NodeIdentity
} from '@supermarket/driver-security';

export type OperationsBootstrapOptions = {
  readonly currencyCode: string;
  readonly discountMaximumBasisPoints: number;
  readonly financialTransactionTaxBasisPoints: number;
  readonly financialTransactionTaxPaymentMethods: readonly string[];
  readonly financialTransactionTaxCurrencies: readonly string[];
  readonly cashRegisterId: string;
  readonly cashRegisterName: string;
};

export type OperationsBootstrapResult = {
  readonly cashRegisterId: string;
  readonly paymentMethodCodes: readonly string[];
  readonly discountPolicyCreated: boolean;
  readonly discountPolicyVersion: number;
  readonly taxPolicyCreated: boolean;
  readonly taxPolicyVersion: number;
};

const DEFAULT_CASH_REGISTER_ID = '0199a0f0-0000-7000-8000-000000005001';
const CREATED_BY = 'bootstrap:operations';
const REASON = 'Configuración operativa inicial de desarrollo';

/**
 * Provisiona la configuración operativa mínima para operar caja y venta en un
 * nodo local: una caja del terminal actual, métodos de pago y las políticas de
 * descuento e IGTF. No inventa valores regulatorios: la tasa, el tope y la
 * elegibilidad se reciben explícitamente.
 */
export const bootstrapOperations = async (
  handle: DatabaseHandle,
  identity: NodeIdentity,
  options: OperationsBootstrapOptions
): Promise<OperationsBootstrapResult> => {
  const currencyCode = options.currencyCode.trim().toUpperCase();
  const cashRegister = CashRegister.create({
    id: options.cashRegisterId,
    name: options.cashRegisterName,
    terminalId: identity.terminalId,
    originNodeId: identity.originNodeId
  });
  const paymentMethods = [
    PaymentMethod.create({ code: 'CASH', name: 'Efectivo', kind: 'CASH', currencyCode }),
    PaymentMethod.create({ code: 'CARD', name: 'Tarjeta', kind: 'CARD', currencyCode })
  ];
  const ids = new UuidV7Generator();
  const now = new SystemClock().now();
  const unitOfWork = new SqliteUnitOfWork(handle.sqlite);
  const policyWriter = new SqliteOperationalPolicyWriter(handle);

  return unitOfWork.execute(async () => {
    await new DrizzleCashRegisterRepository(handle).save(cashRegister);
    const paymentMethodRepository = new DrizzlePaymentMethodRepository(handle);
    for (const method of paymentMethods) await paymentMethodRepository.save(method);
    const discount = policyWriter.activateDiscountPolicy(
      { maximumBasisPoints: options.discountMaximumBasisPoints },
      { policyId: ids.generate(), createdBy: CREATED_BY, reason: REASON, now }
    );
    const tax = policyWriter.activateFinancialTransactionTaxPolicy(
      {
        rateBasisPoints: options.financialTransactionTaxBasisPoints,
        eligiblePaymentMethodCodes: options.financialTransactionTaxPaymentMethods,
        eligibleCurrencies: options.financialTransactionTaxCurrencies
      },
      { policyId: ids.generate(), createdBy: CREATED_BY, reason: REASON, now }
    );
    return {
      cashRegisterId: cashRegister.id,
      paymentMethodCodes: paymentMethods.map((method) => method.code),
      discountPolicyCreated: discount.created,
      discountPolicyVersion: discount.version,
      taxPolicyCreated: tax.created,
      taxPolicyVersion: tax.version
    };
  });
};

type CliOptions = OperationsBootstrapOptions & { readonly databasePath: string };

const readOption = (args: readonly string[], name: string): string | undefined => {
  const index = args.indexOf(name);
  const value = index === -1 ? undefined : args[index + 1];
  return !value || value.startsWith('--') ? undefined : value;
};

const readRequiredOption = (args: readonly string[], name: string): string => {
  const value = readOption(args, name);
  if (value === undefined) throw new Error(`Falta la opción requerida ${name}.`);
  return value;
};

const readBasisPoints = (args: readonly string[], name: string): number => {
  const value = Number(readRequiredOption(args, name));
  if (!Number.isSafeInteger(value) || value < 0 || value > 10_000) {
    throw new Error(`${name} debe ser un entero entre 0 y 10000 puntos base.`);
  }
  return value;
};

const readCodes = (args: readonly string[], name: string): readonly string[] =>
  (readOption(args, name) ?? '').split(',')
    .map((code) => code.trim().toUpperCase())
    .filter((code) => code.length > 0);

const parseCliOptions = (args: readonly string[]): CliOptions => {
  const databasePath = readRequiredOption(args, '--database').trim();
  if (databasePath === ':memory:') {
    throw new Error('El comando requiere una base persistente; :memory: no está permitido.');
  }
  const financialTransactionTaxBasisPoints = readBasisPoints(args, '--igtf-basis-points');
  const financialTransactionTaxPaymentMethods = readCodes(args, '--igtf-payment-methods');
  const financialTransactionTaxCurrencies = readCodes(args, '--igtf-currencies');
  if (
    financialTransactionTaxBasisPoints > 0 &&
    (financialTransactionTaxPaymentMethods.length === 0 ||
      financialTransactionTaxCurrencies.length === 0)
  ) {
    throw new Error(
      'Una tasa de IGTF mayor que cero exige --igtf-payment-methods y --igtf-currencies; ' +
      'sin ambas listas la tasa nunca se aplicaría.'
    );
  }
  return {
    databasePath,
    currencyCode: readRequiredOption(args, '--currency').trim().toUpperCase(),
    discountMaximumBasisPoints: readBasisPoints(args, '--discount-max-basis-points'),
    financialTransactionTaxBasisPoints,
    financialTransactionTaxPaymentMethods,
    financialTransactionTaxCurrencies,
    cashRegisterId: readOption(args, '--cash-register-id')?.trim() ?? DEFAULT_CASH_REGISTER_ID,
    cashRegisterName: readOption(args, '--cash-register-name')?.trim() ?? 'Caja 1'
  };
};

const describePolicy = (created: boolean, version: number): string =>
  created ? `versión ${version} activada` : `versión ${version} ya activa, sin cambios`;

export const runBootstrapOperationsCli = async (args: readonly string[]): Promise<void> => {
  let handle: DatabaseHandle | undefined;
  try {
    const options = parseCliOptions(args);
    const identity = loadNodeIdentity(process.env.NODE_IDENTITY_PATH);
    handle = openDatabase(resolve(options.databasePath));
    applyMigrations(handle.sqlite);
    const result = await bootstrapOperations(handle, identity, options);
    stdout.write(
      'Configuración operativa lista.\n' +
      `  Caja: ${result.cashRegisterId} (${options.cashRegisterName})\n` +
      `  Terminal: ${identity.terminalId}\n` +
      `  Nodo: ${identity.originNodeId}\n` +
      `  Métodos de pago: ${result.paymentMethodCodes.join(', ')} en ${options.currencyCode}\n` +
      `  Descuento máximo: ${options.discountMaximumBasisPoints} pb ` +
      `(${describePolicy(result.discountPolicyCreated, result.discountPolicyVersion)})\n` +
      `  IGTF: ${options.financialTransactionTaxBasisPoints} pb ` +
      `(${describePolicy(result.taxPolicyCreated, result.taxPolicyVersion)})\n` +
      `  IGTF aplica a: ${options.financialTransactionTaxPaymentMethods.join(', ') || 'ningún método'} ` +
      `en ${options.financialTransactionTaxCurrencies.join(', ') || 'ninguna moneda'}\n`
    );
  } catch (error) {
    stdout.write(
      'No se pudo preparar la configuración operativa: ' +
      `${error instanceof Error ? error.message : 'error desconocido'}\n` +
      'Uso: pnpm --filter @supermarket/server bootstrap-operations:dev -- --database <ruta> ' +
      '--currency <ABC> --discount-max-basis-points <entero> --igtf-basis-points <entero> ' +
      '[--igtf-payment-methods <CSV>] [--igtf-currencies <CSV>] ' +
      '[--cash-register-id <texto>] [--cash-register-name <texto>]\n'
    );
    process.exitCode = 1;
  } finally {
    handle?.close();
  }
};

const isMainModule = process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) await runBootstrapOperationsCli(process.argv.slice(2));
