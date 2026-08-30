import type {
  FiscalDeliveryCertainty,
  FiscalDocumentContent,
  FiscalDocumentState,
  FiscalDayState,
  FiscalReportState,
  FiscalReportType
} from '../../domain/fiscal/index.js';

export type IssueFiscalDocumentInput = {
  readonly content: FiscalDocumentContent;
  readonly reason: string;
};

export type ReconcileFiscalStateInput = {
  readonly documentId: string;
  readonly reason: string;
};

export type FiscalDocumentDto = {
  readonly id: string;
  readonly content: FiscalDocumentContent;
  readonly status: FiscalDocumentState;
  readonly version: number;
  readonly attempts: number;
  readonly fiscalNumber: string | null;
  readonly lastErrorCode: string | null;
  readonly lastCertainty: FiscalDeliveryCertainty | null;
};

export type PrintFiscalReportInput = {
  readonly dayId: string;
  readonly businessDate: string;
  readonly reason: string;
};

export type FiscalReportDto = {
  readonly dayId: string;
  readonly dayState: FiscalDayState;
  readonly id: string;
  readonly type: FiscalReportType;
  readonly status: FiscalReportState;
  readonly attempts: number;
  readonly reportNumber: string | null;
  readonly lastErrorCode: string | null;
};
