import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { DesktopApi, OperationApi } from './api-client.js';
import {
  SalesScreen, CashScreen, CatalogScreen, InventoryScreen, ReportsScreen, money, saleCompletionBlocker
} from './operation-screens.js';
import type { SaleResponse } from '@supermarket/shared';

const draftSale = (overrides: Partial<SaleResponse> = {}): SaleResponse => ({
  id: 'sale-1', status: 'DRAFT', currencyCode: 'VES', scale: 2,
  subtotalMinorUnits: 10000, discountTotalMinorUnits: 0, taxTotalMinorUnits: 1600,
  totalMinorUnits: 11600, paidTotalMinorUnits: 0, balanceMinorUnits: 11600,
  items: [], payments: [], ...overrides
} as SaleResponse);

const operationApi = (): OperationApi => {
  const base: DesktopApi = {
    currentSession: async () => ({
      actorId: 'actor', displayName: 'Operador', roleCodes: ['cashier'], permissionCodes: [],
      idleExpiresAt: '', absoluteExpiresAt: ''
    }),
    login: async () => { throw new Error('unused'); },
    logout: async () => undefined,
    capabilities: async () => ({ fiscalMode: 'SIMULATION', simulatedReportsEnabled: false })
  };
  return Object.assign(base, {
    getSale: vi.fn(), startSale: vi.fn(), addSaleItem: vi.fn(), removeSaleItem: vi.fn(),
    applySaleDiscount: vi.fn(), registerSalePayments: vi.fn(), completeSale: vi.fn(), voidSale: vi.fn(),
    getOpenShift: vi.fn(), openShift: vi.fn(), registerCashMovement: vi.fn(), closeShift: vi.fn(),
    findProductByBarcode: vi.fn(), listProducts: vi.fn(), getPriceHistory: vi.fn(), createProduct: vi.fn(), updatePrice: vi.fn(), getKardex: vi.fn(),
    receivePurchase: vi.fn(), registerStockAdjustment: vi.fn(), getCurrentExchangeRate: vi.fn(), getExchangeRateHistory: vi.fn(), getSuggestedExchangeRate: vi.fn(), updateExchangeRate: vi.fn(), printXReport: vi.fn(), printZReport: vi.fn(), listCategories: vi.fn(), listUnitsOfMeasure: vi.fn(), listPaymentMethods: vi.fn(), listCashRegisters: vi.fn()
  }) as OperationApi;
};

describe('operation screens', () => {
  const props = (permissionCodes: readonly string[] = []) => ({
    api: operationApi(), capabilities: { fiscalMode: 'SIMULATION' as const, simulatedReportsEnabled: false },
    permissionCodes
  });

  it('exposes the sale flow without client-side business totals', () => {
    const markup = renderToStaticMarkup(<SalesScreen {...props()} />);
    expect(markup).toContain('Abrir carrito');
    expect(markup).toContain('Turno activo');
    expect(markup).toContain('No se aceptan cálculos locales');
  });

  it('exposes cash, catalog, inventory and report operations', () => {
    expect(renderToStaticMarkup(<CashScreen {...props()} />)).toContain('Abrir caja');
    expect(renderToStaticMarkup(<CatalogScreen {...props()} />)).toContain('Buscar');
    expect(renderToStaticMarkup(<InventoryScreen {...props()} />)).toContain('Consultar kardex');
    expect(renderToStaticMarkup(<ReportsScreen {...props()} />)).toContain('deshabilitados');
  });

  it('names the reason why a sale cannot be completed yet', () => {
    expect(saleCompletionBlocker(null, 2)).toBeNull();
    expect(saleCompletionBlocker(draftSale(), 2)).toContain('Agrega al menos una línea');

    const withItem = draftSale({ items: [{ id: 'item-1' }] as unknown as SaleResponse['items'] });
    expect(saleCompletionBlocker(withItem, 2)).toContain('Falta cobrar');
    expect(saleCompletionBlocker({ ...withItem, balanceMinorUnits: -500 }, 2)).toContain('supera el total');
    expect(saleCompletionBlocker({ ...withItem, balanceMinorUnits: 0 }, 2)).toBeNull();
    expect(saleCompletionBlocker({ ...withItem, status: 'COMPLETED' } as SaleResponse, 2)).toBeNull();
  });

  it('formats money without throwing on codes Intl does not know', () => {
    expect(money(11600, 'VES', 2)).toContain('116');
    expect(money(11600, 'xx', 2)).toContain('XX');
    expect(() => money(11600, '', 2)).not.toThrow();
  });
});
