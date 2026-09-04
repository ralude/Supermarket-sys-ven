import {
  addSaleItemContract,
  applySaleDiscountContract,
  capabilitiesContract,
  closeShiftContract,
  completeSaleContract,
  currentSessionContract,
  findProductByBarcodeContract,
  getAuditReportContract,
  getCashClosureReportContract,
  getCurrentExchangeRateContract,
  getExchangeRateHistoryContract,
  getFiscalOperationsReportContract,
  getKardexContract,
  getOpenShiftContract,
  getSaleContract,
  getSuggestedExchangeRateContract,
  openShiftContract,
  printSimulatedXReportContract,
  printSimulatedZReportContract,
  receivePurchaseContract,
  registerCashMovementContract,
  registerSalePaymentsContract,
  registerStockAdjustmentContract,
  removeSaleItemContract,
  listCashRegistersContract,
  listCategoriesContract,
  listPaymentMethodsContract,
  listUnitsOfMeasureContract,
  loginContract,
  listProductsContract,
  listSuppliersContract,
  createSupplierContract,
  updateSupplierContract,
  changeSupplierStatusContract,
  correctSupplierTaxIdentityContract,
  logoutContract,
  startSaleContract,
  createProductContract,
  updateExchangeRateContract,
  updatePriceContract,
  getPriceHistoryContract,
  voidSaleContract,
  type CapabilitiesResponse,
  type CloseShiftRequest,
  type ExchangeRateResponse,
  type ExchangeRateSuggestionResponse,
  type OpenShiftRequest,
  type RegisterCashMovementRequest,
  type RegisterSalePaymentsRequest,
  type RegisterStockAdjustmentRequest,
  type ReceivePurchaseRequest,
  type CreateProductRequest,
  type SaleResponse,
  type ShiftResponse,
  type KardexDto,
  type AuditReportResponse,
  type CashClosureReportResponse,
  type FiscalOperationsReportResponse,
  type ProductResponse,
  type PriceHistoryResponse,
  type StartSaleRequest,
  type AddSaleItemRequest,
  type ApplySaleDiscountRequest,
  type UpdateExchangeRateRequest,
  type VoidSaleRequest,
  type SimulatedFiscalReportRequest,
  type SimulatedFiscalReportResponse,
  type LoginRequest,
  type ProblemDetails,
  type SessionResponse,
  type SupplierResponse,
  type SupplierStatusResponse,
  type CreateSupplierRequest,
  type UpdateSupplierRequest,
  type ChangeSupplierStatusRequest,
  type CorrectSupplierTaxIdentityRequest,
  type CashRegisterResponse,
  type CategoryResponse,
  type PaymentMethodResponse,
  type UnitOfMeasureResponse
} from '@supermarket/shared';

export class ApiProblemError extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.title);
    this.name = 'ApiProblemError';
  }
}

const requestJson = async <T>(
  fetcher: typeof fetch,
  path: string,
  init: RequestInit
): Promise<T> => {
  const response = await fetcher(path, {
    ...init,
    credentials: 'include',
    headers: {
      accept: 'application/json',
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(init.headers ?? {})
    }
  });
  if (response.status === 204) return undefined as T;

  const body = await response.json() as T | ProblemDetails;
  if (!response.ok) throw new ApiProblemError(body as ProblemDetails);
  return body as T;
};

const withIdempotency = (key: string): HeadersInit => ({ 'idempotency-key': key });

