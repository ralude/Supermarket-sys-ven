import { describe, expect, it } from 'vitest';
import type {
  FiscalPrinterFailure,
  FiscalPrinterPort,
  FiscalPrinterResult,
  FiscalPrintDelivery
} from '@supermarket/core';
import {
  fiscalCreditNoteFixture,
  fiscalInvoiceFixture
} from './fiscal-contract-fixtures.js';
import {
  withFiscalSimulatorGuard,
  withSimulatedFiscalReportGuard
} from './fiscal-simulator-guard.js';

export type FiscalPrinterSimulatorFailureOperation =
  | 'GET_STATUS'
  | 'PRINT_INVOICE'
  | 'PRINT_CREDIT_NOTE';

export type FiscalPrinterSimulatorFailureScenario<
  TPrinter extends FiscalPrinterPort
> = {
  readonly name: string;
  readonly operation: FiscalPrinterSimulatorFailureOperation;
  readonly arrange: (printer: TPrinter) => void | Promise<void>;
  readonly expected: Pick<FiscalPrinterFailure, 'code' | 'evidence' | 'retryable'>;
};

export type FiscalPrinterSimulatorContractHarness<
  TPrinter extends FiscalPrinterPort
> = {
  readonly executionTarget: 'SIMULATOR';
  readonly printer: TPrinter;
  readonly failureScenarios: readonly FiscalPrinterSimulatorFailureScenario<TPrinter>[];
  readonly committedDeliveryScenarios: readonly {
    readonly name: string;
    readonly operation: 'PRINT_INVOICE' | 'PRINT_CREDIT_NOTE';
    readonly arrange: (printer: TPrinter) => void | Promise<void>;
    readonly expectedDelivery: Exclude<FiscalPrintDelivery, 'COMPLETE'>;
  }[];
};

export type FiscalPrinterSimulatorReportContractHarness<
  TPrinter extends FiscalPrinterPort
> = {
  readonly executionTarget: 'SIMULATOR';
  readonly simulatedReportExecution: 'ALLOW_SIMULATED_X_AND_Z';
  readonly printer: TPrinter;
  readonly failureScenarios: readonly {
    readonly name: string;
    readonly operation: 'X_REPORT' | 'Z_REPORT';
    readonly arrange: (printer: TPrinter) => void | Promise<void>;
    readonly expected: Pick<FiscalPrinterFailure, 'code' | 'evidence' | 'retryable'>;
  }[];
  readonly committedDeliveryScenarios: readonly {
    readonly name: string;
    readonly operation: 'X_REPORT' | 'Z_REPORT';
    readonly arrange: (printer: TPrinter) => void | Promise<void>;
    readonly expectedDelivery: Exclude<FiscalPrintDelivery, 'COMPLETE'>;
  }[];
};

const expectValidConfirmation = (
  confirmation: { readonly confirmedAt: Date },
  identifier: string
): void => {
  expect(identifier.trim()).not.toBe('');
  expect(confirmation.confirmedAt).toBeInstanceOf(Date);
  expect(Number.isNaN(confirmation.confirmedAt.getTime())).toBe(false);
  expect(confirmation).toMatchObject({
    evidence: {
      dispatchState: 'RESULT_RECEIVED',
      commandEffect: 'APPLIED',
      fiscalCommit: 'COMMITTED',
      printDelivery: 'COMPLETE'
    }
  });
};

const executeFailureOperation = async (
  printer: FiscalPrinterPort,
  operation: FiscalPrinterSimulatorFailureOperation
): Promise<FiscalPrinterResult<unknown>> => {
  switch (operation) {
    case 'GET_STATUS':
      return printer.getStatus();
    case 'PRINT_INVOICE':
      return printer.printInvoice(fiscalInvoiceFixture);
    case 'PRINT_CREDIT_NOTE':
      return printer.printCreditNote(fiscalCreditNoteFixture);
  }
};

const executeReportOperation = (
  printer: FiscalPrinterPort,
  operation: 'X_REPORT' | 'Z_REPORT'
) => operation === 'X_REPORT' ? printer.printXReport() : printer.printZReport();

export function runFiscalPrinterSimulatorContract<
  TPrinter extends FiscalPrinterPort
