import type { FiscalDocumentPayload } from '@supermarket/core';

export const fiscalInvoiceFixture: FiscalDocumentPayload = {
  referenceId: 'sale-001',
  type: 'INVOICE',
  currencyCode: 'USD',
  lines: [{
    id: 'line-001',
    description: 'Coffee',
    quantityScaled: 2,
    quantityScale: 0,
    unitPriceMinorUnits: 500,
    taxRateBasisPoints: 1600,
    totalMinorUnits: 1_160
  }],
  payments: [{ methodCode: 'CASH_USD', amountMinorUnits: 1_160 }],
  totalMinorUnits: 1_160
};

export const fiscalCreditNoteFixture: FiscalDocumentPayload = {
  ...fiscalInvoiceFixture,
  referenceId: 'credit-001',
  type: 'CREDIT_NOTE'
};
