import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { DesktopApi, OperationApi } from './api-client.js';
import { SalesScreen, CashScreen, CatalogScreen, InventoryScreen, ReportsScreen } from './operation-screens.js';

const operationApi = (): OperationApi => {
  const base: DesktopApi = {
    currentSession: async () => ({ actorId: 'actor', displayName: 'Operador', roleCodes: ['cashier'], idleExpiresAt: '', absoluteExpiresAt: '' }),
    login: async () => { throw new Error('unused'); },
    logout: async () => undefined,
    capabilities: async () => ({ fiscalMode: 'SIMULATION', simulatedReportsEnabled: false })
  };
  return Object.assign(base, {
    getSale: vi.fn(), startSale: vi.fn(), addSaleItem: vi.fn(), removeSaleItem: vi.fn(),
    applySaleDiscount: vi.fn(), registerSalePayments: vi.fn(), completeSale: vi.fn(), voidSale: vi.fn(),
    getOpenShift: vi.fn(), openShift: vi.fn(), registerCashMovement: vi.fn(), closeShift: vi.fn(),
    findProductByBarcode: vi.fn(), listProducts: vi.fn(), getPriceHistory: vi.fn(), createProduct: vi.fn(), updatePrice: vi.fn(), getKardex: vi.fn(),
    receivePurchase: vi.fn(), registerStockAdjustment: vi.fn(), getCurrentExchangeRate: vi.fn(), getExchangeRateHistory: vi.fn(), getSuggestedExchangeRate: vi.fn(), updateExchangeRate: vi.fn(), printXReport: vi.fn(), printZReport: vi.fn()
  }) as OperationApi;
};

describe('operation screens', () => {
  const props = () => ({ api: operationApi(), capabilities: { fiscalMode: 'SIMULATION' as const, simulatedReportsEnabled: false } });

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
});
