import { describe, expect, it } from 'vitest';
import { FiscalPrinterFake } from './fiscal-printer-fake.js';
import { fiscalInvoiceFixture } from './testing/fiscal-contract-fixtures.js';
import { runFiscalPrinterContract } from './testing/fiscal-printer-contract.js';

runFiscalPrinterContract('FiscalPrinterFake', () => {
  const printer = new FiscalPrinterFake();
  return {
    printer,
    commands: () => printer.commands,
    queueResponses: (...responses) => printer.queueResponses(...responses),
    closePort: () => printer.closePort(),
    openPort: () => printer.openPort()
  };
});

describe('FiscalPrinterFake', () => {
  it('implements the complete fiscal printer port with deterministic ACK responses', async () => {
    const printer = new FiscalPrinterFake({
      now: () => new Date('2026-08-30T10:00:00.000Z')
    });

    expect((await printer.getStatus()).ok).toBe(true);
    expect(await printer.printInvoice(fiscalInvoiceFixture)).toMatchObject({
      ok: true,
      value: { fiscalNumber: 'INV-000001' }
    });
    expect(printer.commands.map(({ name }) => name))
      .toEqual(['OPEN', 'ITEM', 'PAYMENT', 'CLOSE']);

    expect(await printer.printCreditNote({
      ...fiscalInvoiceFixture,
      referenceId: 'credit-001',
      type: 'CREDIT_NOTE'
    })).toMatchObject({ ok: true, value: { fiscalNumber: 'NC-000002' } });
    expect(await printer.printXReport()).toMatchObject({
      ok: true, value: { reportNumber: 'X-000001' }
    });
    expect(await printer.printZReport()).toMatchObject({
      ok: true, value: { reportNumber: 'Z-000001' }
    });
  });

});
