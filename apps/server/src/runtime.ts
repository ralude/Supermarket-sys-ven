import {
  application,
  AuthenticateOperator,
  ProvisionInitialAdmin,
  RevokeSession,
  VerifySession
} from '@supermarket/core';
import {
  applyMigrations,
  DrizzleAuditWriter,
  DrizzleBusinessEventStore,
  DrizzleCashRegisterRepository,
  DrizzleCategoryRepository,
  DrizzleExchangeRateRepository,
  DrizzleFiscalDayRepository,
  DrizzleFiscalDocumentRepository,
  DrizzleIdempotencyStore,
  DrizzleOutboxStore,
  DrizzlePaymentMethodRepository,
  DrizzleProductRepository,
  DrizzleCatalogReadRepository,
  DrizzleAuditReportRepository,
  DrizzleCashClosureReportRepository,
  DrizzleFiscalOperationsReportRepository,
  DrizzleProductSnapshotProvider,
  DrizzleSaleRepository,
  DrizzleShiftRepository,
  DrizzleStockItemRepository,
  DrizzleUnitOfMeasureRepository,
  openDatabase,
  SqliteAuthenticationStore,
  SqliteAuthorizationService,
  SqliteDiscountPolicyProvider,
  SqliteFinancialTransactionTaxPolicyProvider,
  SqliteUnitOfWork,
  type DatabaseHandle
} from '@supermarket/driver-db';
import { FiscalPrinterFake } from '@supermarket/driver-fiscal';
import { HttpExchangeRateProvider, UnavailableExchangeRateProvider } from '@supermarket/driver-exchange-rate';
import {
  CryptoSessionTokenService,
  ScryptPinHasher,
  SystemClock,
  UuidV7Generator,
  type NodeIdentity
} from '@supermarket/driver-security';
import type { ServerDependencies } from './app.ts';

export const ADMIN_PERMISSIONS = Object.freeze([
  ...Object.values(application.SALE_PERMISSIONS),
  ...Object.values(application.CASH_PERMISSIONS),
  ...Object.values(application.INVENTORY_PERMISSIONS),
  ...Object.values(application.FISCAL_PERMISSIONS),
  ...Object.values(application.CATALOG_PERMISSIONS),
  ...Object.values(application.CURRENCY_PERMISSIONS),
  ...Object.values(application.REPORT_PERMISSIONS)
]) as readonly string[];

export type SecurityRuntime = {
  readonly handle: DatabaseHandle;
  readonly dependencies: ServerDependencies;
  readonly provisionInitialAdmin: ProvisionInitialAdmin;
  readonly fiscalPrinter: FiscalPrinterFake;
};

