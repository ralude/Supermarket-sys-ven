import { describe, expect, it } from 'vitest';
import {
  FiscalPrinterFake,
  type FiscalFakeCommand,
  type FiscalFakeResponse
} from './fiscal-printer-fake.js';
import {
  fiscalCreditNoteFixture,
  fiscalInvoiceFixture
} from './testing/fiscal-contract-fixtures.js';
import {
  runFiscalPrinterSimulatorContract,
  runFiscalPrinterSimulatorReportContract
} from './testing/fiscal-printer-contract.js';

const fiscalInvoiceCommandFixture: readonly FiscalFakeCommand[] = [
  { name: 'OPEN', documentType: 'INVOICE', referenceId: 'sale-001' },
  { name: 'ITEM', lineId: 'line-001' },
  { name: 'PAYMENT', methodCode: 'CASH_USD' },
  { name: 'CLOSE', referenceId: 'sale-001' }
];

const committedEvidence = {
  dispatchState: 'RESULT_RECEIVED', commandEffect: 'APPLIED',
  fiscalCommit: 'COMMITTED', printDelivery: 'COMPLETE'
} as const;

const fiscalFailureFixtures = [
  ['NAK', 'FISCAL_PRINTER_NAK', {
    dispatchState: 'RESULT_RECEIVED', commandEffect: 'REJECTED',
    fiscalCommit: 'NOT_COMMITTED', printDelivery: 'INCOMPLETE'
  }, false],
  ['PAPER_END', 'FISCAL_PRINTER_PAPER_END', {
    dispatchState: 'RESULT_RECEIVED', commandEffect: 'NOT_APPLIED',
    fiscalCommit: 'NOT_COMMITTED', printDelivery: 'INCOMPLETE'
  }, true],
  ['MEMORY_FULL', 'FISCAL_PRINTER_MEMORY_FULL', {
    dispatchState: 'RESULT_RECEIVED', commandEffect: 'REJECTED',
    fiscalCommit: 'NOT_COMMITTED', printDelivery: 'INCOMPLETE'
  }, false],
  ['BUSY', 'FISCAL_PRINTER_BUSY', {
    dispatchState: 'RESULT_RECEIVED', commandEffect: 'NOT_APPLIED',
    fiscalCommit: 'NOT_COMMITTED', printDelivery: 'INCOMPLETE'
  }, true],
  ['TIMEOUT', 'FISCAL_PRINTER_TIMEOUT', {
    dispatchState: 'STARTED', commandEffect: 'UNKNOWN',
    fiscalCommit: 'NOT_COMMITTED', printDelivery: 'UNKNOWN'
  }, true],
  ['CRC_ERROR', 'FISCAL_PRINTER_CRC_ERROR', {
    dispatchState: 'STARTED', commandEffect: 'UNKNOWN',
    fiscalCommit: 'NOT_COMMITTED', printDelivery: 'UNKNOWN'
  }, true],
  ['PORT_CLOSED', 'FISCAL_PRINTER_PORT_CLOSED', {
    dispatchState: 'NOT_STARTED', commandEffect: 'NOT_APPLIED',
    fiscalCommit: 'NOT_COMMITTED', printDelivery: 'INCOMPLETE'
  }, true]
] as const satisfies ReadonlyArray<readonly [FiscalFakeResponse, string, object, boolean]>;

runFiscalPrinterSimulatorContract<FiscalPrinterFake>('FiscalPrinterFake', () => ({
  executionTarget: 'SIMULATOR',
  printer: new FiscalPrinterFake(),
  failureScenarios: fiscalFailureFixtures.map(([response, code, evidence, retryable]) => ({
    name: response,
    operation: 'PRINT_INVOICE',
    arrange: (printer) => {
      printer.queueResponses(response);
    },
    expected: { code, evidence, retryable }
  })),
  committedDeliveryScenarios: [{
    name: 'invoice committed with incomplete paper delivery',
    operation: 'PRINT_INVOICE',
    arrange: (printer) => printer.queuePrintDeliveries('INCOMPLETE'),
    expectedDelivery: 'INCOMPLETE'
  }, {
    name: 'credit note committed with unknown paper delivery',
    operation: 'PRINT_CREDIT_NOTE',
    arrange: (printer) => printer.queuePrintDeliveries('UNKNOWN'),
    expectedDelivery: 'UNKNOWN'
  }]
}));