export const createIdempotencyKey = (): string => {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  return cryptoApi?.randomUUID?.() ?? `ui-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const parseMinorUnits = (value: string, scale: number): number => {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) throw new Error('MONEY_INPUT_INVALID');
  const [whole, fraction = ''] = normalized.split('.');
  if (fraction.length > scale) throw new Error('MONEY_INPUT_SCALE');
  const padded = fraction.padEnd(scale, '0');
  const result = Number(`${whole}${padded}`);
  if (!Number.isSafeInteger(result)) throw new Error('MONEY_INPUT_INVALID');
  return result;
};

export type ReportQuery = {
  readonly from?: string; readonly to?: string; readonly limit?: number;
  readonly cashRegisterId?: string; readonly actorId?: string;
  readonly action?: string; readonly entityType?: string;
};

export type ExchangeRateHistoryQuery = {
  readonly baseCurrency: string; readonly quoteCurrency: string; readonly limit?: number;
};

export type ExchangeRatePairQuery = { readonly baseCurrency: string; readonly quoteCurrency: string };

const search = (query: Readonly<Record<string, string | number | undefined>>): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? '?' + serialized : '';
};

/**
 * Convierte un texto decimal a un entero escalado sin `float`, infiriendo la
 * escala de los dígitos escritos. No admite más de 8 decimales: el dominio de
 * `ExchangeRate` rechaza una escala mayor.
 */
export const parseScaledDecimal = (value: string): { readonly value: number; readonly scale: number } => {
  const normalized = value.trim().replace(',', '.');
  const match = /^(\d+)(?:\.(\d{1,8}))?$/.exec(normalized);
  if (!match) throw new Error('RATE_INPUT_INVALID');
  const fraction = match[2] ?? '';
  const parsed = Number(`${match[1]}${fraction}`);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error('RATE_INPUT_INVALID');
  return { value: parsed, scale: fraction.length };
};

/** Formatea un entero escalado como texto decimal sin perder precisión. */
export const formatScaledDecimal = (value: number, scale: number): string =>
  (value / (10 ** scale)).toFixed(scale);

const path = (template: string, ...parts: string[]): string =>
  parts.reduce((value, part) => value.replace(/:[A-Za-z]+/, encodeURIComponent(part)), template);

export const createDesktopApi = (fetcher: typeof fetch = globalThis.fetch) => ({
  currentSession: (): Promise<SessionResponse> => requestJson(
    fetcher, currentSessionContract.path, { method: currentSessionContract.method }
  ),
  login: (input: LoginRequest): Promise<SessionResponse> => requestJson(
    fetcher,
    loginContract.path,
    { method: loginContract.method, body: JSON.stringify(input) }
  ),
  logout: (): Promise<void> => requestJson(
    fetcher, logoutContract.path, { method: logoutContract.method }
  ),
  capabilities: (): Promise<CapabilitiesResponse> => requestJson(
    fetcher, capabilitiesContract.path, { method: capabilitiesContract.method }
  ),
  getSale: (saleId: string): Promise<SaleResponse> => requestJson(
    fetcher, path(getSaleContract.path, saleId), { method: getSaleContract.method }
  ),
  startSale: (input: StartSaleRequest, idempotencyKey: string): Promise<SaleResponse> => requestJson(
    fetcher, startSaleContract.path,
    { method: startSaleContract.method, headers: withIdempotency(idempotencyKey), body: JSON.stringify(input) }
  ),
  addSaleItem: (saleId: string, input: AddSaleItemRequest, idempotencyKey: string): Promise<SaleResponse> => requestJson(
    fetcher, path(addSaleItemContract.path, saleId),
    { method: addSaleItemContract.method, headers: withIdempotency(idempotencyKey), body: JSON.stringify(input) }
  ),
  removeSaleItem: (saleId: string, itemId: string, idempotencyKey: string): Promise<SaleResponse> => requestJson(
    fetcher, path(removeSaleItemContract.path, saleId, itemId),
    { method: removeSaleItemContract.method, headers: withIdempotency(idempotencyKey) }
  ),
  applySaleDiscount: (saleId: string, input: ApplySaleDiscountRequest, idempotencyKey: string): Promise<SaleResponse> => requestJson(
    fetcher, path(applySaleDiscountContract.path, saleId),
    { method: applySaleDiscountContract.method, headers: withIdempotency(idempotencyKey), body: JSON.stringify(input) }
  ),
  registerSalePayments: (saleId: string, input: RegisterSalePaymentsRequest, idempotencyKey: string): Promise<SaleResponse> => requestJson(
    fetcher, path(registerSalePaymentsContract.path, saleId),
    { method: registerSalePaymentsContract.method, headers: withIdempotency(idempotencyKey), body: JSON.stringify(input) }
  ),
  completeSale: (saleId: string, idempotencyKey: string): Promise<SaleResponse> => requestJson(
    fetcher, path(completeSaleContract.path, saleId),
    { method: completeSaleContract.method, headers: withIdempotency(idempotencyKey) }
  ),
  voidSale: (saleId: string, input: VoidSaleRequest, idempotencyKey: string): Promise<SaleResponse> => requestJson(
    fetcher, path(voidSaleContract.path, saleId),
    { method: voidSaleContract.method, headers: withIdempotency(idempotencyKey), body: JSON.stringify(input) }
  ),
  getOpenShift: (cashRegisterId: string): Promise<ShiftResponse> => requestJson(
    fetcher, path(getOpenShiftContract.path, cashRegisterId), { method: getOpenShiftContract.method }
  ),
  openShift: (input: OpenShiftRequest, idempotencyKey: string): Promise<ShiftResponse> => requestJson(
    fetcher, openShiftContract.path,
    { method: openShiftContract.method, headers: withIdempotency(idempotencyKey), body: JSON.stringify(input) }
  ),
  registerCashMovement: (shiftId: string, input: RegisterCashMovementRequest, idempotencyKey: string): Promise<ShiftResponse> => requestJson(
    fetcher, path(registerCashMovementContract.path, shiftId),
    { method: registerCashMovementContract.method, headers: withIdempotency(idempotencyKey), body: JSON.stringify(input) }
  ),
  closeShift: (shiftId: string, input: CloseShiftRequest, idempotencyKey: string): Promise<ShiftResponse> => requestJson(
    fetcher, path(closeShiftContract.path, shiftId),
    { method: closeShiftContract.method, headers: withIdempotency(idempotencyKey), body: JSON.stringify(input) }
  ),
  findProductByBarcode: (barcode: string): Promise<{ product: ProductResponse; snapshot: ProductResponse['snapshot'] }> => requestJson(
    fetcher, path(findProductByBarcodeContract.path, barcode), { method: findProductByBarcodeContract.method }
  ),
  updatePrice: (productId: string, input: { priceMinorUnits: number; currencyCode: string; reason: string }, idempotencyKey: string): Promise<ProductResponse> => requestJson(
    fetcher, path(updatePriceContract.path, productId),
    { method: updatePriceContract.method, headers: withIdempotency(idempotencyKey), body: JSON.stringify(input) }
  ),
  listProducts: (query = ''): Promise<readonly ProductResponse[]> => requestJson(
    fetcher, listProductsContract.path + (query ? '?query=' + encodeURIComponent(query) : ''),
    { method: listProductsContract.method }
  ),
  listSuppliers: (status?: SupplierStatusResponse): Promise<readonly SupplierResponse[]> => requestJson(
    fetcher, listSuppliersContract.path + search({ status }),
    { method: listSuppliersContract.method }
  ),
  createSupplier: (input: CreateSupplierRequest, idempotencyKey: string): Promise<SupplierResponse> => requestJson(
    fetcher, createSupplierContract.path,
    { method: createSupplierContract.method, headers: withIdempotency(idempotencyKey), body: JSON.stringify(input) }
  ),
  updateSupplier: (supplierId: string, input: UpdateSupplierRequest, idempotencyKey: string): Promise<SupplierResponse> => requestJson(
    fetcher, path(updateSupplierContract.path, supplierId),
    { method: updateSupplierContract.method, headers: withIdempotency(idempotencyKey), body: JSON.stringify(input) }
  ),
  changeSupplierStatus: (supplierId: string, input: ChangeSupplierStatusRequest, idempotencyKey: string): Promise<SupplierResponse> => requestJson(
    fetcher, path(changeSupplierStatusContract.path, supplierId),
    { method: changeSupplierStatusContract.method, headers: withIdempotency(idempotencyKey), body: JSON.stringify(input) }
  ),
  correctSupplierTaxIdentity: (supplierId: string, input: CorrectSupplierTaxIdentityRequest, idempotencyKey: string): Promise<SupplierResponse> => requestJson(
    fetcher, path(correctSupplierTaxIdentityContract.path, supplierId),
    { method: correctSupplierTaxIdentityContract.method, headers: withIdempotency(idempotencyKey), body: JSON.stringify(input) }
  ),
  getPriceHistory: (productId: string): Promise<readonly PriceHistoryResponse[]> => requestJson(
    fetcher, path(getPriceHistoryContract.path, productId), { method: getPriceHistoryContract.method }
  ),
  createProduct: (input: CreateProductRequest, idempotencyKey: string): Promise<ProductResponse> => requestJson(
    fetcher, createProductContract.path,
    { method: createProductContract.method, headers: withIdempotency(idempotencyKey), body: JSON.stringify(input) }
  ),
  getKardex: (productId: string): Promise<KardexDto> => requestJson(
    fetcher, path(getKardexContract.path, productId), { method: getKardexContract.method }
  ),
  receivePurchase: (input: ReceivePurchaseRequest, idempotencyKey: string): Promise<KardexDto> => requestJson(
    fetcher, receivePurchaseContract.path,
    { method: receivePurchaseContract.method, headers: withIdempotency(idempotencyKey), body: JSON.stringify(input) }
  ),
  registerStockAdjustment: (stockItemId: string, input: RegisterStockAdjustmentRequest, idempotencyKey: string): Promise<KardexDto> => requestJson(
    fetcher, path(registerStockAdjustmentContract.path, stockItemId),
    { method: registerStockAdjustmentContract.method, headers: withIdempotency(idempotencyKey), body: JSON.stringify(input) }
  ),
  getCashClosureReport: (query: ReportQuery = {}): Promise<readonly CashClosureReportResponse[]> => requestJson(
    fetcher, getCashClosureReportContract.path + search(query),
    { method: getCashClosureReportContract.method }
  ),
  getAuditReport: (query: ReportQuery = {}): Promise<readonly AuditReportResponse[]> => requestJson(
    fetcher, getAuditReportContract.path + search(query),
    { method: getAuditReportContract.method }
  ),
  getFiscalOperationsReport: (query: ReportQuery = {}): Promise<FiscalOperationsReportResponse> => requestJson(
    fetcher, getFiscalOperationsReportContract.path + search(query),
    { method: getFiscalOperationsReportContract.method }
  ),
  getCurrentExchangeRate: (query: ExchangeRatePairQuery): Promise<ExchangeRateResponse> => requestJson(
    fetcher, getCurrentExchangeRateContract.path + search(query),
    { method: getCurrentExchangeRateContract.method }
  ),
  getExchangeRateHistory: (query: ExchangeRateHistoryQuery): Promise<readonly ExchangeRateResponse[]> => requestJson(
    fetcher, getExchangeRateHistoryContract.path + search(query),
    { method: getExchangeRateHistoryContract.method }
  ),
  getSuggestedExchangeRate: (query: ExchangeRatePairQuery): Promise<{ suggestion: ExchangeRateSuggestionResponse }> => requestJson(
    fetcher, getSuggestedExchangeRateContract.path + search(query),
    { method: getSuggestedExchangeRateContract.method }
  ),
  updateExchangeRate: (input: UpdateExchangeRateRequest, idempotencyKey: string): Promise<ExchangeRateResponse> => requestJson(
    fetcher, updateExchangeRateContract.path,
    { method: updateExchangeRateContract.method, headers: withIdempotency(idempotencyKey), body: JSON.stringify(input) }
  ),
  printXReport: (input: SimulatedFiscalReportRequest, idempotencyKey: string): Promise<SimulatedFiscalReportResponse> => requestJson(
    fetcher, printSimulatedXReportContract.path,
    { method: printSimulatedXReportContract.method, headers: withIdempotency(idempotencyKey), body: JSON.stringify(input) }
  ),
  printZReport: (input: SimulatedFiscalReportRequest, idempotencyKey: string): Promise<SimulatedFiscalReportResponse> => requestJson(
    fetcher, printSimulatedZReportContract.path,
    { method: printSimulatedZReportContract.method, headers: withIdempotency(idempotencyKey), body: JSON.stringify(input) }
  ),
  listCategories: (): Promise<readonly CategoryResponse[]> => requestJson(
    fetcher, listCategoriesContract.path, { method: listCategoriesContract.method }
  ),
  listUnitsOfMeasure: (): Promise<readonly UnitOfMeasureResponse[]> => requestJson(
    fetcher, listUnitsOfMeasureContract.path, { method: listUnitsOfMeasureContract.method }
  ),
  listPaymentMethods: (): Promise<readonly PaymentMethodResponse[]> => requestJson(
    fetcher, listPaymentMethodsContract.path, { method: listPaymentMethodsContract.method }
  ),
  listCashRegisters: (): Promise<readonly CashRegisterResponse[]> => requestJson(
    fetcher, listCashRegistersContract.path, { method: listCashRegistersContract.method }
  )
});

type FullDesktopApi = ReturnType<typeof createDesktopApi>;
export type DesktopApi = Pick<FullDesktopApi, 'currentSession' | 'login' | 'logout' | 'capabilities'> &
  Partial<Omit<FullDesktopApi, 'currentSession' | 'login' | 'logout' | 'capabilities'>>;
export type OperationApi = Required<Omit<DesktopApi, 'currentSession' | 'login' | 'logout' | 'capabilities'>>;
