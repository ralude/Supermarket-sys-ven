import { useCallback, useEffect, useState } from 'react';
import type {
  AuditReportResponse,
  CapabilitiesResponse,
  CashClosureReportResponse,
  ExchangeRateResponse,
  ExchangeRateSuggestionResponse,
  FiscalOperationsReportResponse,
  KardexDto,
  ProductResponse,
  RegisterCashMovementRequest,
  SaleResponse,
  ShiftResponse
} from '@supermarket/shared';
import {
  ApiProblemError, createIdempotencyKey, formatScaledDecimal, parseMinorUnits, parseScaledDecimal,
  type OperationApi, type ReportQuery
} from './api-client.js';

type ScreenProps = { readonly api: OperationApi; readonly capabilities: CapabilitiesResponse };
const ACTIVE_SALE_KEY = 'supermarket.active-sale.v1';
const ACTIVE_SHIFT_KEY = 'supermarket.active-shift.v1';
const ACTIVE_CASH_REGISTER_KEY = 'supermarket.active-cash-register.v1';

const readStorage = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
};
const writeStorage = (key: string, value: string): void => {
  try { window.localStorage.setItem(key, value); } catch { /* optional */ }
};
const clearStorage = (key: string): void => {
  try { window.localStorage.removeItem(key); } catch { /* optional */ }
};

const problemMessage = (error: unknown): string => {
  if (error instanceof ApiProblemError) {
    const labels: Record<string, string> = {
      SALE_NOT_FOUND: 'La venta ya no está disponible.',
      SALE_PAYMENT_TOTAL_MISMATCH: 'El pago no coincide con el total de la venta.',
      SALE_INVALID_STATE: 'La venta no puede modificarse en este estado.',
      PAYMENT_METHOD_NOT_FOUND: 'El método de pago no está habilitado.',
      PRODUCT_NOT_FOUND: 'No encontramos ese producto.',
      FORBIDDEN: 'No tienes autorización para esta operación.',
      SHIFT_NOT_FOUND: 'No hay un turno abierto para esta caja.',
      SHIFT_ALREADY_OPEN: 'La caja ya tiene un turno abierto.',
      SHIFT_INVALID_STATE: 'El turno no puede modificarse en este estado.',
      STOCK_ITEM_NOT_FOUND: 'No encontramos el artículo de inventario.',
      STOCK_INSUFFICIENT_BALANCE: 'La existencia no alcanza para este ajuste.',
      FISCAL_REPORT_FAILED: 'El reporte fiscal simulado falló; revisa su estado.',
      NETWORK_UNAVAILABLE: 'No hay conexión con el nodo local.',
      CURRENCY_HISTORY_LIMIT_INVALID: 'El límite de filas del histórico no es válido.',
      CURRENCY_RATE_MISSING: 'No hay una tasa vigente registrada para ese par.',
      EXCHANGE_RATE_INVALID_PAIR: 'La moneda base y la cotizada deben ser distintas.',
      EXCHANGE_RATE_INVALID_CURRENCY: 'El código de moneda debe tener tres letras mayúsculas.',
      EXCHANGE_RATE_INVALID_VALUE: 'El valor de la tasa no es un entero positivo válido.',
      EXCHANGE_RATE_INVALID_SCALE: 'La escala de la tasa debe estar entre 0 y 8.',
      EXCHANGE_RATE_SOURCE_REQUIRED: 'La fuente de la tasa es obligatoria.',
      EXCHANGE_RATE_INVALID_VALIDITY: 'La vigencia hasta debe ser posterior a la vigencia desde.'
    };
    return (labels[error.problem.code] ?? 'La operación no pudo completarse.')
      + ' (correlación ' + error.problem.correlationId + ')';
  }
  if (error instanceof Error && error.message === 'MONEY_INPUT_SCALE') {
    return 'La cantidad de decimales supera la escala configurada.';
  }
  if (error instanceof Error && error.message === 'SHIFT_REQUIRED') {
    return 'Abre o selecciona un turno desde Caja antes de iniciar la venta.';
  }
  if (error instanceof Error && error.message === 'RATE_INPUT_INVALID') {
    return 'Escribe un valor decimal positivo con hasta 8 decimales.';
  }
  return 'No pudimos completar la operación. Intenta nuevamente.';
};

const suggestionErrorLabel = (error: unknown): string => {
  if (error instanceof ApiProblemError) {
    const labels: Record<string, string> = {
      EXCHANGE_RATE_PROVIDER_NOT_CONFIGURED: 'Este nodo no tiene una fuente de sugerencia configurada.',
      NETWORK_UNAVAILABLE: 'El proveedor externo no respondió a tiempo. La tasa local y la carga manual siguen disponibles.',
      EXCHANGE_RATE_PROVIDER_INVALID_RESPONSE: 'El proveedor externo devolvió una respuesta inválida.',
      EXCHANGE_RATE_PAIR_UNSUPPORTED: 'El proveedor externo no soporta este par de monedas.'
    };
    if (labels[error.problem.code]) {
      return labels[error.problem.code] + ' (correlación ' + error.problem.correlationId + ')';
    }
  }
  return problemMessage(error);
};

type FeedbackProps = {
  readonly error: unknown;
  readonly notice: string | null;
  readonly onDismiss?: () => void;
};

/**
 * Confirmación o fallo de la última acción. Se mantiene pegado al inicio del
 * área de trabajo para que el operador lo vea sin desplazarse.
 */
const Feedback = ({ error, notice, onDismiss }: FeedbackProps): React.JSX.Element | null => {
  if (!error && !notice) return null;
  const failed = Boolean(error);
  return (
    <div
      className={failed ? 'feedback form-error' : 'feedback form-success'}
      role={failed ? 'alert' : 'status'}
      aria-live={failed ? 'assertive' : 'polite'}
    >
      <span className="feedback-icon" aria-hidden="true">{failed ? '!' : '✓'}</span>
      <p>{failed ? problemMessage(error) : notice}</p>
      {onDismiss && (
        <button type="button" className="feedback-dismiss" onClick={onDismiss}>
          Descartar
        </button>
      )}
    </div>
  );
};

type ActionButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly busy?: boolean;
};

/** Botón con estado ocupado visible y anunciado mientras la acción viaja al nodo. */
const ActionButton = (
  { busy = false, className, children, ...rest }: ActionButtonProps
): React.JSX.Element => (
  <button
    className={busy ? [className, 'is-busy'].filter(Boolean).join(' ') : className}
    {...rest}
    aria-busy={busy || undefined}
  >
    {children}
  </button>
);

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

/**
 * Formatea unidades menores respetando la escala configurada. Un código que
 * `Intl` no reconoce degrada a texto con sufijo en lugar de romper el render.
 */
export const money = (minorUnits: number, currencyCode: string, scale = 2): string => {
  const amount = minorUnits / (10 ** scale);
  const digits = { minimumFractionDigits: scale, maximumFractionDigits: scale };
  const code = currencyCode.trim().toUpperCase();
  if (CURRENCY_CODE_PATTERN.test(code)) {
    try {
      return new Intl.NumberFormat('es-VE', { style: 'currency', currency: code, ...digits })
        .format(amount);
    } catch { /* código no soportado por Intl: se usa el formato neutro */ }
  }
  return new Intl.NumberFormat('es-VE', digits).format(amount) + ' ' + code;
};
/** Antigüedad local frente al reloj de esta estación; no implica sincronización distribuida (Fase 10). */
export const ageLabel = (iso: string): string => {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'hace instantes';
  if (minutes < 60) return 'hace ' + minutes + ' min';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return 'hace ' + hours + ' h';
  return 'hace ' + Math.floor(hours / 24) + ' d';
};
/** Contexto de la pantalla. El título lo publica la barra superior del shell. */
const ScreenNote = ({ children }: { readonly children: React.ReactNode }): React.JSX.Element => (
  <p className="screen-note">{children}</p>
);
const EmptyState = ({ children }: { readonly children: React.ReactNode }): React.JSX.Element => (
  <div className="empty-state" role="status">{children}</div>
);

