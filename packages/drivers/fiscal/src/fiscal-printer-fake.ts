import type {
  FiscalDocumentPayload,
  FiscalDocumentPrintConfirmation,
  FiscalPrinterFailure,
  FiscalPrinterPort,
  FiscalPrinterResult,
  FiscalPrinterStatus,
  FiscalReportPrintConfirmation
} from '@supermarket/core';

export type FiscalFakeResponse =
  | 'ACK'
  | 'NAK'
  | 'PAPER_END'
  | 'MEMORY_FULL'
  | 'BUSY'
  | 'TIMEOUT'
  | 'CRC_ERROR'
  | 'PORT_CLOSED';

export type FiscalFakeCommand =
  | { readonly name: 'OPEN'; readonly documentType: FiscalDocumentPayload['type']; readonly referenceId: string }
  | { readonly name: 'ITEM'; readonly lineId: string }
  | { readonly name: 'PAYMENT'; readonly methodCode: string }
  | { readonly name: 'CLOSE'; readonly referenceId: string }
  | { readonly name: 'X_REPORT' }
  | { readonly name: 'Z_REPORT' };

const failures: Record<Exclude<FiscalFakeResponse, 'ACK'>, FiscalPrinterFailure> = {
  NAK: {
    code: 'FISCAL_PRINTER_NAK', certainty: 'REJECTED', retryable: false,
    message: 'Fiscal printer rejected the command.'
  },
  PAPER_END: {
    code: 'FISCAL_PRINTER_PAPER_END', certainty: 'NOT_SENT', retryable: true,
    message: 'Fiscal printer has no paper.'
  },
  MEMORY_FULL: {
    code: 'FISCAL_PRINTER_MEMORY_FULL', certainty: 'REJECTED', retryable: false,
    message: 'Fiscal printer memory is full.'
  },
  BUSY: {
    code: 'FISCAL_PRINTER_BUSY', certainty: 'NOT_SENT', retryable: true,
    message: 'Fiscal printer is busy.'
  },
  TIMEOUT: {
    code: 'FISCAL_PRINTER_TIMEOUT', certainty: 'UNKNOWN', retryable: true,
    message: 'Fiscal printer response timed out.'
  },
  CRC_ERROR: {
    code: 'FISCAL_PRINTER_CRC_ERROR', certainty: 'UNKNOWN', retryable: true,
    message: 'Fiscal printer response failed CRC validation.'
  },
  PORT_CLOSED: {
    code: 'FISCAL_PRINTER_PORT_CLOSED', certainty: 'NOT_SENT', retryable: true,
    message: 'Fiscal printer port is closed.'
  }
};

type FiscalPrinterFakeOptions = {
  readonly now?: () => Date;
};

export class FiscalPrinterFake implements FiscalPrinterPort {
  private readonly recordedCommands: FiscalFakeCommand[] = [];
  private readonly responses: FiscalFakeResponse[] = [];
  private readonly now: () => Date;
  private isOpen = true;
  private documentSequence = 0;
  private xReportSequence = 0;
  private zReportSequence = 0;
  private lastDocumentReferenceId: string | null = null;
  private lastDocumentNumber: string | null = null;

  constructor(options: FiscalPrinterFakeOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  get commands(): readonly FiscalFakeCommand[] {
    return [...this.recordedCommands];
  }

  queueResponses(...responses: FiscalFakeResponse[]): void {
    this.responses.push(...responses);
  }

  closePort(): void {
    this.isOpen = false;
  }

  openPort(): void {
    this.isOpen = true;
  }

  async getStatus(): Promise<FiscalPrinterResult<FiscalPrinterStatus>> {
    if (!this.isOpen) return this.failure('PORT_CLOSED');
    return {
      ok: true,
      value: {
        connection: 'OPEN',
        state: 'IDLE',
        paperAvailable: true,
        memoryAvailable: true,
        lastDocumentReferenceId: this.lastDocumentReferenceId,
        lastDocumentNumber: this.lastDocumentNumber
      }
    };
  }

  printInvoice(
    document: FiscalDocumentPayload
  ): Promise<FiscalPrinterResult<FiscalDocumentPrintConfirmation>> {
    return this.printDocument(document, 'INV');
  }

  printCreditNote(
    document: FiscalDocumentPayload
  ): Promise<FiscalPrinterResult<FiscalDocumentPrintConfirmation>> {
    return this.printDocument(document, 'NC');
  }

  async printXReport(): Promise<FiscalPrinterResult<FiscalReportPrintConfirmation>> {
    const response = this.execute({ name: 'X_REPORT' });
    if (!response.ok) return response;
    this.xReportSequence += 1;
    return { ok: true, value: {
      reportNumber: `X-${String(this.xReportSequence).padStart(6, '0')}`,
      confirmedAt: this.now()
    } };
  }

  async printZReport(): Promise<FiscalPrinterResult<FiscalReportPrintConfirmation>> {
    const response = this.execute({ name: 'Z_REPORT' });
    if (!response.ok) return response;
    this.zReportSequence += 1;
    return { ok: true, value: {
      reportNumber: `Z-${String(this.zReportSequence).padStart(6, '0')}`,
      confirmedAt: this.now()
    } };
  }

  private async printDocument(
    document: FiscalDocumentPayload,
    prefix: 'INV' | 'NC'
  ): Promise<FiscalPrinterResult<FiscalDocumentPrintConfirmation>> {
    const commands: FiscalFakeCommand[] = [
      { name: 'OPEN', documentType: document.type, referenceId: document.referenceId },
      ...document.lines.map((line): FiscalFakeCommand => ({ name: 'ITEM', lineId: line.id })),
      ...document.payments.map((payment): FiscalFakeCommand => ({
        name: 'PAYMENT', methodCode: payment.methodCode
      })),
      { name: 'CLOSE', referenceId: document.referenceId }
    ];
    const fiscalNumber = `${prefix}-${String(this.documentSequence + 1).padStart(6, '0')}`;
    for (const command of commands) {
      const response = this.execute(command);
      if (!response.ok) {
        if (command.name === 'CLOSE' && response.error.certainty === 'UNKNOWN') {
          this.confirmDocument(document.referenceId, fiscalNumber);
        }
        return response;
      }
    }
    this.confirmDocument(document.referenceId, fiscalNumber);
    return { ok: true, value: { fiscalNumber, confirmedAt: this.now() } };
  }

  private execute(command: FiscalFakeCommand): FiscalPrinterResult<true> {
    this.recordedCommands.push(command);
    const response = this.isOpen ? (this.responses.shift() ?? 'ACK') : 'PORT_CLOSED';
    return response === 'ACK' ? { ok: true, value: true } : this.failure(response);
  }

  private failure(response: Exclude<FiscalFakeResponse, 'ACK'>): { ok: false; error: FiscalPrinterFailure } {
    return { ok: false, error: failures[response] };
  }

  private confirmDocument(referenceId: string, fiscalNumber: string): void {
    this.documentSequence += 1;
    this.lastDocumentReferenceId = referenceId;
    this.lastDocumentNumber = fiscalNumber;
  }
}