runFiscalPrinterSimulatorReportContract<FiscalPrinterFake>('FiscalPrinterFake', () => ({
  executionTarget: 'SIMULATOR',
  simulatedReportExecution: 'ALLOW_SIMULATED_X_AND_Z',
  printer: new FiscalPrinterFake(),
  failureScenarios: [{
    name: 'X timeout leaves fiscal commit unknown',
    operation: 'X_REPORT',
    arrange: (printer) => printer.queueResponses('TIMEOUT'),
    expected: {
      code: 'FISCAL_PRINTER_TIMEOUT', retryable: true,
      evidence: {
        dispatchState: 'STARTED', commandEffect: 'UNKNOWN',
        fiscalCommit: 'UNKNOWN', printDelivery: 'UNKNOWN'
      }
    }
  }, {
    name: 'Z CRC leaves fiscal commit unknown',
    operation: 'Z_REPORT',
    arrange: (printer) => printer.queueResponses('CRC_ERROR'),
    expected: {
      code: 'FISCAL_PRINTER_CRC_ERROR', retryable: true,
      evidence: {
        dispatchState: 'RESULT_RECEIVED', commandEffect: 'UNKNOWN',
        fiscalCommit: 'UNKNOWN', printDelivery: 'UNKNOWN'
      }
    }
  }],
  committedDeliveryScenarios: [{
    name: 'X committed with incomplete paper delivery',
    operation: 'X_REPORT',
    arrange: (printer) => printer.queuePrintDeliveries('INCOMPLETE'),
    expectedDelivery: 'INCOMPLETE'
  }, {
    name: 'Z committed with unknown paper delivery',
    operation: 'Z_REPORT',
    arrange: (printer) => printer.queuePrintDeliveries('UNKNOWN'),
    expectedDelivery: 'UNKNOWN'
  }]
}));

describe('FiscalPrinterFake', () => {
  it('implements the complete fiscal printer port with deterministic ACK responses', async () => {
    const printer = new FiscalPrinterFake({
      now: () => new Date('2026-08-30T10:00:00.000Z')
    });

    expect((await printer.getStatus()).ok).toBe(true);
    expect(await printer.printInvoice(fiscalInvoiceFixture)).toMatchObject({
      ok: true,
      value: { fiscalNumber: 'INV-000001', evidence: committedEvidence }
    });
    expect(printer.commands.map(({ name }) => name))
      .toEqual(['OPEN', 'ITEM', 'PAYMENT', 'CLOSE']);

    expect(await printer.printCreditNote({
      ...fiscalCreditNoteFixture
    })).toMatchObject({
      ok: true, value: { fiscalNumber: 'NC-000002', evidence: committedEvidence }
    });
    expect(await printer.printXReport()).toMatchObject({
      ok: true, value: { reportNumber: 'X-000001', evidence: committedEvidence }
    });
    expect(await printer.printZReport()).toMatchObject({
      ok: true, value: { reportNumber: 'Z-000001', evidence: committedEvidence }
    });
  });

  it('records the fake OPEN, ITEM, PAYMENT and CLOSE transcript exactly', async () => {
    const printer = new FiscalPrinterFake();

    await printer.printInvoice(fiscalInvoiceFixture);

    expect(printer.commands).toEqual(fiscalInvoiceCommandFixture);
  });

  it.each(fiscalFailureFixtures)(
    'stops its private transcript after the injected %s response',
    async (response) => {
      const printer = new FiscalPrinterFake();
      printer.queueResponses(response);

      await printer.printInvoice(fiscalInvoiceFixture);

      expect(printer.commands).toEqual([
        { name: 'OPEN', documentType: 'INVOICE', referenceId: 'sale-001' }
      ]);
    }
  );

  it('keeps fake port controls and deterministic numbering out of the generic contract', async () => {
    const printer = new FiscalPrinterFake();
    printer.closePort();

    expect(await printer.getStatus()).toMatchObject({
      ok: false,
      error: {
        code: 'FISCAL_PRINTER_PORT_CLOSED',
        evidence: {
          dispatchState: 'NOT_STARTED', commandEffect: 'NOT_APPLIED',
          fiscalCommit: 'NOT_COMMITTED', printDelivery: 'INCOMPLETE'
        }
      }
    });

    printer.openPort();
    expect(await printer.printInvoice(fiscalInvoiceFixture)).toMatchObject({
      ok: true,
      value: { fiscalNumber: 'INV-000001' }
    });
  });

  it.each(['TIMEOUT', 'CRC_ERROR'] as const)(
    'reports a committed document with unknown print delivery when CLOSE ends in %s',
    async (response) => {
      const printer = new FiscalPrinterFake();
      printer.queueResponses('ACK', 'ACK', 'ACK', response);

      expect(await printer.printInvoice(fiscalInvoiceFixture)).toMatchObject({
        ok: false,
        error: {
          evidence: {
            commandEffect: 'APPLIED',
            fiscalCommit: 'COMMITTED',
            printDelivery: 'UNKNOWN'
          }
        }
      });
      expect(await printer.getStatus()).toMatchObject({
        ok: true,
        value: {
          lastDocumentReferenceId: 'sale-001',
          lastDocumentNumber: 'INV-000001'
        }
      });
    }
  );
});