export const SalesScreen = ({ api }: ScreenProps): React.JSX.Element => {
  const [sale, setSale] = useState<SaleResponse | null>(null);
  const [shiftId, setShiftId] = useState(() => readStorage(ACTIVE_SHIFT_KEY) ?? '');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [currencyScale, setCurrencyScale] = useState('2');
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [quantityScale, setQuantityScale] = useState('0');
  const [paymentMethodCode, setPaymentMethodCode] = useState('CASH');
  const [paymentCurrency, setPaymentCurrency] = useState('USD');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethodCode2, setPaymentMethodCode2] = useState('');
  const [paymentCurrency2, setPaymentCurrency2] = useState('USD');
  const [paymentAmount2, setPaymentAmount2] = useState('');
  const [discountItemId, setDiscountItemId] = useState('');
  const [discountBasisPoints, setDiscountBasisPoints] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const barcodeInput = useRef<HTMLInputElement>(null);
  const scale = Number(currencyScale) || 2;
  const refresh = useCallback(async (saleId: string): Promise<void> => {
    try {
      const current = await api.getSale(saleId);
      if (current.status === 'DRAFT') setSale(current);
      else { setSale(null); clearStorage(ACTIVE_SALE_KEY); }
    } catch (nextError) {
      setSale(null); clearStorage(ACTIVE_SALE_KEY);
      if (nextError instanceof ApiProblemError && nextError.problem.code !== 'SALE_NOT_FOUND') setError(nextError);
    }
  }, [api]);
  useEffect(() => { const savedId = readStorage(ACTIVE_SALE_KEY); if (savedId) void refresh(savedId); }, [refresh]);
  const outstanding = sale?.status === 'DRAFT' ? sale.balanceMinorUnits : 0;
  /** Precarga el saldo pendiente como importe sugerido cada vez que el nodo lo recalcula. */
  useEffect(() => {
    if (outstanding > 0) setPaymentAmount(formatScaledDecimal(outstanding, scale));
  }, [outstanding, scale]);
  const intentKey = (intent: string): string => {
    const storageKey = 'supermarket.sale-intent.' + intent;
    const saved = readStorage(storageKey);
    if (saved) return saved;
    const next = createIdempotencyKey();
    writeStorage(storageKey, next);
    return next;
  };
  const dismissFeedback = (): void => { setError(null); setNotice(null); };
  /** Devuelve la venta actualizada, o `null` si la accion fallo: quien llama decide que limpiar. */
  const run = async (action: () => Promise<SaleResponse>, success: string, intent: string): Promise<SaleResponse | null> => {
    setLoading(true); setError(null); setNotice(null);
    try {
      const next = await action(); setSale(next);
      if (next.status === 'DRAFT') writeStorage(ACTIVE_SALE_KEY, next.id); else clearStorage(ACTIVE_SALE_KEY);
      clearStorage('supermarket.sale-intent.' + intent);
      setNotice(success);
      return next;
    } catch (nextError) { setError(nextError); return null; } finally { setLoading(false); }
  };
  const focusBarcode = (): void => { barcodeInput.current?.focus(); barcodeInput.current?.select(); };
  const start = (): void => {
    if (!shiftId.trim()) { setError(new Error('SHIFT_REQUIRED')); return; }
    const intent = 'start-' + shiftId.trim() + '-' + currencyCode.trim().toUpperCase();
    void run(() => api.startSale({ shiftId: shiftId.trim(), currencyCode: currencyCode.trim().toUpperCase() }, intentKey(intent)), 'Venta iniciada.', intent)
      .then((next) => { if (next) focusBarcode(); });
  };
  /**
   * Solo limpia el campo cuando el nodo aceptó la línea. Vaciarlo siempre hacía
   * que un barcode rechazado pareciera una acción sin efecto ni causa visible.
   */
  const addItem = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault(); if (!sale) return;
    const scanned = barcode.trim();
    if (!scanned) { focusBarcode(); return; }
    const intent = 'add-' + scanned + '-' + quantity + '-' + quantityScale;
    void run(() => api.addSaleItem(sale.id, { barcode: scanned, quantityScaled: Number(quantity), quantityScale: Number(quantityScale) }, intentKey(intent)), 'Producto agregado al carrito.', intent)
      .then((next) => {
        if (next) {
          setBarcode('');
          setQuantity('1');
          setHighlightedItemId(next.items[next.items.length - 1]?.id ?? null);
        }
        focusBarcode();
      });
  };
  const removeItem = (itemId: string): void => { if (sale) void run(() => api.removeSaleItem(sale.id, itemId, intentKey('remove-' + itemId)), 'Línea eliminada.', 'remove-' + itemId); };
  const applyDiscount = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault(); if (!sale || !discountItemId) return;
    const intent = 'discount-' + discountItemId + '-' + discountBasisPoints + '-' + discountReason.trim();
    void run(() => api.applySaleDiscount(sale.id, { itemId: discountItemId, basisPoints: Number(discountBasisPoints), reason: discountReason.trim() }, intentKey(intent)), 'Descuento aplicado.', intent);
  };
  const registerPayment = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault(); if (!sale) return;
    try {
      const amountMinorUnits = parseMinorUnits(paymentAmount, scale);
      const payments = [{ methodCode: paymentMethodCode.trim(), currencyCode: paymentCurrency.trim().toUpperCase(), amountMinorUnits }];
      if (paymentMethodCode2.trim() && paymentAmount2.trim()) payments.push({ methodCode: paymentMethodCode2.trim(), currencyCode: paymentCurrency2.trim().toUpperCase(), amountMinorUnits: parseMinorUnits(paymentAmount2, scale) });
      const intent = 'payment-' + paymentMethodCode.trim() + '-' + paymentCurrency.trim().toUpperCase() + '-' + paymentAmount + '-' + paymentMethodCode2.trim() + '-' + paymentAmount2;
      void run(() => api.registerSalePayments(sale.id, { payments }, intentKey(intent)), 'Pago registrado.', intent);
    } catch (nextError) { setError(nextError); }
  };
  const complete = (): void => { if (sale) void run(() => api.completeSale(sale.id, intentKey('complete')), 'Venta completada.', 'complete'); };
  const voidCurrentSale = (): void => {
    if (!sale || !voidReason.trim()) return;
    if (typeof window !== 'undefined' && !window.confirm('¿Confirmas anular esta venta? La anulación queda auditada.')) return;
    void run(() => api.voidSale(sale.id, { reason: voidReason.trim() }, intentKey('void')), 'Venta anulada.', 'void');
  };
  const startAnotherSale = (): void => {
    setSale(null); setError(null); setNotice(null); setHighlightedItemId(null);
    setBarcode(''); setQuantity('1'); setPaymentAmount(''); setPaymentAmount2('');
    setPaymentMethodCode2(''); setVoidReason('');
    setDiscountItemId(''); setDiscountBasisPoints(''); setDiscountReason('');
  };
  const completionBlocker = saleCompletionBlocker(sale, scale);
  return (
    <div className="operation-screen">
      <ScreenNote>El servidor conserva los totales, impuestos y estado fiscal. Esta pantalla solo coordina intenciones del operador. No se aceptan cálculos locales.</ScreenNote>
      <Feedback error={error} notice={notice} onDismiss={dismissFeedback} />
      {!sale ? <section className="panel start-panel" aria-labelledby="start-sale-title">
        <div><p className="eyebrow">Nueva venta</p><h3 id="start-sale-title">Abrir carrito</h3><p className="muted">El turno lo abre la pantalla de Caja; aquí solo se selecciona.</p></div>
        {shiftId.trim()
          ? <p className="inline-status is-ready"><span aria-hidden="true">✓</span> Turno tomado de Caja: <code>{shiftId.trim()}</code></p>
          : <p className="inline-status is-warning"><span aria-hidden="true">!</span> Esta estación no tiene un turno abierto. <a href="#/cash">Abre la caja</a> y vuelve a esta pantalla.</p>}
        <label>Turno activo<input value={shiftId} onChange={(event) => setShiftId(event.target.value)} placeholder="Se completa desde Caja" required /></label>
        <div className="form-grid"><label>Moneda de venta<input value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value.toUpperCase())} maxLength={8} required /></label><label>Escala visible<input type="number" min="0" max="6" value={currencyScale} onChange={(event) => setCurrencyScale(event.target.value)} /></label></div>
        <ActionButton className="primary-button" type="button" onClick={start} busy={loading} disabled={loading || !shiftId.trim()}>{loading ? 'Abriendo carrito…' : 'Iniciar venta'}</ActionButton>
      </section> : sale.status !== 'DRAFT' ? <section className="panel closed-sale" aria-labelledby="closed-sale-title">
        <p className="eyebrow">{sale.status === 'COMPLETED' ? 'Venta completada' : 'Venta anulada'}</p>
        <h3 id="closed-sale-title">{money(sale.totalMinorUnits, sale.currencyCode, scale)}</h3>
        <dl className="detail-grid">
          <div><dt>Venta</dt><dd>{sale.id}</dd></div>
          <div><dt>Líneas</dt><dd>{sale.items.length}</dd></div>
          <div><dt>Pagado</dt><dd>{money(sale.paidTotalMinorUnits, sale.currencyCode, scale)}</dd></div>
          <div><dt>Estado</dt><dd>{sale.status}</dd></div>
        </dl>
        <span className="simulation-label">Fiscal · SIMULACIÓN</span>
        <ActionButton className="primary-button" type="button" onClick={startAnotherSale}>Iniciar otra venta</ActionButton>
      </section> : <>
        <div className="screen-toolbar"><span className="status-label">Venta {sale.id.slice(0, 8)} · {sale.status}</span><span className="status-label">{sale.items.length} líneas</span><span className="simulation-label">Fiscal · SIMULACIÓN</span><ActionButton type="button" onClick={() => void refresh(sale.id)} busy={loading} disabled={loading}>Actualizar</ActionButton></div>
        <div className="sales-layout">
          <section className="panel" aria-labelledby="cart-title"><div className="panel-heading"><div><p className="eyebrow">Carrito</p><h3 id="cart-title">Líneas de venta</h3></div><strong className="total-figure">{money(sale.totalMinorUnits, sale.currencyCode, scale)}</strong></div>
            <form className="inline-form" onSubmit={addItem}><label className="grow">Barcode<input ref={barcodeInput} value={barcode} onChange={(event) => setBarcode(event.target.value)} autoFocus required /></label><label>Cant.<input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label><label title="Debe coincidir con la escala de la unidad del producto; 0 para unidades enteras.">Escala<input type="number" min="0" max="12" value={quantityScale} onChange={(event) => setQuantityScale(event.target.value)} required /></label><ActionButton className="primary-button" type="submit" busy={loading} disabled={loading || !barcode.trim()}>{loading ? 'Agregando…' : 'Agregar'}</ActionButton></form>
            {sale.items.length === 0 ? <EmptyState>Escanea o escribe un barcode y presiona Enter para comenzar.</EmptyState> : <div className="table-wrap"><table><caption className="sr-only">Líneas actuales</caption><thead><tr><th>Producto</th><th>Cant.</th><th>Total</th><th /></tr></thead><tbody>{sale.items.map((item) => <tr key={item.id} className={item.id === highlightedItemId ? 'is-new' : undefined}><td><strong>{item.description}</strong><small>{item.unitCode}</small></td><td>{item.quantityScaled / (10 ** item.quantityScale)}</td><td>{money(item.totalMinorUnits, sale.currencyCode, scale)}</td><td><ActionButton type="button" onClick={() => removeItem(item.id)} disabled={loading}>Quitar</ActionButton></td></tr>)}</tbody></table></div>}
          </section>
          <aside className="sales-side">
            <section className="panel totals-panel" aria-labelledby="totals-title"><p className="eyebrow">Resumen calculado por API</p><h3 id="totals-title">Total a cobrar</h3><dl className="totals"><div><dt>Subtotal</dt><dd>{money(sale.subtotalMinorUnits, sale.currencyCode, scale)}</dd></div><div><dt>Descuentos</dt><dd>−{money(sale.discountTotalMinorUnits, sale.currencyCode, scale)}</dd></div><div><dt>IVA</dt><dd>{money(sale.taxTotalMinorUnits, sale.currencyCode, scale)}</dd></div><div className="grand-total"><dt>Total</dt><dd>{money(sale.totalMinorUnits, sale.currencyCode, scale)}</dd></div><div><dt>Pagado</dt><dd>{money(sale.paidTotalMinorUnits, sale.currencyCode, scale)}</dd></div><div><dt>Saldo</dt><dd>{money(sale.balanceMinorUnits, sale.currencyCode, scale)}</dd></div></dl></section>
            <section className="panel" aria-labelledby="payment-title"><p className="eyebrow">Cobro</p><h3 id="payment-title">Registrar pagos mixtos</h3><form className="stack-form" onSubmit={registerPayment}><label>Método 1<input value={paymentMethodCode} onChange={(event) => setPaymentMethodCode(event.target.value)} required /></label><label>Moneda 1<input value={paymentCurrency} onChange={(event) => setPaymentCurrency(event.target.value.toUpperCase())} required /></label><label>Importe 1<input inputMode="decimal" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} placeholder="0,00" required /></label><p className="muted">Se sugiere el saldo pendiente: {money(sale.balanceMinorUnits, sale.currencyCode, scale)}.</p><label>Método 2 (opcional)<input value={paymentMethodCode2} onChange={(event) => setPaymentMethodCode2(event.target.value)} /></label>{paymentMethodCode2 && <><label>Moneda 2<input value={paymentCurrency2} onChange={(event) => setPaymentCurrency2(event.target.value.toUpperCase())} /></label><label>Importe 2<input inputMode="decimal" value={paymentAmount2} onChange={(event) => setPaymentAmount2(event.target.value)} placeholder="0,00" required={Boolean(paymentMethodCode2)} /></label></>}<ActionButton className="primary-button" type="submit" busy={loading} disabled={loading}>{loading ? 'Registrando…' : 'Registrar lote de pagos'}</ActionButton></form></section>
            <section className="panel" aria-labelledby="discount-title"><p className="eyebrow">Autorización</p><h3 id="discount-title">Descuento de línea</h3><form className="stack-form" onSubmit={applyDiscount}><label>Línea<select value={discountItemId} onChange={(event) => setDiscountItemId(event.target.value)} required><option value="">Selecciona</option>{sale.items.map((item) => <option key={item.id} value={item.id}>{item.description}</option>)}</select></label><label>Porcentaje (puntos base)<input type="number" min="1" max="10000" value={discountBasisPoints} onChange={(event) => setDiscountBasisPoints(event.target.value)} required /></label><label>Motivo<input value={discountReason} onChange={(event) => setDiscountReason(event.target.value)} maxLength={500} required /></label><ActionButton type="submit" busy={loading} disabled={loading}>{loading ? 'Solicitando…' : 'Solicitar descuento'}</ActionButton></form></section>
            <section className="panel danger-panel" aria-labelledby="void-title"><p className="eyebrow">Acción sensible</p><h3 id="void-title">Anular venta</h3><label>Motivo<input value={voidReason} onChange={(event) => setVoidReason(event.target.value)} maxLength={500} required /></label>{!voidReason.trim() && <p className="muted">Escribe el motivo para habilitar la anulación; queda auditada.</p>}<ActionButton type="button" onClick={voidCurrentSale} busy={loading} disabled={loading || !voidReason.trim()}>Anular con confirmación</ActionButton></section>
            <div className="complete-block">
              <ActionButton className="primary-button complete-button" type="button" onClick={complete} busy={loading} disabled={loading || completionBlocker !== null} aria-describedby={completionBlocker ? 'complete-blocker' : undefined}>{loading ? 'Completando…' : 'Completar venta'}</ActionButton>
              {completionBlocker && <p className="muted" id="complete-blocker" role="status">{completionBlocker}</p>}
            </div>
          </aside>
        </div>
      </>}
    </div>
  );
};

