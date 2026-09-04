import {
  applySaleDiscountContract,
  closeShiftContract,
  changeSupplierStatusContract,
  correctSupplierTaxIdentityContract,
  createProductContract,
  createSupplierContract,
  getAuditReportContract,
  getCashClosureReportContract,
  getFiscalOperationsReportContract,
  issueSimulatedFiscalDocumentContract,
  openShiftContract,
  printSimulatedXReportContract,
  printSimulatedZReportContract,
  receivePurchaseContract,
  reconcileSimulatedFiscalDocumentContract,
  registerCashMovementContract,
  registerStockAdjustmentContract,
  updateExchangeRateContract,
  updatePriceContract,
  updateProductContract,
  updateSupplierContract,
  voidSaleContract,
  type HttpContractV1
} from '@supermarket/shared';
import { application } from '@supermarket/core';
import { describe, expect, it } from 'vitest';

/**
 * Cruza el permiso que cada contrato HTTP declara con la constante que su
 * caso de uso realmente exige. El campo `permission` de un contrato no lo lee
 * ningún transporte: sin esta prueba puede desviarse en silencio de la regla
 * real de autorización y la interfaz ofrecería una acción que el servidor
 * rechazaría, o esconder una que sí está permitida.
 */
const expectedPermission = (contract: HttpContractV1, ...permissions: readonly string[]): void => {
  expect(contract.permission).toBe(permissions.join('|'));
};

describe('el permiso declarado por cada contrato coincide con el que su caso de uso exige', () => {
  it('caja', () => {
    expectedPermission(openShiftContract, application.CASH_PERMISSIONS.OPEN_SHIFT);
    expectedPermission(
      registerCashMovementContract,
      application.CASH_PERMISSIONS.REGISTER_INCOME,
      application.CASH_PERMISSIONS.REGISTER_WITHDRAWAL
    );
    expectedPermission(closeShiftContract, application.CASH_PERMISSIONS.CLOSE_SHIFT);
  });

  it('catalogo', () => {
    expectedPermission(createProductContract, application.CATALOG_PERMISSIONS.CREATE_PRODUCT);
    expectedPermission(updateProductContract, application.CATALOG_PERMISSIONS.UPDATE_PRODUCT);
    expectedPermission(updatePriceContract, application.CATALOG_PERMISSIONS.UPDATE_PRICE);
  });

  it('moneda', () => {
    expectedPermission(updateExchangeRateContract, application.CURRENCY_PERMISSIONS.UPDATE_RATE);
  });

  it('fiscal', () => {
    expectedPermission(issueSimulatedFiscalDocumentContract, application.FISCAL_PERMISSIONS.ISSUE_DOCUMENT);
    expectedPermission(reconcileSimulatedFiscalDocumentContract, application.FISCAL_PERMISSIONS.RECONCILE);
    expectedPermission(printSimulatedXReportContract, application.FISCAL_PERMISSIONS.PRINT_X_REPORT);
    expectedPermission(printSimulatedZReportContract, application.FISCAL_PERMISSIONS.PRINT_Z_REPORT);
  });

  it('inventario', () => {
    expectedPermission(receivePurchaseContract, application.INVENTORY_PERMISSIONS.RECEIVE_PURCHASE);
    expectedPermission(
      registerStockAdjustmentContract,
      application.INVENTORY_PERMISSIONS.REGISTER_WASTE,
      application.INVENTORY_PERMISSIONS.REGISTER_ADJUSTMENT
    );
  });

  it('reportes', () => {
    expectedPermission(getCashClosureReportContract, application.REPORT_PERMISSIONS.READ_CASH);
    expectedPermission(getAuditReportContract, application.REPORT_PERMISSIONS.READ_AUDIT);
    expectedPermission(getFiscalOperationsReportContract, application.REPORT_PERMISSIONS.READ_FISCAL);
  });

  it('proveedores', () => {
    expectedPermission(createSupplierContract, application.SUPPLIER_PERMISSIONS.CREATE);
    expectedPermission(updateSupplierContract, application.SUPPLIER_PERMISSIONS.UPDATE);
    expectedPermission(changeSupplierStatusContract, application.SUPPLIER_PERMISSIONS.UPDATE);
    expectedPermission(
      correctSupplierTaxIdentityContract,
      application.SUPPLIER_PERMISSIONS.CORRECT_TAX_IDENTITY
    );
  });

  it('venta', () => {
    expectedPermission(applySaleDiscountContract, application.SALE_PERMISSIONS.APPLY_DISCOUNT);
    expectedPermission(voidSaleContract, application.SALE_PERMISSIONS.VOID);
  });
});
