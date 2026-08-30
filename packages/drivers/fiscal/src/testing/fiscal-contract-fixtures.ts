import type { FiscalDocumentPayload } from '@supermarket/core';
import type { FiscalFakeCommand } from '../fiscal-printer-fake.js';

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

export const fiscalInvoiceCommandFixture: readonly FiscalFakeCommand[] = [
  { name: 'OPEN', documentType: 'INVOICE', referenceId: 'sale-001' },
  { name: 'ITEM', lineId: 'line-001' },
  { name: 'PAYMENT', methodCode: 'CASH_USD' },
  { name: 'CLOSE', referenceId: 'sale-001' }
];

export const fiscalFailureFixtures = [
  ['NAK', 'FISCAL_PRINTER_NAK', 'REJECTED', false],
  ['PAPER_END', 'FISCAL_PRINTER_PAPER_END', 'NOT_SENT', true],
  ['MEMORY_FULL', 'FISCAL_PRINTER_MEMORY_FULL', 'REJECTED', false],
  ['BUSY', 'FISCAL_PRINTER_BUSY', 'NOT_SENT', true],
  ['TIMEOUT', 'FISCAL_PRINTER_TIMEOUT', 'UNKNOWN', true],
  ['CRC_ERROR', 'FISCAL_PRINTER_CRC_ERROR', 'UNKNOWN', true],
  ['PORT_CLOSED', 'FISCAL_PRINTER_PORT_CLOSED', 'NOT_SENT', true]
] as const;