export const CashScreen = ({ api }: ScreenProps): React.JSX.Element => {
  const [cashRegisterId, setCashRegisterId] = useState(''); const [cashMethodCode, setCashMethodCode] = useState(''); const [shift, setShift] = useState<ShiftResponse | null>(null); const [openingAmount, setOpeningAmount] = useState(''); const [movementAmount, setMovementAmount] = useState(''); const [movementType, setMovementType] = useState<RegisterCashMovementRequest['type']>('INCOME'); const [movementReason, setMovementReason] = useState(''); const [declaredAmount, setDeclaredAmount] = useState(''); const [error, setError] = useState<unknown>(null); const [notice, setNotice] = useState<string | null>(null); const [loading, setLoading] = useState(false);
  const [configuredCashRegisterId] = useState(() => readStorage(ACTIVE_CASH_REGISTER_KEY) ?? '');
  useEffect(() => { if (configuredCashRegisterId) setCashRegisterId(configuredCashRegisterId); }, [configuredCashRegisterId]);
  const run = async (action: () => Promise<ShiftResponse>, success: string): Promise<void> => { setLoading(true); setError(null); setNotice(null); try { const next = await action(); setShift(next); if (next.status === 'OPEN') { writeStorage(ACTIVE_SHIFT_KEY, next.id); writeStorage(ACTIVE_CASH_REGISTER_KEY, next.cashRegisterId); } else { clearStorage(ACTIVE_SHIFT_KEY); } setNotice(success); } catch (nextError) { setError(nextError); } finally { setLoading(false); } };
  const load = (): void => { if (!cashRegisterId.trim()) return; void (async () => { setLoading(true); setError(null); try { setShift(await api.getOpenShift(cashRegisterId.trim())); } catch (nextError) { if (nextError instanceof ApiProblemError && nextError.problem.code === 'SHIFT_NOT_FOUND') setShift(null); else setError(nextError); } finally { setLoading(false); } })(); };
  useEffect(() => { if (configuredCashRegisterId) void api.getOpenShift(configuredCashRegisterId).then(setShift).catch((nextError: unknown) => { if (!(nextError instanceof ApiProblemError && nextError.problem.code === 'SHIFT_NOT_FOUND')) setError(nextError); }); }, [api, configuredCashRegisterId]);
  const submitOpen = (event: React.FormEvent<HTMLFormElement>): void => { event.preventDefault(); try { const amount = openingAmount ? parseMinorUnits(openingAmount, 2) : 0; void run(() => api.openShift({ cashRegisterId: cashRegisterId.trim(), openingFunds: amount ? [{ paymentMethodCode: cashMethodCode.trim(), currencyCode: 'USD', amountMinorUnits: amount }] : [] }, createIdempotencyKey()), 'Turno abierto.'); } catch (nextError) { setError(nextError); } };
  const submitMovement = (event: React.FormEvent<HTMLFormElement>): void => { event.preventDefault(); if (!shift) return; try { const amount = parseMinorUnits(movementAmount, 2); void run(() => api.registerCashMovement(shift.id, { type: movementType, paymentMethodCode: cashMethodCode.trim(), currencyCode: 'USD', amountMinorUnits: amount, reason: movementReason.trim() }, createIdempotencyKey()), 'Movimiento registrado.'); } catch (nextError) { setError(nextError); } };
  const submitClose = (event: React.FormEvent<HTMLFormElement>): void => { event.preventDefault(); if (!shift) return; try { const amount = parseMinorUnits(declaredAmount, 2); void run(() => api.closeShift(shift.id, { declaredBalances: [{ paymentMethodCode: cashMethodCode.trim(), currencyCode: 'USD', amountMinorUnits: amount }] }, createIdempotencyKey()), 'Turno cerrado.'); } catch (nextError) { setError(nextError); } };
  return <div className="operation-screen"><SectionTitle eyebrow="9.03 · Operación" title="Caja" description="Apertura, movimientos y cierre se envían al turno dueño de la caja. Las diferencias quedan visibles para autorización." /><Feedback error={error} notice={notice} /><section className="panel"><div className="form-grid"><label>Caja asignada<input value={cashRegisterId} onChange={(event) => setCashRegisterId(event.target.value)} placeholder="Configuración de estación" required /></label><label>Método de efectivo<input value={cashMethodCode} onChange={(event) => setCashMethodCode(event.target.value)} placeholder="Código habilitado por el nodo" required /></label><div className="align-end"><button type="button" onClick={load} disabled={loading || !cashRegisterId.trim()}>Consultar turno</button></div></div></section>{!shift ? <section className="panel"><p className="eyebrow">Inicio de turno</p><h3>Abrir caja</h3><form className="inline-form" onSubmit={submitOpen}><label>Fondo inicial<input inputMode="decimal" value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} placeholder="0,00" /></label><button className="primary-button" type="submit" disabled={loading || !cashRegisterId.trim() || !cashMethodCode.trim()}>Abrir turno</button></form></section> : <div className="cash-layout"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">Turno {shift.id.slice(0, 8)}</p><h3>{shift.status === 'OPEN' ? 'Turno abierto' : 'Turno cerrado'}</h3></div><span className="status-label">{shift.movements.length} movimientos</span></div><dl className="totals">{shift.expectedBalances.map((balance) => <div key={balance.paymentMethodCode + '-' + balance.currencyCode}><dt>{balance.paymentMethodCode} · Esperado</dt><dd>{money(balance.minorUnits, balance.currencyCode)}</dd></div>)}</dl><form className="stack-form" onSubmit={submitMovement}><h4>Registrar movimiento</h4><label>Tipo<select value={movementType} onChange={(event) => setMovementType(event.target.value as RegisterCashMovementRequest['type'])}><option value="INCOME">Ingreso</option><option value="WITHDRAWAL">Retiro</option></select></label><label>Importe<input inputMode="decimal" value={movementAmount} onChange={(event) => setMovementAmount(event.target.value)} required /></label><label>Motivo<input value={movementReason} onChange={(event) => setMovementReason(event.target.value)} required /></label><button type="submit" disabled={loading || shift.status !== 'OPEN' || !cashMethodCode.trim()}>Registrar movimiento</button></form></section><section className="panel"><p className="eyebrow">Cierre</p><h3>Declarar efectivo</h3><form className="stack-form" onSubmit={submitClose}><label>Saldo declarado<input inputMode="decimal" value={declaredAmount} onChange={(event) => setDeclaredAmount(event.target.value)} required /></label><button className="primary-button" type="submit" disabled={loading || shift.status !== 'OPEN' || !cashMethodCode.trim()}>Cerrar turno</button></form>{shift.closingBalances && <div className="table-wrap"><table><thead><tr><th>Método</th><th>Esperado</th><th>Declarado</th><th>Diferencia</th></tr></thead><tbody>{shift.closingBalances.map((balance) => <tr key={balance.paymentMethodCode + '-' + balance.currencyCode}><td>{balance.paymentMethodCode}</td><td>{money(balance.expectedMinorUnits, balance.currencyCode)}</td><td>{money(balance.declaredMinorUnits, balance.currencyCode)}</td><td>{money(balance.differenceMinorUnits, balance.currencyCode)}</td></tr>)}</tbody></table></div>}</section></div>}</div>;
};

