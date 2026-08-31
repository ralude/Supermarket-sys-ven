import { describe, expect, it } from 'vitest';
import { FiscalDay } from './fiscal-day.js';

const at = (hour: number): Date => new Date(`2026-08-30T${String(hour).padStart(2, '0')}:00:00.000Z`);
const day = (): FiscalDay => FiscalDay.open({
  id: 'day-001', businessDate: '2026-08-30', terminalId: 'terminal-001',
  originNodeId: 'node-001', openedBy: 'user-001', openedAt: at(8), eventId: 'event-001'
});
const committedEvidence = {
  dispatchState: 'RESULT_RECEIVED', commandEffect: 'APPLIED',
  fiscalCommit: 'COMMITTED', printDelivery: 'COMPLETE'
} as const;
const unknownEvidence = {
  dispatchState: 'STARTED', commandEffect: 'UNKNOWN',
  fiscalCommit: 'UNKNOWN', printDelivery: 'UNKNOWN'
} as const;

describe('FiscalDay', () => {
  it('keeps the day open after X and closes it only after an issued Z', () => {
    const fiscalDay = day();
    fiscalDay.requestReport({
      id: 'report-x', type: 'X', idempotencyKey: 'x-key', requestFingerprint: 'x-fp',
      actorId: 'user-001', occurredAt: at(9), eventId: 'event-002'
    });
    fiscalDay.startReport({ reportId: 'report-x', actorId: 'user-001', occurredAt: at(9), eventId: 'event-003' });
    fiscalDay.markReportIssued({
      reportId: 'report-x', reportNumber: 'X-000001', actorId: 'user-001',
      occurredAt: at(9), eventId: 'event-004', evidence: committedEvidence
    });
    expect(fiscalDay.state).toBe('DAY_OPEN');

    fiscalDay.requestReport({
      id: 'report-z', type: 'Z', idempotencyKey: 'z-key', requestFingerprint: 'z-fp',
      actorId: 'user-001', occurredAt: at(20), eventId: 'event-005'
    });
    expect(fiscalDay.state).toBe('Z_PENDING');
    fiscalDay.startReport({ reportId: 'report-z', actorId: 'user-001', occurredAt: at(20), eventId: 'event-006' });
    fiscalDay.markReportIssued({
      reportId: 'report-z', reportNumber: 'Z-000001', actorId: 'user-001',
      occurredAt: at(20), eventId: 'event-007', evidence: committedEvidence
    });
    expect(fiscalDay.state).toBe('DAY_CLOSED');
    expect(() => fiscalDay.requestReport({
      id: 'report-x-2', type: 'X', idempotencyKey: 'x-key-2', requestFingerprint: 'x-fp-2',
      actorId: 'user-001', occurredAt: at(21), eventId: 'event-008'
    })).toThrowError('Fiscal day is not open.');
  });

  it('keeps a recoverable report explicit and requires confirmation before retry', () => {
    const fiscalDay = day();
    fiscalDay.requestReport({
      id: 'report-x', type: 'X', idempotencyKey: 'x-key', requestFingerprint: 'x-fp',
      actorId: 'user-001', occurredAt: at(9), eventId: 'event-002'
    });
    fiscalDay.startReport({ reportId: 'report-x', actorId: 'user-001', occurredAt: at(9), eventId: 'event-003' });
    fiscalDay.recordReportError({
      reportId: 'report-x', code: 'FISCAL_PRINTER_TIMEOUT', evidence: unknownEvidence,
      retryable: true, actorId: 'user-001', occurredAt: at(9), eventId: 'event-004'
    });
    expect(() => fiscalDay.retryReport({
      reportId: 'report-x', actorId: 'user-001',
      occurredAt: at(10), eventId: 'event-005'
    })).toThrowError('Fiscal report cannot retry without confirmed device state.');
    expect(fiscalDay.reports[0]?.lastEvidence).toEqual(unknownEvidence);
  });

  it('retries a report only with positive no-effect evidence', () => {
    const fiscalDay = day();
    fiscalDay.requestReport({
      id: 'report-x', type: 'X', idempotencyKey: 'x-key', requestFingerprint: 'x-fp',
      actorId: 'user-001', occurredAt: at(9), eventId: 'event-002'
    });
    fiscalDay.startReport({
      reportId: 'report-x', actorId: 'user-001', occurredAt: at(9), eventId: 'event-003'
    });
    fiscalDay.recordReportError({
      reportId: 'report-x', code: 'FISCAL_PRINTER_BUSY', retryable: true,
      evidence: {
        dispatchState: 'RESULT_RECEIVED', commandEffect: 'NOT_APPLIED',
        fiscalCommit: 'NOT_COMMITTED', printDelivery: 'INCOMPLETE'
      },
      actorId: 'user-001', occurredAt: at(9), eventId: 'event-004'
    });

    fiscalDay.retryReport({
      reportId: 'report-x', actorId: 'user-001',
      occurredAt: at(10), eventId: 'event-005'
    });

    expect(fiscalDay.reports[0]?.status).toBe('RETRYING');
  });

  it('clears evidence from the previous report attempt when retry printing starts', () => {
    const fiscalDay = day();
    fiscalDay.requestReport({
      id: 'report-x', type: 'X', idempotencyKey: 'x-key', requestFingerprint: 'x-fp',
      actorId: 'user-001', occurredAt: at(9), eventId: 'event-002'
    });
    fiscalDay.startReport({
      reportId: 'report-x', actorId: 'user-001', occurredAt: at(9), eventId: 'event-003'
    });
    fiscalDay.recordReportError({
      reportId: 'report-x', code: 'FISCAL_PRINTER_BUSY', retryable: true,
      evidence: {
        dispatchState: 'RESULT_RECEIVED', commandEffect: 'NOT_APPLIED',
        fiscalCommit: 'NOT_COMMITTED', printDelivery: 'INCOMPLETE'
      },
      actorId: 'user-001', occurredAt: at(9), eventId: 'event-004'
    });
    fiscalDay.retryReport({
      reportId: 'report-x', actorId: 'user-001',
      occurredAt: at(10), eventId: 'event-005'
    });

    fiscalDay.startReport({
      reportId: 'report-x', actorId: 'user-001',
      occurredAt: at(11), eventId: 'event-006'
    });

    expect(fiscalDay.reports[0]).toMatchObject({
      status: 'PRINTING', attempts: 2, lastErrorCode: null,
      lastEvidence: null, retryable: false
    });
    expect(fiscalDay.reports[0]?.transitions.at(-1)).toMatchObject({
      from: 'RETRYING', to: 'PRINTING', errorCode: null, evidence: null
    });
  });

  it.each(['INCOMPLETE', 'UNKNOWN'] as const)(
    'closes the day when Z is committed with %s print delivery',
    (printDelivery) => {
      const fiscalDay = day();
      fiscalDay.requestReport({
        id: 'report-z', type: 'Z', idempotencyKey: 'z-key', requestFingerprint: 'z-fp',
        actorId: 'user-001', occurredAt: at(20), eventId: 'event-002'
      });
      fiscalDay.startReport({
        reportId: 'report-z', actorId: 'user-001', occurredAt: at(20), eventId: 'event-003'
      });
      const evidence = { ...committedEvidence, printDelivery };

      fiscalDay.markReportIssued({
        reportId: 'report-z', reportNumber: 'Z-000001', evidence,
        actorId: 'user-001', occurredAt: at(20), eventId: 'event-004'
      });

      expect(fiscalDay.state).toBe('DAY_CLOSED');
      expect(fiscalDay.reports[0]).toMatchObject({ status: 'ISSUED', lastEvidence: evidence });
    }
  );

  it('keeps a non-retryable ambiguous report active until intervention', () => {
    const fiscalDay = day();
    const report = fiscalDay.requestReport({
      id: 'report-x', type: 'X', idempotencyKey: 'x-key', requestFingerprint: 'x-fp',
      actorId: 'user-001', occurredAt: at(9), eventId: 'event-002'
    });
    fiscalDay.startReport({
      reportId: report.id, actorId: 'user-001', occurredAt: at(9), eventId: 'event-003'
    });

    fiscalDay.recordReportError({
      reportId: report.id, code: 'FISCAL_PRINTER_TIMEOUT', evidence: unknownEvidence,
      retryable: false, actorId: 'user-001', occurredAt: at(10), eventId: 'event-004'
    });

    expect(fiscalDay.reports[0]).toMatchObject({
      status: 'ERROR', retryable: false, lastEvidence: unknownEvidence
    });
    expect(() => fiscalDay.markReportFailed({
      reportId: report.id, actorId: 'user-001',
      occurredAt: at(11), eventId: 'event-005'
    })).toThrowError('Terminal failure requires authoritative no-commit evidence.');
  });

  it('terminalizes a report only after authoritative no-effect evidence', () => {
    const fiscalDay = day();
    const report = fiscalDay.requestReport({
      id: 'report-x', type: 'X', idempotencyKey: 'x-key', requestFingerprint: 'x-fp',
      actorId: 'user-001', occurredAt: at(9), eventId: 'event-002'
    });
    fiscalDay.startReport({
      reportId: report.id, actorId: 'user-001', occurredAt: at(9), eventId: 'event-003'
    });
    fiscalDay.recordReportError({
      reportId: report.id, code: 'FISCAL_PRINTER_MEMORY_FULL',
      evidence: {
        dispatchState: 'RESULT_RECEIVED', commandEffect: 'NOT_APPLIED',
        fiscalCommit: 'NOT_COMMITTED', printDelivery: 'INCOMPLETE'
      },
      retryable: false, actorId: 'user-001', occurredAt: at(10), eventId: 'event-004'
    });

    fiscalDay.markReportFailed({
      reportId: report.id, actorId: 'user-001',
      occurredAt: at(11), eventId: 'event-005'
    });

    expect(fiscalDay.reports[0]?.status).toBe('FAILED');
  });
});
