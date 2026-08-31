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

export type FiscalDispatchState = 'NOT_STARTED' | 'STARTED' | 'RESULT_RECEIVED';
export type FiscalCommandEffect = 'APPLIED' | 'NOT_APPLIED' | 'REJECTED' | 'UNKNOWN';
export type FiscalCommit = 'COMMITTED' | 'NOT_COMMITTED' | 'UNKNOWN';
export type FiscalPrintDelivery = 'COMPLETE' | 'INCOMPLETE' | 'UNKNOWN';

export type FiscalOperationEvidence = {
  readonly dispatchState: FiscalDispatchState;
  readonly commandEffect: FiscalCommandEffect;
  readonly fiscalCommit: FiscalCommit;
  readonly printDelivery: FiscalPrintDelivery;
};

export const cloneFiscalOperationEvidence = (
  evidence: FiscalOperationEvidence
): FiscalOperationEvidence => ({ ...evidence });

export const isFiscalOperationEvidenceCoherent = (
  evidence: FiscalOperationEvidence
): boolean => {
  if (evidence.dispatchState === 'NOT_STARTED' && (
    evidence.commandEffect !== 'NOT_APPLIED' ||
    evidence.fiscalCommit !== 'NOT_COMMITTED' ||
    evidence.printDelivery !== 'INCOMPLETE'
  )) return false;
  if (evidence.printDelivery === 'COMPLETE' && (
    evidence.commandEffect !== 'APPLIED' || evidence.fiscalCommit !== 'COMMITTED'
  )) return false;
  if (evidence.fiscalCommit === 'COMMITTED' && evidence.commandEffect !== 'APPLIED') {
    return false;
  }
  if (evidence.commandEffect === 'NOT_APPLIED' && evidence.fiscalCommit !== 'NOT_COMMITTED') {
    return false;
  }
  return !(evidence.commandEffect === 'REJECTED' && evidence.fiscalCommit === 'COMMITTED');
};

export const isFiscalOperationRetrySafe = (
  evidence: FiscalOperationEvidence
): boolean => isFiscalOperationEvidenceCoherent(evidence) &&
  evidence.commandEffect !== 'UNKNOWN' &&
  evidence.fiscalCommit !== 'UNKNOWN' &&
  evidence.printDelivery !== 'UNKNOWN' && (
    evidence.dispatchState === 'NOT_STARTED' || (
      evidence.commandEffect === 'NOT_APPLIED' && evidence.fiscalCommit === 'NOT_COMMITTED'
    )
  );

export const isFiscalOperationTerminalFailureSafe = (
  evidence: FiscalOperationEvidence
): boolean => isFiscalOperationEvidenceCoherent(evidence) &&
  evidence.commandEffect === 'NOT_APPLIED' &&
  evidence.fiscalCommit === 'NOT_COMMITTED' &&
  evidence.printDelivery === 'INCOMPLETE';

export const isFiscalOperationCommitted = (
  evidence: FiscalOperationEvidence
): boolean => isFiscalOperationEvidenceCoherent(evidence) &&
  evidence.commandEffect === 'APPLIED' && evidence.fiscalCommit === 'COMMITTED';
