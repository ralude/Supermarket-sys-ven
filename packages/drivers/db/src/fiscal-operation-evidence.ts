import {
  isFiscalOperationEvidenceCoherent,
  type FiscalCommandEffect,
  type FiscalCommit,
  type FiscalDispatchState,
  type FiscalOperationEvidence,
  type FiscalPrintDelivery
} from '@supermarket/core';
import { InfrastructureError } from '@supermarket/shared';

type FiscalOperationEvidenceColumns = {
  readonly dispatchState: string | null;
  readonly commandEffect: string | null;
  readonly fiscalCommit: string | null;
  readonly printDelivery: string | null;
};

const dispatchStates = new Set<FiscalDispatchState>([
  'NOT_STARTED', 'STARTED', 'RESULT_RECEIVED'
]);
const commandEffects = new Set<FiscalCommandEffect>([
  'APPLIED', 'NOT_APPLIED', 'REJECTED', 'UNKNOWN'
]);
const fiscalCommits = new Set<FiscalCommit>([
  'COMMITTED', 'NOT_COMMITTED', 'UNKNOWN'
]);
const printDeliveries = new Set<FiscalPrintDelivery>([
  'COMPLETE', 'INCOMPLETE', 'UNKNOWN'
]);

export const restoreFiscalOperationEvidence = (
  columns: FiscalOperationEvidenceColumns
): FiscalOperationEvidence | null => {
  const values = [
    columns.dispatchState,
    columns.commandEffect,
    columns.fiscalCommit,
    columns.printDelivery
  ];
  if (values.every((value) => value === null)) return null;
  if (values.some((value) => value === null) ||
    !dispatchStates.has(columns.dispatchState as FiscalDispatchState) ||
    !commandEffects.has(columns.commandEffect as FiscalCommandEffect) ||
    !fiscalCommits.has(columns.fiscalCommit as FiscalCommit) ||
    !printDeliveries.has(columns.printDelivery as FiscalPrintDelivery)) {
    throw new InfrastructureError(
      'DATABASE_FISCAL_EVIDENCE_INVALID',
      'Persisted fiscal operation evidence is incomplete or invalid.'
    );
  }
  const evidence: FiscalOperationEvidence = {
    dispatchState: columns.dispatchState as FiscalDispatchState,
    commandEffect: columns.commandEffect as FiscalCommandEffect,
    fiscalCommit: columns.fiscalCommit as FiscalCommit,
    printDelivery: columns.printDelivery as FiscalPrintDelivery
  };
  if (!isFiscalOperationEvidenceCoherent(evidence)) {
    throw new InfrastructureError(
      'DATABASE_FISCAL_EVIDENCE_INVALID',
      'Persisted fiscal operation evidence is incomplete or invalid.'
    );
  }
  return evidence;
};

export const fiscalOperationEvidenceValues = (
  evidence: FiscalOperationEvidence | null
): FiscalOperationEvidenceColumns => ({
  dispatchState: evidence?.dispatchState ?? null,
  commandEffect: evidence?.commandEffect ?? null,
  fiscalCommit: evidence?.fiscalCommit ?? null,
  printDelivery: evidence?.printDelivery ?? null
});
