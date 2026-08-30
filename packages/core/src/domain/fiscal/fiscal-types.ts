export type FiscalDocumentType = 'INVOICE' | 'CREDIT_NOTE';

export type FiscalDocumentLine = {
  readonly id: string;
  readonly description: string;
  readonly quantityScaled: number;
  readonly quantityScale: number;
  readonly unitPriceMinorUnits: number;
  readonly taxRateBasisPoints: number;
  readonly totalMinorUnits: number;
};

export type FiscalDocumentPayment = {
  readonly methodCode: string;
  readonly amountMinorUnits: number;
};

export type FiscalDocumentContent = {
  readonly referenceId: string;
  readonly type: FiscalDocumentType;
  readonly currencyCode: string;
  readonly lines: readonly FiscalDocumentLine[];
  readonly payments: readonly FiscalDocumentPayment[];
  readonly totalMinorUnits: number;
};

export type FiscalDeliveryCertainty = 'NOT_SENT' | 'REJECTED' | 'UNKNOWN';