>(
  adapterName: string,
  createHarness: () => FiscalPrinterSimulatorContractHarness<TPrinter>
): void {
  describe(`${adapterName} fiscal printer simulator contract`, () => {
    it('reports public operational status without claiming profile compatibility', async () => {
      const harness = createHarness();
      const status = await withFiscalSimulatorGuard(
        harness.executionTarget,
        () => harness.printer.getStatus()
      );

      expect(status).toMatchObject({
        ok: true,
        value: {
          connection: 'OPEN',
          state: 'IDLE',
          paperAvailable: true,
          memoryAvailable: true
        }
      });
    });

    it('prints a simulated invoice and exposes its confirmation through status', async () => {
      const harness = createHarness();
      const result = await withFiscalSimulatorGuard(
        harness.executionTarget,
        () => harness.printer.printInvoice(fiscalInvoiceFixture)
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expectValidConfirmation(result.value, result.value.fiscalNumber);
      const status = await withFiscalSimulatorGuard(
        harness.executionTarget,
        () => harness.printer.getStatus()
      );
      expect(status).toMatchObject({
        ok: true,
        value: {
          lastDocumentReferenceId: fiscalInvoiceFixture.referenceId,
          lastDocumentNumber: result.value.fiscalNumber
        }
      });
    });

    it('prints a simulated credit note and exposes its confirmation through status', async () => {
      const harness = createHarness();
      const result = await withFiscalSimulatorGuard(
        harness.executionTarget,
        () => harness.printer.printCreditNote(fiscalCreditNoteFixture)
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expectValidConfirmation(result.value, result.value.fiscalNumber);
      const status = await withFiscalSimulatorGuard(
        harness.executionTarget,
        () => harness.printer.getStatus()
      );
      expect(status).toMatchObject({
        ok: true,
        value: {
          lastDocumentReferenceId: fiscalCreditNoteFixture.referenceId,
          lastDocumentNumber: result.value.fiscalNumber
        }
      });
    });

    it('requires non-empty stable failures arranged on the harness printer', async () => {
      const manifest = createHarness();
      withFiscalSimulatorGuard(manifest.executionTarget, () => {
        expect(manifest.failureScenarios.length).toBeGreaterThan(0);
      });

      for (let index = 0; index < manifest.failureScenarios.length; index += 1) {
        const harness = createHarness();
        const scenario = harness.failureScenarios[index];
        expect(scenario).toBeDefined();
        if (!scenario) continue;

        const result = await withFiscalSimulatorGuard(
          harness.executionTarget,
          async () => {
            await scenario.arrange(harness.printer);
            return executeFailureOperation(harness.printer, scenario.operation);
          }
        );

        expect(result, scenario.name).toMatchObject({
          ok: false,
          error: scenario.expected
        });
        if (result.ok) continue;
        expect(result.error.message.trim(), scenario.name).not.toBe('');
      }
    });

    it('accepts committed documents with incomplete or unknown print delivery', async () => {
      const manifest = createHarness();
      withFiscalSimulatorGuard(manifest.executionTarget, () => {
        expect(manifest.committedDeliveryScenarios.length).toBeGreaterThan(0);
      });

      for (let index = 0; index < manifest.committedDeliveryScenarios.length; index += 1) {
        const harness = createHarness();
        const scenario = harness.committedDeliveryScenarios[index];
        expect(scenario).toBeDefined();
        if (!scenario) continue;
        const result = await withFiscalSimulatorGuard(
          harness.executionTarget,
          async () => {
            await scenario.arrange(harness.printer);
            return executeFailureOperation(harness.printer, scenario.operation);
          }
        );

        expect(result, scenario.name).toMatchObject({
          ok: true,
          value: {
            evidence: {
              commandEffect: 'APPLIED',
              fiscalCommit: 'COMMITTED',
              printDelivery: scenario.expectedDelivery
            }
          }
        });
      }
    });
  });
}

export function runFiscalPrinterSimulatorReportContract<
  TPrinter extends FiscalPrinterPort
>(
  adapterName: string,
  createHarness: () => FiscalPrinterSimulatorReportContractHarness<TPrinter>
): void {
  describe(`${adapterName} fiscal report simulator contract`, () => {
    it('prints a simulated X report with a valid confirmation', async () => {
      const harness = createHarness();
      const result = await withSimulatedFiscalReportGuard(
        harness.executionTarget,
        harness.simulatedReportExecution,
        () => harness.printer.printXReport()
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expectValidConfirmation(result.value, result.value.reportNumber);
    });

    it('prints a simulated Z report with a valid confirmation', async () => {
      const harness = createHarness();
      const result = await withSimulatedFiscalReportGuard(
        harness.executionTarget,
        harness.simulatedReportExecution,
        () => harness.printer.printZReport()
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expectValidConfirmation(result.value, result.value.reportNumber);
    });

    it('requires report-specific ambiguous failure scenarios', async () => {
      const manifest = createHarness();
      withSimulatedFiscalReportGuard(
        manifest.executionTarget,
        manifest.simulatedReportExecution,
        () => expect(manifest.failureScenarios.length).toBeGreaterThan(0)
      );

      for (let index = 0; index < manifest.failureScenarios.length; index += 1) {
        const harness = createHarness();
        const scenario = harness.failureScenarios[index];
        expect(scenario).toBeDefined();
        if (!scenario) continue;
        const result = await withSimulatedFiscalReportGuard(
          harness.executionTarget,
          harness.simulatedReportExecution,
          async () => {
            await scenario.arrange(harness.printer);
            return executeReportOperation(harness.printer, scenario.operation);
          }
        );

        expect(result, scenario.name).toMatchObject({
          ok: false,
          error: scenario.expected
        });
      }
    });

    it('accepts committed reports with incomplete or unknown print delivery', async () => {
      const manifest = createHarness();
      withSimulatedFiscalReportGuard(
        manifest.executionTarget,
        manifest.simulatedReportExecution,
        () => expect(manifest.committedDeliveryScenarios.length).toBeGreaterThan(0)
      );

      for (let index = 0; index < manifest.committedDeliveryScenarios.length; index += 1) {
        const harness = createHarness();
        const scenario = harness.committedDeliveryScenarios[index];
        expect(scenario).toBeDefined();
        if (!scenario) continue;
        const result = await withSimulatedFiscalReportGuard(
          harness.executionTarget,
          harness.simulatedReportExecution,
          async () => {
            await scenario.arrange(harness.printer);
            return executeReportOperation(harness.printer, scenario.operation);
          }
        );

        expect(result, scenario.name).toMatchObject({
          ok: true,
          value: {
            evidence: {
              commandEffect: 'APPLIED',
              fiscalCommit: 'COMMITTED',
              printDelivery: scenario.expectedDelivery
            }
          }
        });
      }
    });
  });
}
