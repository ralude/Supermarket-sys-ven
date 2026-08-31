import type {
  FiscalDocumentContent,
  FiscalDocumentLine,
  FiscalDocumentPayment,
  FiscalOperationEvidence
} from '../../domain/fiscal/index.js';

export type FiscalDocumentLinePayload = FiscalDocumentLine;
export type FiscalDocumentPaymentPayload = FiscalDocumentPayment;
export type FiscalDocumentPayload = FiscalDocumentContent;
export type FiscalPrinterErrorCode =
  | 'FISCAL_PRINTER_NAK'
  | 'FISCAL_PRINTER_PAPER_END'
  | 'FISCAL_PRINTER_MEMORY_FULL'
  | 'FISCAL_PRINTER_BUSY'
  | 'FISCAL_PRINTER_TIMEOUT'
  | 'FISCAL_PRINTER_CRC_ERROR'
  | 'FISCAL_PRINTER_PORT_CLOSED';

export type FiscalPrinterFailure = {
  readonly code: FiscalPrinterErrorCode;
  readonly evidence: FiscalOperationEvidence;
  readonly retryable: boolean;
  readonly message: string;
};

export type FiscalPrinterResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: FiscalPrinterFailure };

export type FiscalPrinterStatus = {
  readonly connection: 'OPEN';
  readonly state: 'IDLE' | 'BUSY';
  readonly paperAvailable: boolean;
  readonly memoryAvailable: boolean;
  readonly lastDocumentReferenceId: string | null;
  readonly lastDocumentNumber: string | null;
};

export type FiscalDocumentPrintConfirmation = {
  readonly fiscalNumber: string;
  readonly confirmedAt: Date;
  readonly evidence: FiscalOperationEvidence;
};

export type FiscalReportPrintConfirmation = {
  readonly reportNumber: string;
  readonly confirmedAt: Date;
  readonly evidence: FiscalOperationEvidence;
};

export interface FiscalPrinterPort {
  getStatus(): Promise<FiscalPrinterResult<FiscalPrinterStatus>>;
  printInvoice(
    document: FiscalDocumentPayload
  ): Promise<FiscalPrinterResult<FiscalDocumentPrintConfirmation>>;
  printCreditNote(
    document: FiscalDocumentPayload
  ): Promise<FiscalPrinterResult<FiscalDocumentPrintConfirmation>>;
  printXReport(): Promise<FiscalPrinterResult<FiscalReportPrintConfirmation>>;
  printZReport(): Promise<FiscalPrinterResult<FiscalReportPrintConfirmation>>;
}
