import { describe, expect, it } from 'vitest';
import { InfrastructureError } from '@supermarket/shared';
import { restoreFiscalOperationEvidence } from './fiscal-operation-evidence.js';

describe('restoreFiscalOperationEvidence', () => {
  it('accepts an absent or coherent persisted snapshot', () => {
    expect(restoreFiscalOperationEvidence({
      dispatchState: null,
      commandEffect: null,
      fiscalCommit: null,
      printDelivery: null
    })).toBeNull();
    expect(restoreFiscalOperationEvidence({
      dispatchState: 'RESULT_RECEIVED',
      commandEffect: 'APPLIED',
      fiscalCommit: 'COMMITTED',
      printDelivery: 'UNKNOWN'
    })).toEqual({
      dispatchState: 'RESULT_RECEIVED',
      commandEffect: 'APPLIED',
      fiscalCommit: 'COMMITTED',
      printDelivery: 'UNKNOWN'
    });
  });

  it.each([{
    dispatchState: 'NOT_STARTED',
    commandEffect: 'APPLIED',
    fiscalCommit: 'COMMITTED',
    printDelivery: 'COMPLETE'
  }, {
    dispatchState: 'STARTED',
    commandEffect: 'UNKNOWN',
    fiscalCommit: null,
    printDelivery: 'UNKNOWN'
  }])('rejects incomplete or semantically incoherent persisted evidence', (columns) => {
    let caught: unknown;
    try {
      restoreFiscalOperationEvidence(columns);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(InfrastructureError);
    expect((caught as InfrastructureError).code).toBe('DATABASE_FISCAL_EVIDENCE_INVALID');
  });
});
