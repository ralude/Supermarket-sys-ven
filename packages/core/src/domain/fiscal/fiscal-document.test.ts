import { describe, expect, it } from 'vitest';
import { FiscalDocument } from './fiscal-document.js';
import type { FiscalDocumentContent } from './fiscal-types.js';

const content: FiscalDocumentContent = {
  referenceId: 'sale-001',
  type: 'INVOICE',
  currencyCode: 'USD',
  lines: [{
    id: 'line-001', description: 'Coffee', quantityScaled: 2, quantityScale: 0,
    unitPriceMinorUnits: 500, taxRateBasisPoints: 1600, totalMinorUnits: 1_160
  }],
  payments: [{ methodCode: 'CASH_USD', amountMinorUnits: 1_160 }],
  totalMinorUnits: 1_160
};

const at = (hour: number): Date => new Date(`2026-08-30T${String(hour).padStart(2, '0')}:00:00.000Z`);

const committedEvidence = {
  dispatchState: 'RESULT_RECEIVED',
  commandEffect: 'APPLIED',
  fiscalCommit: 'COMMITTED',
  printDelivery: 'COMPLETE'
} as const;

const unknownEvidence = {
  dispatchState: 'STARTED',
  commandEffect: 'UNKNOWN',
  fiscalCommit: 'UNKNOWN',
  printDelivery: 'UNKNOWN'
} as const;

const notStartedEvidence = {
  dispatchState: 'NOT_STARTED',
  commandEffect: 'NOT_APPLIED',
  fiscalCommit: 'NOT_COMMITTED',
  printDelivery: 'INCOMPLETE'
} as const;

const pending = (): FiscalDocument => FiscalDocument.create({
  id: 'fiscal-001', content, idempotencyKey: 'request-001',
  requestFingerprint: 'fingerprint-001', terminalId: 'terminal-001',
  originNodeId: 'node-001', createdBy: 'user-001', createdAt: at(10),
  eventId: 'event-001'
});