export const createSecurityRuntime = (
  databasePath: string,
  nodeIdentity: NodeIdentity,
  fiscalConfiguration: {
    readonly executionTarget?: string;
    readonly reportConsent?: string;
  } = {}
): SecurityRuntime => {
  const handle = openDatabase(databasePath);
  applyMigrations(handle.sqlite);
  const store = new SqliteAuthenticationStore(handle);
  const pinHasher = new ScryptPinHasher();
  const tokens = new CryptoSessionTokenService();
  const clock = new SystemClock();
  const ids = new UuidV7Generator();
  const simulatedReportsEnabled = fiscalConfiguration.executionTarget === 'SIMULATOR'
    && fiscalConfiguration.reportConsent === 'ALLOW_SIMULATED_X_AND_Z';
  const unitOfWork = new SqliteUnitOfWork(handle.sqlite);
  const fiscalDayRepository = new DrizzleFiscalDayRepository(handle);
  const authorization = new SqliteAuthorizationService(store);
  const eventStore = new DrizzleBusinessEventStore(handle);
  const outboxStore = new DrizzleOutboxStore(handle);
  const auditWriter = new DrizzleAuditWriter(handle);
  const idempotencyStore = new DrizzleIdempotencyStore(handle);
  const productRepository = new DrizzleProductRepository(handle);
  const catalogReadRepository = new DrizzleCatalogReadRepository(handle);
  const categoryRepository = new DrizzleCategoryRepository(handle);
  const unitRepository = new DrizzleUnitOfMeasureRepository(handle);
  const exchangeRateRepository = new DrizzleExchangeRateRepository(handle);
  const exchangeRateProvider = process.env.EXCHANGE_RATE_PROVIDER_URL
    ? new HttpExchangeRateProvider({
      endpoint: process.env.EXCHANGE_RATE_PROVIDER_URL,
      source: process.env.EXCHANGE_RATE_PROVIDER_SOURCE ?? 'Proveedor externo configurado',
      timeoutMs: Number(process.env.EXCHANGE_RATE_PROVIDER_TIMEOUT_MS) || 5000
    })
    : new UnavailableExchangeRateProvider();
  const saleRepository = new DrizzleSaleRepository(handle);
  const shiftRepository = new DrizzleShiftRepository(handle);
  const productSnapshotProvider = new DrizzleProductSnapshotProvider(handle);
  const paymentMethodRepository = new DrizzlePaymentMethodRepository(handle);
  const discountPolicyProvider = new SqliteDiscountPolicyProvider(handle);
  const taxPolicyProvider = new SqliteFinancialTransactionTaxPolicyProvider(handle);
  const stockItemRepository = new DrizzleStockItemRepository(handle);
  const fiscalPrinter = new FiscalPrinterFake();
  const fiscalDocumentRepository = new DrizzleFiscalDocumentRepository(handle);
  const fiscalArguments = [
    fiscalDayRepository,
    fiscalPrinter,
    authorization,
    ids,
    ids,
    ids,
    clock,
    unitOfWork,
    eventStore,
    outboxStore,
    auditWriter
  ] as const;
  return {
    handle,
    fiscalPrinter,
    dependencies: {
      authenticateOperator: new AuthenticateOperator(store, pinHasher, tokens, clock),
      verifySession: new VerifySession(store, tokens, clock),
      revokeSession: new RevokeSession(store, tokens, clock),
      nodeIdentity,
      simulatedReportsEnabled,
      catalog: {
        createProduct: new application.CreateProduct(
          ids, productRepository, categoryRepository, unitRepository, clock,
          authorization, unitOfWork, eventStore, outboxStore, idempotencyStore, auditWriter
        ),
        updateProduct: new application.UpdateProduct(
          productRepository, categoryRepository, unitRepository, ids, clock,
          authorization, unitOfWork, idempotencyStore, auditWriter
        ),
        updatePrice: new application.UpdatePrice(
          productRepository, ids, ids, clock, authorization, unitOfWork,
          eventStore, outboxStore, idempotencyStore, auditWriter
        ),
        findProductByBarcode: new application.FindProductByBarcode(productRepository)
      },
      catalogReads: {
        listProducts: new application.ListProducts(catalogReadRepository),
        getPriceHistory: new application.GetPriceHistory(catalogReadRepository)
      },
      currency: {
        updateExchangeRate: new application.UpdateExchangeRate(
          ids, exchangeRateRepository, authorization, clock,
          unitOfWork, idempotencyStore, auditWriter
        ),
        getCurrentExchangeRate: new application.GetCurrentExchangeRate(clock, exchangeRateRepository),
        getExchangeRateHistory: new application.GetExchangeRateHistory(exchangeRateRepository),
        getSuggestedExchangeRate: new application.GetSuggestedExchangeRate(exchangeRateProvider),
        calculateMixedPaymentTotals: new application.CalculateMixedPaymentTotals(
          clock, exchangeRateRepository
        )
      },
      sales: {
        startSale: new application.StartSale(
          ids, ids, saleRepository, clock, shiftRepository,
          unitOfWork, eventStore, idempotencyStore
        ),
        getSale: new application.GetSale(saleRepository),
        addItemToSale: new application.AddItemToSale(
          saleRepository, productSnapshotProvider, ids, ids, clock,
          unitOfWork, eventStore, idempotencyStore
        ),
        removeItemFromSale: new application.RemoveItemFromSale(
          saleRepository, ids, clock, unitOfWork, eventStore, idempotencyStore
        ),
        applyDiscountToSale: new application.ApplyDiscountToSale(
          saleRepository, ids, ids, clock, discountPolicyProvider, authorization,
          unitOfWork, eventStore, auditWriter, idempotencyStore
        ),
        registerMixedPayment: new application.RegisterMixedPayment(
          saleRepository, paymentMethodRepository, exchangeRateRepository,
          taxPolicyProvider, ids, ids, clock, unitOfWork, eventStore, idempotencyStore
        ),
        completeSale: new application.CompleteSale(
          saleRepository, ids, clock, unitOfWork, eventStore, outboxStore, idempotencyStore
        ),
        voidSale: new application.VoidSale(
          saleRepository, authorization, ids, clock, unitOfWork,
          eventStore, auditWriter, idempotencyStore
        )
      },
      cash: {
        openShift: new application.OpenShift(
          new DrizzleCashRegisterRepository(handle), shiftRepository,
          paymentMethodRepository, authorization, ids, ids, ids, clock,
          unitOfWork, eventStore, outboxStore, auditWriter, ids, idempotencyStore
        ),
        getOpenShift: new application.GetOpenShift(shiftRepository),
        registerCashMovement: new application.RegisterCashMovement(
          shiftRepository, paymentMethodRepository, authorization, ids, ids, clock,
          unitOfWork, eventStore, outboxStore, auditWriter, ids, idempotencyStore
        ),
        closeShift: new application.CloseShift(
          shiftRepository, paymentMethodRepository, authorization, ids, clock,
          unitOfWork, eventStore, outboxStore, auditWriter, ids, idempotencyStore
        )
      },
      inventory: {
        receivePurchase: new application.ReceivePurchase(
          stockItemRepository, authorization, ids, ids, ids, ids, clock,
          unitOfWork, eventStore, auditWriter, idempotencyStore
        ),
        registerStockAdjustment: new application.RegisterStockAdjustment(
          stockItemRepository, authorization, ids, ids, ids, clock,
          unitOfWork, eventStore, auditWriter, idempotencyStore
        ),
        getKardex: new application.GetKardex(stockItemRepository)
      },
      fiscalDocuments: {
        issue: new application.IssueFiscalDocument(
          fiscalDocumentRepository, fiscalPrinter, authorization, ids, ids, ids,
          clock, unitOfWork, eventStore, outboxStore, auditWriter
        ),
        get: new application.GetFiscalDocument(fiscalDocumentRepository),
        reconcile: new application.ReconcileFiscalState(
          fiscalDocumentRepository, fiscalPrinter, authorization, ids, ids,
          clock, unitOfWork, eventStore, outboxStore, auditWriter
        )
      },
      reports: {
        getCashClosureReport: new application.GetCashClosureReport(
          new DrizzleCashClosureReportRepository(handle), authorization
        ),
        getAuditReport: new application.GetAuditReport(
          new DrizzleAuditReportRepository(handle), authorization
        ),
        getFiscalOperationsReport: new application.GetFiscalOperationsReport(
          new DrizzleFiscalOperationsReportRepository(handle), authorization
        )
      },
      ...(simulatedReportsEnabled ? {
        fiscalReports: {
          printX: new application.PrintXReport(...fiscalArguments),
          printZ: new application.PrintZReport(...fiscalArguments)
        }
      } : {}),
      close: () => handle.close()
    },
    provisionInitialAdmin: new ProvisionInitialAdmin(store, pinHasher, ids, clock)
  };
};
