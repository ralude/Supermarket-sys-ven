import { describe, expect, it } from 'vitest';
import { InfrastructureError } from '@supermarket/shared';
import {
  assertFiscalOperationSnapshot,
  restoreFiscalOperationEvidence
} from './fiscal-operation-evidence.js';

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

  it.each([{
    state: 'PENDING',
    evidence: {
      dispatchState: 'STARTED', commandEffect: 'UNKNOWN',
      fiscalCommit: 'UNKNOWN', printDelivery: 'UNKNOWN'
    },
    referenceNumber: null
  }, {
    state: 'ISSUED',
    evidence: null,
    referenceNumber: 'INV-001'
  }, {
    state: 'ISSUED',
    evidence: {
      dispatchState: 'STARTED', commandEffect: 'UNKNOWN',
      fiscalCommit: 'UNKNOWN', printDelivery: 'UNKNOWN'
    },
    referenceNumber: 'INV-001'
  }, {
    state: 'ISSUED',
    evidence: {
      dispatchState: 'RESULT_RECEIVED', commandEffect: 'APPLIED',
      fiscalCommit: 'COMMITTED', printDelivery: 'UNKNOWN'
    },
    referenceNumber: null
  }, {
    state: 'ERROR',
    evidence: null,
    referenceNumber: null
  }, {
    state: 'ERROR',
    evidence: {
      dispatchState: 'RESULT_RECEIVED', commandEffect: 'APPLIED',
      fiscalCommit: 'COMMITTED', printDelivery: 'COMPLETE'
    },
    referenceNumber: null
  }, {
    state: 'RETRYING',
    evidence: {
      dispatchState: 'STARTED', commandEffect: 'UNKNOWN',
      fiscalCommit: 'UNKNOWN', printDelivery: 'UNKNOWN'
    },
    referenceNumber: null
  }, {
    state: 'FAILED',
    evidence: {
      dispatchState: 'RESULT_RECEIVED', commandEffect: 'REJECTED',
      fiscalCommit: 'UNKNOWN', printDelivery: 'UNKNOWN'
    },
    referenceNumber: null
  }] as const)('rejects a persisted $state snapshot that contradicts its evidence', (snapshot) => {
    expect(() => assertFiscalOperationSnapshot(snapshot)).toThrowError(
      expect.objectContaining({ code: 'DATABASE_FISCAL_EVIDENCE_INVALID' })
    );
  });

  it.each([{
    state: 'PENDING', evidence: null, referenceNumber: null
  }, {
    state: 'PRINTING', evidence: null, referenceNumber: null
  }, {
    state: 'ERROR',
    evidence: {
      dispatchState: 'STARTED', commandEffect: 'UNKNOWN',
      fiscalCommit: 'UNKNOWN', printDelivery: 'UNKNOWN'
    },
    referenceNumber: null
  }, {
    state: 'RETRYING',
    evidence: {
      dispatchState: 'RESULT_RECEIVED', commandEffect: 'NOT_APPLIED',
      fiscalCommit: 'NOT_COMMITTED', printDelivery: 'INCOMPLETE'
    },
    referenceNumber: null
  }, {
    state: 'FAILED',
    evidence: {
      dispatchState: 'RESULT_RECEIVED', commandEffect: 'NOT_APPLIED',
      fiscalCommit: 'NOT_COMMITTED', printDelivery: 'INCOMPLETE'
    },
    referenceNumber: null
  }, {
    state: 'ISSUED',
    evidence: {
      dispatchState: 'RESULT_RECEIVED', commandEffect: 'APPLIED',
      fiscalCommit: 'COMMITTED', printDelivery: 'UNKNOWN'
    },
    referenceNumber: 'INV-001'
  }] as const)('accepts a persisted $state snapshot only with matching evidence', (snapshot) => {
    expect(() => assertFiscalOperationSnapshot(snapshot)).not.toThrow();
  });
});