describe('FiscalDocument', () => {
  it('moves through printing and issued while preserving immutable content', () => {
    const document = pending();
    document.startPrinting({ actorId: 'user-001', occurredAt: at(11), eventId: 'event-002' });
    document.markIssued({
      fiscalNumber: 'INV-000001', actorId: 'user-001',
      occurredAt: at(12), eventId: 'event-003', evidence: committedEvidence
    });

    expect(document).toMatchObject({
      status: 'ISSUED', fiscalNumber: 'INV-000001', attempts: 1,
      lastEvidence: committedEvidence
    });
    expect(document.transitions.map(({ to }) => to)).toEqual(['PENDING', 'PRINTING', 'ISSUED']);
    expect(document.domainEvents.map(({ type }) => type)).toEqual([
      'FiscalDocumentPending', 'FiscalDocumentPrintingStarted', 'FiscalDocumentIssued'
    ]);
    expect(() => document.startPrinting({
      actorId: 'user-001', occurredAt: at(13), eventId: 'event-004'
    })).toThrowError('Issued fiscal documents are immutable.');
  });

  it('requires reconciliation before retrying an uncertain print', () => {
    const document = pending();
    document.startPrinting({ actorId: 'user-001', occurredAt: at(11), eventId: 'event-002' });
    document.recordError({
      code: 'FISCAL_PRINTER_TIMEOUT', evidence: unknownEvidence, retryable: true,
      actorId: 'user-001', occurredAt: at(12), eventId: 'event-003'
    });

    expect(() => document.beginRetry({
      actorId: 'user-001', occurredAt: at(13), eventId: 'event-004'
    })).toThrowError('Fiscal document cannot retry without confirmed device state.');
    document.markIssued({
      fiscalNumber: 'INV-000001', actorId: 'user-001',
      occurredAt: at(13), eventId: 'event-004', evidence: committedEvidence
    });
    expect(document.status).toBe('ISSUED');
  });

  it.each(['COMPLETE', 'INCOMPLETE', 'UNKNOWN'] as const)(
    'accepts a committed fiscal success with %s print delivery',
    (printDelivery) => {
      const document = pending();
      document.startPrinting({
        actorId: 'user-001', occurredAt: at(11), eventId: 'event-002'
      });
      const evidence = { ...committedEvidence, printDelivery };

      document.markIssued({
        fiscalNumber: 'INV-000001', actorId: 'user-001',
        occurredAt: at(12), eventId: 'event-003', evidence
      });

      expect(document).toMatchObject({ status: 'ISSUED', lastEvidence: evidence });
    }
  );

  it.each([
    ['command effect', {
      dispatchState: 'STARTED', commandEffect: 'UNKNOWN',
      fiscalCommit: 'NOT_COMMITTED', printDelivery: 'INCOMPLETE'
    } as const],
    ['fiscal commit', {
      dispatchState: 'RESULT_RECEIVED', commandEffect: 'REJECTED',
      fiscalCommit: 'UNKNOWN', printDelivery: 'INCOMPLETE'
    } as const],
    ['print delivery', {
      dispatchState: 'RESULT_RECEIVED', commandEffect: 'NOT_APPLIED',
      fiscalCommit: 'NOT_COMMITTED', printDelivery: 'UNKNOWN'
    } as const]
  ])('blocks retry when %s remains unknown', (_dimension, evidence) => {
    const document = pending();
    document.startPrinting({ actorId: 'user-001', occurredAt: at(11), eventId: 'event-002' });
    document.recordError({
      code: 'FISCAL_PRINTER_TIMEOUT', evidence, retryable: true,
      actorId: 'user-001', occurredAt: at(12), eventId: 'event-003'
    });

    expect(() => document.beginRetry({
      actorId: 'user-001', occurredAt: at(13), eventId: 'event-004'
    })).toThrowError('Fiscal document cannot retry without confirmed device state.');
  });

  it.each([
    ['dispatch did not start', notStartedEvidence],
    ['device confirmed no effect or fiscal commit', {
      dispatchState: 'RESULT_RECEIVED',
      commandEffect: 'NOT_APPLIED',
      fiscalCommit: 'NOT_COMMITTED',
      printDelivery: 'INCOMPLETE'
    } as const]
  ])('allows a safe retry when %s', (_scenario, safeEvidence) => {
    const document = pending();
    document.startPrinting({ actorId: 'user-001', occurredAt: at(11), eventId: 'event-002' });
    document.recordError({
      code: 'FISCAL_PRINTER_PAPER_END', evidence: safeEvidence, retryable: true,
      actorId: 'user-001', occurredAt: at(12), eventId: 'event-003'
    });
    document.beginRetry({
      actorId: 'user-001', occurredAt: at(13), eventId: 'event-004'
    });

    expect(document.status).toBe('RETRYING');
  });

  it('clears evidence from the previous attempt when a retry starts printing', () => {
    const document = pending();
    document.startPrinting({ actorId: 'user-001', occurredAt: at(11), eventId: 'event-002' });
    document.recordError({
      code: 'FISCAL_PRINTER_PAPER_END', evidence: notStartedEvidence, retryable: true,
      actorId: 'user-001', occurredAt: at(12), eventId: 'event-003'
    });
    document.beginRetry({
      actorId: 'user-001', occurredAt: at(13), eventId: 'event-004'
    });

    document.startPrinting({
      actorId: 'user-001', occurredAt: at(14), eventId: 'event-005'
    });

    expect(document).toMatchObject({
      status: 'PRINTING', attempts: 2, lastErrorCode: null,
      lastEvidence: null, lastFailureRetryable: false
    });
    expect(document.transitions.at(-1)).toMatchObject({
      from: 'RETRYING', to: 'PRINTING', errorCode: null, evidence: null
    });
  });

  it('marks a retrying document issued only with positive commit evidence', () => {
    const document = pending();
    document.startPrinting({ actorId: 'user-001', occurredAt: at(11), eventId: 'event-002' });
    document.recordError({
      code: 'FISCAL_PRINTER_PAPER_END', evidence: notStartedEvidence, retryable: true,
      actorId: 'user-001', occurredAt: at(12), eventId: 'event-003'
    });
    document.beginRetry({
      actorId: 'user-001', occurredAt: at(13), eventId: 'event-004'
    });

    document.markIssued({
      fiscalNumber: 'INV-000001', evidence: committedEvidence,
      actorId: 'user-001', occurredAt: at(14), eventId: 'event-005'
    });

    expect(document).toMatchObject({
      status: 'ISSUED', fiscalNumber: 'INV-000001', lastEvidence: committedEvidence
    });
    expect(document.transitions.at(-1)).toMatchObject({ from: 'RETRYING', to: 'ISSUED' });
  });

  it('rejects incoherent success and failure evidence', () => {
    const uncommittedSuccess = pending();
    uncommittedSuccess.startPrinting({
      actorId: 'user-001', occurredAt: at(11), eventId: 'event-002'
    });
    expect(() => uncommittedSuccess.markIssued({
      fiscalNumber: 'INV-000001', actorId: 'user-001',
      occurredAt: at(12), eventId: 'event-003',
      evidence: {
        dispatchState: 'RESULT_RECEIVED', commandEffect: 'APPLIED',
        fiscalCommit: 'NOT_COMMITTED', printDelivery: 'INCOMPLETE'
      }
    })).toThrowError('Issued fiscal documents require positive fiscal commit evidence.');
    expect(uncommittedSuccess.status).toBe('PRINTING');

    const completedFailure = pending();
    completedFailure.startPrinting({
      actorId: 'user-001', occurredAt: at(11), eventId: 'event-002'
    });
    expect(() => completedFailure.recordError({
      code: 'FISCAL_PRINTER_TIMEOUT', retryable: true,
      evidence: committedEvidence, actorId: 'user-001',
      occurredAt: at(12), eventId: 'event-003'
    })).toThrowError('Fiscal failure evidence is inconsistent.');
    expect(completedFailure.status).toBe('PRINTING');
  });

  it('keeps the final failure and its evidence', () => {
    const document = pending();
    document.startPrinting({ actorId: 'user-001', occurredAt: at(11), eventId: 'event-002' });
    document.recordError({
      code: 'FISCAL_PRINTER_PAPER_END', evidence: notStartedEvidence, retryable: true,
      actorId: 'user-001', occurredAt: at(12), eventId: 'event-003'
    });
    document.beginRetry({
      actorId: 'user-001', occurredAt: at(13), eventId: 'event-004'
    });
    document.startPrinting({ actorId: 'user-001', occurredAt: at(14), eventId: 'event-005' });
    const rejectedEvidence = {
      dispatchState: 'RESULT_RECEIVED', commandEffect: 'NOT_APPLIED',
      fiscalCommit: 'NOT_COMMITTED', printDelivery: 'INCOMPLETE'
    } as const;
    document.recordError({
      code: 'FISCAL_PRINTER_MEMORY_FULL', evidence: rejectedEvidence, retryable: false,
      actorId: 'user-001', occurredAt: at(15), eventId: 'event-006'
    });
    document.markFailed({ actorId: 'user-001', occurredAt: at(16), eventId: 'event-007' });

    expect(document.status).toBe('FAILED');
    expect(document.attempts).toBe(2);
    expect(document.lastEvidence).toEqual(rejectedEvidence);
    expect(document.transitions.at(-1)?.evidence).toEqual(rejectedEvidence);
  });

  it('refuses to terminalize a document while fiscal effect remains unknown', () => {
    const document = pending();
    document.startPrinting({ actorId: 'user-001', occurredAt: at(11), eventId: 'event-002' });
    document.recordError({
      code: 'FISCAL_PRINTER_TIMEOUT', evidence: unknownEvidence, retryable: false,
      actorId: 'user-001', occurredAt: at(12), eventId: 'event-003'
    });

    expect(() => document.markFailed({
      actorId: 'user-001', occurredAt: at(13), eventId: 'event-004'
    })).toThrowError('Terminal failure requires authoritative no-commit evidence.');
    expect(document.status).toBe('ERROR');
  });

  it('validates fiscal totals and scaled quantities', () => {
    expect(() => FiscalDocument.create({
      id: 'fiscal-001', content: { ...content, totalMinorUnits: 1_159 },
      idempotencyKey: 'request-001', requestFingerprint: 'fingerprint-001',
      terminalId: 'terminal-001', originNodeId: 'node-001', createdBy: 'user-001',
      createdAt: at(10), eventId: 'event-001'
    })).toThrowError('Fiscal document totals are inconsistent.');
  });
});
