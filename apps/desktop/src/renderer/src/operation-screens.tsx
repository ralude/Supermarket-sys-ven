/**
 * Fachada de re-exportación. Cada pantalla vive en su propio módulo bajo
 * `./screens/`; este archivo solo compone la navegación por identificador de
 * ruta y conserva la superficie pública que ya consumían `App.tsx` y las
 * pruebas, sin lógica propia.
 */
import { CashScreen } from './screens/cash.js';
import { CatalogScreen } from './screens/catalog.js';
import { CurrencyScreen } from './screens/currency.js';
import { InventoryScreen } from './screens/inventory.js';
import { ReportsScreen } from './screens/reports.js';
import { SalesScreen } from './screens/sales.js';
import { SuppliersScreen } from './screens/suppliers.js';
import type { ScreenProps } from './screens/shared.js';

export const routeScreen = (routeId: string, props: ScreenProps): React.JSX.Element | null => {
  if (routeId === 'sales') return <SalesScreen {...props} />;
  if (routeId === 'cash') return <CashScreen {...props} />;
  if (routeId === 'catalog') return <CatalogScreen {...props} />;
  if (routeId === 'inventory') return <InventoryScreen {...props} />;
  if (routeId === 'suppliers') return <SuppliersScreen {...props} />;
  if (routeId === 'reports') return <ReportsScreen {...props} />;
  if (routeId === 'rates') return <CurrencyScreen {...props} />;
  return null;
};

export { money } from './screens/shared.js';
export type { ReportSection } from './screens/shared.js';
export { saleCompletionBlocker, SalesScreen } from './screens/sales.js';
export { CashScreen } from './screens/cash.js';
export { CatalogScreen } from './screens/catalog.js';
export { filterSuppliers, InventoryScreen } from './screens/inventory.js';
export {
  SuppliersScreen, canManageSuppliers, supplierUpdatePayload, toSupplierForm,
  SUPPLIER_STATUS_LABELS, type SupplierForm
} from './screens/suppliers.js';
export {
  ReportsScreen, loadOperationalReports, toCsv, toReportQuery, type OperationalReports
} from './screens/reports.js';
export {
  CurrencyScreen, ageLabel, confirmManualRate, loadCurrentAndHistory, loadSuggestion,
  suggestionToManualForm, type CurrencyPairReads, type ManualRateForm
} from './screens/currency.js';
