import { describe, expect, it } from 'vitest';
import { FiscalDay } from './fiscal-day.js';

const at = (hour: number): Date => new Date(`2026-08-30T${String(hour).padStart(2, '0')}:00:00.000Z`);
const day = (): FiscalDay => FiscalDay.open({
  id: 'day-001', businessDate: '2026-08-30', terminalId: 'terminal-001',
  originNodeId: 'node-001', openedBy: 'user-001', openedAt: at(8), eventId: 'event-001'
});

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
      occurredAt: at(9), eventId: 'event-004'
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
      occurredAt: at(20), eventId: 'event-007'
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
      reportId: 'report-x', code: 'FISCAL_PRINTER_TIMEOUT', certainty: 'UNKNOWN',
      retryable: true, actorId: 'user-001', occurredAt: at(9), eventId: 'event-004'
    });
    expect(() => fiscalDay.retryReport({
      reportId: 'report-x', confirmedNotIssued: false, actorId: 'user-001',
      occurredAt: at(10), eventId: 'event-005'
    })).toThrowError('Fiscal report cannot retry without confirmed device state.');
  });
});