export const CatalogScreen = ({ api }: ScreenProps): React.JSX.Element => {
  const [barcode, setBarcode] = useState(''); const [product, setProduct] = useState<ProductResponse | null>(null); const [products, setProducts] = useState<readonly ProductResponse[]>([]); const [history, setHistory] = useState<readonly { id: string; priceMinorUnits: number; currencyCode: string; recordedAt: string; recordedBy: string; reason: string }[]>([]); const [price, setPrice] = useState(''); const [reason, setReason] = useState(''); const [error, setError] = useState<unknown>(null); const [notice, setNotice] = useState<string | null>(null); const [loading, setLoading] = useState(false); const [showCreate, setShowCreate] = useState(false); const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [categoryId, setCategoryId] = useState(''); const [unitCode, setUnitCode] = useState('UNIT'); const [newBarcode, setNewBarcode] = useState(''); const [newPrice, setNewPrice] = useState(''); const [newCurrency, setNewCurrency] = useState('USD'); const [taxRate, setTaxRate] = useState('0');
  const list = async (): Promise<void> => { setLoading(true); setError(null); try { setProducts(await api.listProducts(barcode)); } catch (nextError) { setError(nextError); } finally { setLoading(false); } };
  const search = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => { event.preventDefault(); setLoading(true); setError(null); setNotice(null); try { const response = await api.findProductByBarcode(barcode.trim()); setProduct(response.product); setPrice(String(response.product.price.amountMinorUnits)); setHistory(await api.getPriceHistory(response.product.id)); } catch (nextError) { setProduct(null); setError(nextError); } finally { setLoading(false); } };
  const savePrice = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => { event.preventDefault(); if (!product) return; setLoading(true); setError(null); try { setProduct(await api.updatePrice(product.id, { priceMinorUnits: Number(price), currencyCode: product.price.currencyCode, reason: reason.trim() }, createIdempotencyKey())); setNotice('Precio actualizado.'); } catch (nextError) { setError(nextError); } finally { setLoading(false); } };
  const create = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => { event.preventDefault(); setLoading(true); setError(null); try { const created = await api.createProduct({ name: name.trim(), description: description.trim(), categoryId: categoryId.trim(), unitCode: unitCode.trim(), barcodes: [newBarcode.trim()], priceMinorUnits: Number(newPrice), currencyCode: newCurrency.trim().toUpperCase(), taxRateBasisPoints: Number(taxRate), reason: reason.trim() }, createIdempotencyKey()); setProduct(created); setShowCreate(false); setNotice('Producto creado.'); } catch (nextError) { setError(nextError); } finally { setLoading(false); } };
  return <div className="operation-screen"><SectionTitle eyebrow="9.04 · Datos maestros" title="Catálogo" description="Busca productos por barcode y muestra el snapshot que devuelve el nodo. Los cambios de precio quedan auditados." /><Feedback error={error} notice={notice} /><section className="panel"><div className="screen-toolbar"><form className="inline-form grow" onSubmit={search}><label className="grow">Barcode<input value={barcode} onChange={(event) => setBarcode(event.target.value)} autoFocus /></label><button className="primary-button" type="submit" disabled={loading}>Buscar barcode</button></form><button type="button" onClick={() => void list()} disabled={loading}>Cargar listado</button><button type="button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? 'Cancelar' : 'Nuevo producto'}</button></div>{showCreate && <form className="stack-form" onSubmit={create}><div className="form-grid"><label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Descripción<input value={description} onChange={(event) => setDescription(event.target.value)} required /></label><label>Categoría<input value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required /></label><label>Unidad<input value={unitCode} onChange={(event) => setUnitCode(event.target.value)} required /></label><label>Barcode<input value={newBarcode} onChange={(event) => setNewBarcode(event.target.value)} required /></label><label>Precio (unidades menores)<input type="number" min="0" value={newPrice} onChange={(event) => setNewPrice(event.target.value)} required /></label><label>Moneda<input value={newCurrency} onChange={(event) => setNewCurrency(event.target.value.toUpperCase())} required /></label><label>IVA (puntos base)<input type="number" min="0" value={taxRate} onChange={(event) => setTaxRate(event.target.value)} required /></label></div><label>Motivo<input value={reason} onChange={(event) => setReason(event.target.value)} required /></label><button className="primary-button" type="submit" disabled={loading}>Crear producto</button></form>}</section>{products.length > 0 && <section className="panel"><p className="eyebrow">Listado consultado</p><div className="table-wrap"><table><thead><tr><th>Producto</th><th>Barcode</th><th>Precio</th><th /></tr></thead><tbody>{products.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.barcodes.join(', ')}</td><td>{money(item.price.amountMinorUnits, item.price.currencyCode)}</td><td><button type="button" onClick={() => { setProduct(item); setPrice(String(item.price.amountMinorUnits)); void api.getPriceHistory(item.id).then(setHistory).catch(setError); }}>Ver ficha</button></td></tr>)}</tbody></table></div></section>}{product ? <section className="panel product-detail"><div><p className="eyebrow">Producto encontrado</p><h3>{product.name}</h3><p className="muted">{product.description}</p><dl className="detail-grid"><div><dt>Unidad</dt><dd>{product.unitCode}</dd></div><div><dt>Barcode</dt><dd>{product.barcodes.join(', ')}</dd></div><div><dt>Estado</dt><dd>{product.isActive ? 'Activo' : 'Inactivo'}</dd></div><div><dt>Versión</dt><dd>{product.version}</dd></div></dl><h4>Historial de precio</h4>{history.length === 0 ? <p className="muted">Sin registros.</p> : <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Precio</th><th>Motivo</th></tr></thead><tbody>{history.map((entry) => <tr key={entry.id}><td>{new Date(entry.recordedAt).toLocaleString('es-VE')}</td><td>{money(entry.priceMinorUnits, entry.currencyCode)}</td><td>{entry.reason}</td></tr>)}</tbody></table></div>}</div><form className="stack-form" onSubmit={savePrice}><label>Precio (unidades menores)<input type="number" min="0" value={price} onChange={(event) => setPrice(event.target.value)} required /></label><label>Motivo<input value={reason} onChange={(event) => setReason(event.target.value)} required /></label><button className="primary-button" type="submit" disabled={loading}>Actualizar precio</button></form></section> : <EmptyState>Busca un barcode o carga el listado para consultar el catálogo.</EmptyState>}</div>;
};

