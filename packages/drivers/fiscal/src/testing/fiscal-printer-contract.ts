import { describe, expect, it } from 'vitest';
import type { FiscalPrinterPort } from '@supermarket/core';
import type {
  FiscalFakeCommand,
  FiscalFakeResponse
} from '../fiscal-printer-fake.js';
import {
  fiscalFailureFixtures,
  fiscalInvoiceCommandFixture,
  fiscalInvoiceFixture
} from './fiscal-contract-fixtures.js';

export type FiscalPrinterContractHarness = {
  readonly printer: FiscalPrinterPort;
  readonly commands: () => readonly FiscalFakeCommand[];
  readonly queueResponses: (...responses: FiscalFakeResponse[]) => void;
  readonly closePort: () => void;
  readonly openPort: () => void;
};

export function runFiscalPrinterContract(
  adapterName: string,
  createHarness: () => FiscalPrinterContractHarness
): void {
  describe(`${adapterName} fiscal printer contract`, () => {
    it('sends OPEN, ITEM, PAYMENT and CLOSE using the canonical command fixture', async () => {
      const harness = createHarness();

      expect(await harness.printer.printInvoice(fiscalInvoiceFixture)).toMatchObject({
        ok: true,
        value: { fiscalNumber: 'INV-000001' }
      });
      expect(harness.commands()).toEqual(fiscalInvoiceCommandFixture);
    });

    it.each(fiscalFailureFixtures)(
      'maps %s to the stable fiscal failure contract',
      async (response, code, certainty, retryable) => {
        const harness = createHarness();
        harness.queueResponses(response);

        expect(await harness.printer.printInvoice(fiscalInvoiceFixture)).toMatchObject({
          ok: false,
          error: { code, certainty, retryable }
        });
        expect(harness.commands()).toHaveLength(1);
      }
    );

    it('recovers after the port is reopened and reports the confirmed document', async () => {
      const harness = createHarness();
      harness.closePort();
      expect(await harness.printer.getStatus()).toMatchObject({
        ok: false,
        error: { code: 'FISCAL_PRINTER_PORT_CLOSED' }
      });

      harness.openPort();
      expect((await harness.printer.printInvoice(fiscalInvoiceFixture)).ok).toBe(true);
      expect(await harness.printer.getStatus()).toMatchObject({
        ok: true,
        value: {
          lastDocumentReferenceId: 'sale-001',
          lastDocumentNumber: 'INV-000001'
        }
      });
    });
  });
}