export const InventoryScreen = ({ api }: ScreenProps): React.JSX.Element => {
  const [productId, setProductId] = useState(''); const [stockItemId, setStockItemId] = useState(''); const [kardex, setKardex] = useState<KardexDto | null>(null); const [type, setType] = useState<'WASTE' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'>('WASTE'); const [quantity, setQuantity] = useState(''); const [reason, setReason] = useState(''); const [referenceId, setReferenceId] = useState(''); const [supplierId, setSupplierId] = useState(''); const [receiptId, setReceiptId] = useState(''); const [receiveQuantity, setReceiveQuantity] = useState(''); const [lotNumber, setLotNumber] = useState(''); const [lotExpiresAt, setLotExpiresAt] = useState(''); const [error, setError] = useState<unknown>(null); const [notice, setNotice] = useState<string | null>(null); const [loading, setLoading] = useState(false);
  const load = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => { event.preventDefault(); setLoading(true); setError(null); try { setKardex(await api.getKardex(productId.trim())); } catch (nextError) { setError(nextError); } finally { setLoading(false); } };
  const adjust = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => { event.preventDefault(); setLoading(true); setError(null); try { setKardex(await api.registerStockAdjustment(stockItemId.trim(), { type, quantityScaled: Number(quantity), quantityScale: 0, reason: reason.trim(), referenceId: referenceId.trim() }, createIdempotencyKey())); setNotice('Movimiento de inventario registrado.'); } catch (nextError) { setError(nextError); } finally { setLoading(false); } };
  const receive = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => { event.preventDefault(); setLoading(true); setError(null); try { await api.receivePurchase({ stockItemId: stockItemId.trim(), productId: productId.trim(), unitCode: 'UNIT', quantityScale: 0, tracksBatches: Boolean(lotNumber.trim()), quantityScaled: Number(receiveQuantity), supplierId: supplierId.trim(), receiptId: receiptId.trim(), reason: reason.trim(), ...(lotNumber.trim() ? { lot: { lotNumber: lotNumber.trim(), ...(lotExpiresAt ? { expiresAt: new Date(lotExpiresAt).toISOString() } : {}) } } : {}) }, createIdempotencyKey()); setKardex(await api.getKardex(productId.trim())); setNotice('Recepción registrada.'); } catch (nextError) { setError(nextError); } finally { setLoading(false); } };
  return <div className="operation-screen"><SectionTitle eyebrow="9.05 · Existencias" title="Inventario" description="Consulta el kardex y registra recepciones o ajustes autorizados. La existencia y la trazabilidad pertenecen al agregado del nodo." /><Feedback error={error} notice={notice} /><section className="panel"><form className="inline-form" onSubmit={load}><label className="grow">Producto<input value={productId} onChange={(event) => setProductId(event.target.value)} placeholder="Identificador del producto" required /></label><button className="primary-button" type="submit" disabled={loading}>Consultar kardex</button></form></section>{kardex && <div className="inventory-layout"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">Saldo actual</p><h3>{kardex.productId}</h3></div><strong className="total-figure">{kardex.currentBalanceScaled / (10 ** kardex.quantityScale)}</strong></div>{kardex.batches.length > 0 && <div><p className="eyebrow">Lotes y vencimientos</p><div className="detail-grid">{kardex.batches.map((batch) => <div key={batch.id}><dt>{batch.lotNumber}</dt><dd>{batch.expiresAt ? new Date(batch.expiresAt).toLocaleDateString('es-VE') : 'Sin vencimiento'}</dd></div>)}</div></div>}<div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Dirección</th><th>Cantidad</th><th>Motivo</th></tr></thead><tbody>{kardex.movements.map((movement) => <tr key={movement.id}><td>{new Date(movement.occurredAt).toLocaleString('es-VE')}</td><td>{movement.type}</td><td>{movement.direction}</td><td>{movement.quantityScaled / (10 ** movement.quantityScale)}</td><td>{movement.reason}</td></tr>)}</tbody></table></div></section><section className="panel"><p className="eyebrow">Recepción</p><h3>Registrar compra</h3><form className="stack-form" onSubmit={receive}><label>Stock item<input value={stockItemId} onChange={(event) => setStockItemId(event.target.value)} required /></label><label>Proveedor<input value={supplierId} onChange={(event) => setSupplierId(event.target.value)} required /></label><label>Recibo<input value={receiptId} onChange={(event) => setReceiptId(event.target.value)} required /></label><label>Cantidad escalada<input type="number" min="1" value={receiveQuantity} onChange={(event) => setReceiveQuantity(event.target.value)} required /></label><label>Lote (opcional)<input value={lotNumber} onChange={(event) => setLotNumber(event.target.value)} /></label><label>Vencimiento<input type="date" value={lotExpiresAt} onChange={(event) => setLotExpiresAt(event.target.value)} /></label><label>Motivo<input value={reason} onChange={(event) => setReason(event.target.value)} required /></label><button className="primary-button" type="submit" disabled={loading}>Registrar recepción</button></form><p className="eyebrow">Movimiento autorizado</p><h3>Ajustar existencia</h3><form className="stack-form" onSubmit={adjust}><label>Tipo<select value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="WASTE">Merma</option><option value="ADJUSTMENT_IN">Ajuste entrada</option><option value="ADJUSTMENT_OUT">Ajuste salida</option></select></label><label>Cantidad escalada<input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label><label>Referencia<input value={referenceId} onChange={(event) => setReferenceId(event.target.value)} required /></label><label>Motivo<input value={reason} onChange={(event) => setReason(event.target.value)} required /></label><button className="primary-button" type="submit" disabled={loading}>Registrar ajuste</button></form></section></div>}</div>;
};

export type ReportSection<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown };
export type OperationalReports = {
  readonly closures: ReportSection<readonly CashClosureReportResponse[]>;
  readonly audit: ReportSection<readonly AuditReportResponse[]>;
  readonly fiscal: ReportSection<FiscalOperationsReportResponse>;
};
type ReportFilters = { from: string; to: string; limit: string; cashRegisterId: string };
type ReportsApi = Pick<OperationApi, 'getCashClosureReport' | 'getAuditReport' | 'getFiscalOperationsReport'>;

const section = async <T,>(load: () => Promise<T>): Promise<ReportSection<T>> => {
  try { return { ok: true, value: await load() }; } catch (error) { return { ok: false, error }; }
};

export const toReportQuery = (filters: ReportFilters): ReportQuery => ({
  ...(filters.from ? { from: new Date(filters.from + 'T00:00:00.000Z').toISOString() } : {}),
  ...(filters.to ? { to: new Date(filters.to + 'T23:59:59.999Z').toISOString() } : {}),
  ...(filters.limit.trim() ? { limit: Number(filters.limit) } : {})
});

export const loadOperationalReports = async (
  api: ReportsApi,
  filters: ReportFilters
): Promise<OperationalReports> => {
  const query = toReportQuery(filters);
  const [closures, audit, fiscal] = await Promise.all([
    section(() => api.getCashClosureReport({
      ...query, ...(filters.cashRegisterId.trim() ? { cashRegisterId: filters.cashRegisterId.trim() } : {})
    })),
    section(() => api.getAuditReport(query)),
    section(() => api.getFiscalOperationsReport(query))
  ]);
  return { closures, audit, fiscal };
};

export const toCsv = (rows: readonly (readonly string[])[]): string => rows
  .map((row) => row.map((value) => '"' + (/^[=+\-@]/.test(value) ? "'" + value : value).replace(/"/g, '""') + '"').join(','))
  .join('\n');

const downloadCsv = (fileName: string, rows: readonly (readonly string[])[]): void => {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const SectionError = ({ error }: { readonly error: unknown }): React.JSX.Element => (
  <p className="form-error" role="alert">{problemMessage(error)}</p>
);

export const ReportsScreen = ({ api, capabilities }: ScreenProps): React.JSX.Element => {
  const today = new Date().toISOString().slice(0, 10);
  const [filters, setFilters] = useState<ReportFilters>({ from: '', to: '', limit: '', cashRegisterId: '' });
  const [reports, setReports] = useState<OperationalReports | null>(null);
  const [dayId, setDayId] = useState(''); const [businessDate, setBusinessDate] = useState(today); const [reason, setReason] = useState('Cierre operativo'); const [consent, setConsent] = useState(false); const [report, setReport] = useState<Awaited<ReturnType<OperationApi['printXReport']>>['report'] | null>(null); const [error, setError] = useState<unknown>(null); const [loading, setLoading] = useState(false);
  const update = (key: keyof ReportFilters) => (event: React.ChangeEvent<HTMLInputElement>): void =>
    setFilters((current) => ({ ...current, [key]: event.target.value }));
  const query = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault(); setLoading(true); setError(null);
    try { setReports(await loadOperationalReports(api, filters)); } catch (nextError) { setError(nextError); } finally { setLoading(false); }
  };
  const print = async (type: 'X' | 'Z'): Promise<void> => { if (!consent) return; setLoading(true); setError(null); try { const response = type === 'X' ? await api.printXReport({ dayId: dayId.trim(), businessDate, reason: reason.trim(), simulationConsent: 'ALLOW_SIMULATED_X_AND_Z' }, createIdempotencyKey()) : await api.printZReport({ dayId: dayId.trim(), businessDate, reason: reason.trim(), simulationConsent: 'ALLOW_SIMULATED_X_AND_Z' }, createIdempotencyKey()); setReport(response.report); } catch (nextError) { setError(nextError); } finally { setConsent(false); setLoading(false); } };
  const closures = reports?.closures; const audit = reports?.audit; const fiscal = reports?.fiscal;
  return <div className="operation-screen"><SectionTitle eyebrow="9.06 · Control" title="Reportes y cierres" description="Las consultas son de lectura autorizada y no modifican agregados. X y Z solo aparecen como simulación cuando la capacidad está habilitada." /><Feedback error={error} notice={null} /><section className="panel"><p className="eyebrow">Período consultado</p><h3>Filtros en UTC</h3><form className="stack-form" onSubmit={query}><div className="form-grid"><label>Desde (UTC)<input type="date" value={filters.from} onChange={update('from')} /></label><label>Hasta (UTC)<input type="date" value={filters.to} onChange={update('to')} /></label><label>Caja (opcional)<input value={filters.cashRegisterId} onChange={update('cashRegisterId')} placeholder="Identificador de caja" /></label><label>Filas (máximo 500)<input type="number" min="1" max="500" value={filters.limit} onChange={update('limit')} placeholder="100" /></label></div><button className="primary-button" type="submit" disabled={loading}>Consultar reportes</button></form></section>{closures && <section className="panel"><p className="eyebrow">Caja</p><h3>Cierres y diferencias</h3>{closures.ok ? <>{closures.value.length === 0 ? <EmptyState>Sin turnos en el período consultado.</EmptyState> : <><div className="table-wrap"><table><thead><tr><th>Turno</th><th>Caja</th><th>Apertura</th><th>Cierre</th><th>Movimientos</th><th>Diferencias</th></tr></thead><tbody>{closures.value.map((entry) => <tr key={entry.shiftId}><td>{entry.shiftId}</td><td>{entry.cashRegisterId}</td><td>{new Date(entry.openedAt).toLocaleString('es-VE')}</td><td>{entry.closedAt ? new Date(entry.closedAt).toLocaleString('es-VE') : 'Turno abierto'}</td><td>{entry.movementCount}</td><td>{entry.balances.length === 0 ? '—' : entry.balances.map((balance) => balance.paymentMethodCode + ' ' + money(balance.differenceMinorUnits, balance.currencyCode)).join(' · ')}</td></tr>)}</tbody></table></div><div className="button-row"><button type="button" onClick={() => downloadCsv('cierres-de-caja.csv', [['turno', 'caja', 'apertura', 'cierre', 'movimientos', 'metodo', 'moneda', 'esperado', 'declarado', 'diferencia'], ...closures.value.flatMap((entry) => entry.balances.length === 0 ? [[entry.shiftId, entry.cashRegisterId, entry.openedAt, entry.closedAt ?? '', String(entry.movementCount), '', '', '', '', '']] : entry.balances.map((balance) => [entry.shiftId, entry.cashRegisterId, entry.openedAt, entry.closedAt ?? '', String(entry.movementCount), balance.paymentMethodCode, balance.currencyCode, String(balance.expectedMinorUnits), String(balance.declaredMinorUnits), String(balance.differenceMinorUnits)]))])}>Exportar CSV visible</button></div></>}</> : <SectionError error={closures.error} />}</section>}{audit && <section className="panel"><p className="eyebrow">Auditoría</p><h3>Operaciones sensibles</h3>{audit.ok ? <>{audit.value.length === 0 ? <EmptyState>Sin entradas de auditoría en el período consultado.</EmptyState> : <><div className="table-wrap"><table><thead><tr><th>Fecha UTC</th><th>Actor</th><th>Acción</th><th>Entidad</th><th>Motivo</th><th>Terminal</th><th>Correlación</th></tr></thead><tbody>{audit.value.map((entry) => <tr key={entry.auditId}><td>{entry.occurredAt}</td><td>{entry.actorId}</td><td>{entry.action}</td><td>{entry.entityType} · {entry.entityId}</td><td>{entry.reason}</td><td>{entry.terminalId}</td><td>{entry.correlationId}</td></tr>)}</tbody></table></div><p className="muted">La auditoría no expone el contenido antes/después del agregado; ese resumen permanece en el ledger.</p><div className="button-row"><button type="button" onClick={() => downloadCsv('auditoria.csv', [['fechaUtc', 'actor', 'roles', 'accion', 'entidad', 'entidadId', 'motivo', 'terminal', 'nodo', 'correlacion'], ...audit.value.map((entry) => [entry.occurredAt, entry.actorId, entry.actorRoleCodes.join(' '), entry.action, entry.entityType, entry.entityId, entry.reason, entry.terminalId, entry.originNodeId, entry.correlationId])])}>Exportar CSV visible</button></div></>}</> : <SectionError error={audit.error} />}</section>}{fiscal && <section className="panel"><p className="eyebrow">Fiscalidad</p><h3>Operaciones y estados recuperables</h3>{fiscal.ok ? <>{fiscal.value.operations.length === 0 ? <EmptyState>Sin operaciones fiscales en el período consultado.</EmptyState> : <><div className="table-wrap"><table><thead><tr><th>Tipo</th><th>Identificador</th><th>Operación</th><th>Estado</th><th>Intentos</th><th>Número</th><th>Error</th><th>Evidencia</th></tr></thead><tbody>{fiscal.value.operations.map((entry) => <tr key={entry.kind + entry.id}><td>{entry.kind === 'DOCUMENT' ? 'Documento' : 'Reporte'}</td><td>{entry.id}</td><td>{entry.operationType}</td><td>{entry.status}</td><td>{entry.attempts}</td><td>{entry.fiscalNumber ?? '—'}</td><td>{entry.lastErrorCode ?? '—'}</td><td>{entry.evidence ? Object.entries(entry.evidence).map(([axis, value]) => axis + '=' + value).join(' · ') : 'Sin evidencia'}</td></tr>)}</tbody></table></div><span className="simulation-label">SIMULACIÓN · {fiscal.value.fiscalMode} · no son documentos fiscales legales</span><div className="button-row"><button type="button" onClick={() => downloadCsv('operaciones-fiscales.csv', [['tipo', 'id', 'referencia', 'jornada', 'operacion', 'estado', 'intentos', 'numero', 'error', 'solicitadoUtc', 'modo'], ...fiscal.value.operations.map((entry) => [entry.kind, entry.id, entry.referenceId ?? '', entry.dayId ?? '', entry.operationType, entry.status, String(entry.attempts), entry.fiscalNumber ?? '', entry.lastErrorCode ?? '', entry.requestedAt, fiscal.value.fiscalMode])])}>Exportar CSV visible</button></div></>}</> : <SectionError error={fiscal.error} />}</section>}{capabilities.simulatedReportsEnabled ? <section className="panel"><p className="eyebrow">Acciones fiscales simuladas</p><h3>Reportes X y Z</h3><p className="muted">Estas acciones no son consultas: ejecutan el simulador y quedan registradas. La jornada y la fecha de negocio se capturan aquí porque la API no publica una lectura de jornada actual.</p><div className="form-grid"><label>Día fiscal<input value={dayId} onChange={(event) => setDayId(event.target.value)} placeholder="Identificador del día" required /></label><label>Fecha de negocio<input type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} required /></label></div><label>Motivo<input value={reason} onChange={(event) => setReason(event.target.value)} required /></label><label className="consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> Confirmo que ejecutaré una simulación y que su resultado no es un cierre fiscal legal.</label><div className="button-row"><button type="button" onClick={() => void print('X')} disabled={loading || !consent || !dayId.trim() || !reason.trim()}>Solicitar X simulado</button><button className="primary-button" type="button" onClick={() => void print('Z')} disabled={loading || !consent || !dayId.trim() || !reason.trim()}>Solicitar Z simulado</button></div></section> : <section className="panel"><p className="eyebrow">Acciones fiscales simuladas</p><h3>Reportes X y Z</h3><p className="muted">Los reportes simulados están deshabilitados por la configuración del nodo; esta estación no muestra la acción.</p></section>}{report && <section className="panel"><p className="eyebrow">Resultado del simulador</p><h3>Reporte {report.type} · {report.status}</h3><dl className="detail-grid"><div><dt>ID</dt><dd>{report.id}</dd></div><div><dt>Intentos</dt><dd>{report.attempts}</dd></div><div><dt>Número</dt><dd>{report.reportNumber ?? 'Pendiente'}</dd></div><div><dt>Último error</dt><dd>{report.lastErrorCode ?? '—'}</dd></div></dl><span className="simulation-label">SIMULACIÓN · no es documento fiscal legal</span></section>}<section className="panel"><p className="eyebrow">Sincronización</p><h3>Estado del nodo</h3><p className="muted">La sincronización offline-first pertenece a la Fase 10. Esta pantalla no inventa pendientes ni estados de red.</p></section></div>;
};

type CurrencyPairQuery = { readonly baseCurrency: string; readonly quoteCurrency: string };
type CurrencyReadsApi = Pick<OperationApi, 'getCurrentExchangeRate' | 'getExchangeRateHistory'>;
export type CurrencyPairReads = {
  readonly current: ReportSection<ExchangeRateResponse>;
  readonly history: ReportSection<readonly ExchangeRateResponse[]>;
};

/** Consulta tasa vigente e histórico en paralelo; una falla no oculta la otra. */
export const loadCurrentAndHistory = async (
  api: CurrencyReadsApi,
  pair: CurrencyPairQuery,
  limit?: number
): Promise<CurrencyPairReads> => {
  const [current, history] = await Promise.all([
    section(() => api.getCurrentExchangeRate(pair)),
    section(() => api.getExchangeRateHistory({ ...pair, ...(limit === undefined ? {} : { limit }) }))
  ]);
  return { current, history };
};

type CurrencySuggestionApi = Pick<OperationApi, 'getSuggestedExchangeRate'>;

/** Lectura pura de la sugerencia externa; nunca persiste ni sustituye a UpdateExchangeRate. */
export const loadSuggestion = (
  api: CurrencySuggestionApi,
  pair: CurrencyPairQuery
): Promise<ReportSection<ExchangeRateSuggestionResponse>> =>
  section(async () => (await api.getSuggestedExchangeRate(pair)).suggestion);

export type ManualRateForm = {
  readonly value: string; readonly source: string;
  readonly validFrom: string; readonly validUntil: string; readonly reason: string;
};

const EMPTY_MANUAL_FORM: ManualRateForm = {
  value: '', source: '', validFrom: new Date().toISOString().slice(0, 10), validUntil: '', reason: ''
};

/** Copia los valores visibles de la sugerencia al formulario revisable; no ejecuta ningún comando. */
export const suggestionToManualForm = (suggestion: ExchangeRateSuggestionResponse): ManualRateForm => ({
  value: formatScaledDecimal(suggestion.rateValue, suggestion.rateScale),
  source: suggestion.source,
  validFrom: (suggestion.validFrom ?? new Date().toISOString()).slice(0, 10),
  validUntil: suggestion.validUntil ? suggestion.validUntil.slice(0, 10) : '',
  reason: 'Sugerencia externa confirmada por el operador'
});

type CurrencyWriteApi = Pick<OperationApi, 'updateExchangeRate'>;

/** Único camino de persistencia: siempre UpdateExchangeRate, con motivo e idempotencia por intención. */
export const confirmManualRate = async (
  api: CurrencyWriteApi,
  pair: CurrencyPairQuery,
  form: ManualRateForm,
  idempotencyKey: string
): Promise<ExchangeRateResponse> => {
  const parsed = parseScaledDecimal(form.value);
  return api.updateExchangeRate({
    ...pair, rateValue: parsed.value, rateScale: parsed.scale, source: form.source.trim(),
    validFrom: new Date(form.validFrom).toISOString(),
    validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : null,
    reason: form.reason.trim()
  }, idempotencyKey);
};

export const CurrencyScreen = ({ api }: ScreenProps): React.JSX.Element => {
  const [baseCurrency, setBaseCurrency] = useState('USD'); const [quoteCurrency, setQuoteCurrency] = useState('VES'); const [historyLimit, setHistoryLimit] = useState('50'); const [reads, setReads] = useState<CurrencyPairReads | null>(null); const [suggestion, setSuggestion] = useState<ReportSection<ExchangeRateSuggestionResponse> | null>(null); const [manual, setManual] = useState<ManualRateForm>(EMPTY_MANUAL_FORM); const [error, setError] = useState<unknown>(null); const [notice, setNotice] = useState<string | null>(null); const [loading, setLoading] = useState(false);
  const pair = (): CurrencyPairQuery => ({ baseCurrency: baseCurrency.trim().toUpperCase(), quoteCurrency: quoteCurrency.trim().toUpperCase() });
  const query = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault(); setLoading(true); setNotice(null);
    setReads(await loadCurrentAndHistory(api, pair(), historyLimit.trim() ? Number(historyLimit) : undefined));
    setLoading(false);
  };
  const askSuggestion = async (): Promise<void> => {
    setLoading(true);
    setSuggestion(await loadSuggestion(api, pair()));
    setLoading(false);
  };
  const useSuggestion = (): void => {
    if (!suggestion?.ok) return;
    setManual(suggestionToManualForm(suggestion.value));
    setNotice('Sugerencia cargada en el formulario. Revisa los valores y confirma para registrarla.');
  };
  const discardSuggestion = (): void => setSuggestion(null);
  const updateManual = (key: keyof ManualRateForm) => (event: React.ChangeEvent<HTMLInputElement>): void =>
    setManual((current) => ({ ...current, [key]: event.target.value }));
  const submitManual = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault(); setLoading(true); setError(null); setNotice(null);
    try {
      await confirmManualRate(api, pair(), manual, createIdempotencyKey());
      setNotice('Tasa registrada.');
      setSuggestion(null);
      setReads(await loadCurrentAndHistory(api, pair(), historyLimit.trim() ? Number(historyLimit) : undefined));
    } catch (nextError) { setError(nextError); }
    finally { setLoading(false); }
  };
  const current = reads?.current; const history = reads?.history;
  return <div className="operation-screen"><SectionTitle eyebrow="9.07 · Moneda" title="Tasas de cambio" description="La tasa vigente y su histórico vienen de SQLite local. Una sugerencia externa es una propuesta efímera: solo se aplica tras confirmarla explícitamente." /><Feedback error={error} notice={notice} /><section className="panel"><p className="eyebrow">Par consultado</p><h3>Selecciona el par</h3><form className="inline-form" onSubmit={(event) => void query(event)}><label>Base<input value={baseCurrency} onChange={(event) => setBaseCurrency(event.target.value.toUpperCase())} maxLength={3} required /></label><label>Cotizada<input value={quoteCurrency} onChange={(event) => setQuoteCurrency(event.target.value.toUpperCase())} maxLength={3} required /></label><label>Filas del histórico<input type="number" min="1" max="500" value={historyLimit} onChange={(event) => setHistoryLimit(event.target.value)} placeholder="50" /></label><button className="primary-button" type="submit" disabled={loading}>Consultar tasa e histórico</button></form></section><section className="panel"><p className="eyebrow">Tasa vigente</p><h3>{baseCurrency}/{quoteCurrency}</h3>{!current ? <EmptyState>Consulta el par para ver la tasa vigente.</EmptyState> : current.ok ? <><dl className="detail-grid"><div><dt>Valor</dt><dd>{formatScaledDecimal(current.value.rateValue, current.value.rateScale)}</dd></div><div><dt>Fuente</dt><dd>{current.value.source}</dd></div><div><dt>Vigente desde</dt><dd>{new Date(current.value.validFrom).toLocaleString('es-VE')}</dd></div><div><dt>Antigüedad local</dt><dd>{ageLabel(current.value.validFrom)}</dd></div></dl><p className="muted">Antigüedad calculada con el reloj de esta estación; la sincronización entre nodos pertenece a la Fase 10.</p></> : <SectionError error={current.error} />}</section><section className="panel"><p className="eyebrow">Histórico local</p><h3>Registros del par</h3>{!history ? <EmptyState>Consulta el par para ver su histórico.</EmptyState> : history.ok ? (history.value.length === 0 ? <EmptyState>Sin registros históricos para este par todavía.</EmptyState> : <div className="table-wrap"><table><thead><tr><th>Vigente desde</th><th>Vigente hasta</th><th>Valor</th><th>Fuente</th><th>Registrado por</th></tr></thead><tbody>{history.value.map((entry) => <tr key={entry.id}><td>{new Date(entry.validFrom).toLocaleString('es-VE')}</td><td>{entry.validUntil ? new Date(entry.validUntil).toLocaleString('es-VE') : 'Sin cierre'}</td><td>{formatScaledDecimal(entry.rateValue, entry.rateScale)}</td><td>{entry.source}</td><td>{entry.registeredBy}</td></tr>)}</tbody></table></div>) : <SectionError error={history.error} />}</section><section className="panel"><p className="eyebrow">Sugerencia externa</p><h3>Propuesta efímera, no aplicada</h3><p className="muted">Solicitar o actualizar la sugerencia nunca registra una tasa; solo confirmar con el formulario de abajo lo hace.</p><div className="button-row"><button type="button" onClick={() => void askSuggestion()} disabled={loading}>{suggestion ? 'Actualizar sugerencia' : 'Solicitar sugerencia'}</button></div>{!suggestion ? <EmptyState>Sin sugerencia solicitada todavía.</EmptyState> : suggestion.ok ? <><dl className="detail-grid"><div><dt>Valor sugerido</dt><dd>{formatScaledDecimal(suggestion.value.rateValue, suggestion.value.rateScale)}</dd></div><div><dt>Fuente</dt><dd>{suggestion.value.source}</dd></div><div><dt>Observado</dt><dd>{new Date(suggestion.value.observedAt).toLocaleString('es-VE')}</dd></div><div><dt>Vigencia sugerida</dt><dd>{suggestion.value.validFrom ? new Date(suggestion.value.validFrom).toLocaleString('es-VE') : 'No especificada'}</dd></div></dl><span className="simulation-label">PROPUESTA · no es la tasa vigente</span><div className="button-row"><button className="primary-button" type="button" onClick={useSuggestion}>Usar en el formulario</button><button type="button" onClick={discardSuggestion}>Descartar</button></div></> : <p className="form-error" role="alert">{suggestionErrorLabel(suggestion.error)}</p>}</section><section className="panel"><p className="eyebrow">Carga manual</p><h3>Confirmar una tasa para {baseCurrency}/{quoteCurrency}</h3><form className="stack-form" onSubmit={(event) => void submitManual(event)}><label>Valor decimal<input inputMode="decimal" value={manual.value} onChange={updateManual('value')} placeholder="0,000" required /></label><label>Fuente<input value={manual.source} onChange={updateManual('source')} placeholder="Carga manual confirmada" required /></label><div className="form-grid"><label>Vigente desde<input type="date" value={manual.validFrom} onChange={updateManual('validFrom')} required /></label><label>Vigente hasta (opcional)<input type="date" value={manual.validUntil} onChange={updateManual('validUntil')} /></label></div><label>Motivo<input value={manual.reason} onChange={updateManual('reason')} required /></label><button className="primary-button" type="submit" disabled={loading}>Confirmar tasa</button></form><p className="muted">Ninguna tasa externa se aplica sola: confirmar siempre exige este formulario, motivo y autorización del servidor.</p></section></div>;
};

export const routeScreen = (routeId: string, props: ScreenProps): React.JSX.Element | null => {
  if (routeId === 'sales') return <SalesScreen {...props} />;
  if (routeId === 'cash') return <CashScreen {...props} />;
  if (routeId === 'catalog') return <CatalogScreen {...props} />;
  if (routeId === 'inventory') return <InventoryScreen {...props} />;
  if (routeId === 'reports') return <ReportsScreen {...props} />;
  if (routeId === 'rates') return <CurrencyScreen {...props} />;
  return null;
};
