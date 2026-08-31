import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  FiscalDay,
  type FiscalOperationEvidence,
  type FiscalReportState
} from '@supermarket/core';
import { openDatabase, type DatabaseHandle } from './connection.js';
import { DrizzleFiscalDayRepository } from './fiscal-day-repository.js';
import { applyMigrations } from './migrations.js';
import { SqliteUnitOfWork } from './unit-of-work.js';

const unknownEvidence = {
  dispatchState: 'STARTED', commandEffect: 'UNKNOWN',
  fiscalCommit: 'UNKNOWN', printDelivery: 'UNKNOWN'
} as const;
const committedEvidence = {
  dispatchState: 'RESULT_RECEIVED', commandEffect: 'APPLIED',
  fiscalCommit: 'COMMITTED', printDelivery: 'COMPLETE'
} as const;
const notAppliedEvidence = {
  dispatchState: 'RESULT_RECEIVED', commandEffect: 'NOT_APPLIED',
  fiscalCommit: 'NOT_COMMITTED', printDelivery: 'INCOMPLETE'
} as const;

const createDayWithReportInState = (
  state: FiscalReportState,
  sequence: number,
  openedAt?: Date
): FiscalDay => {
  const suffix = String(sequence).padStart(3, '0');
  const dayOfMonth = String(sequence).padStart(2, '0');
  const at = (minute: number): Date => new Date(
    `2026-08-${dayOfMonth}T12:${String(minute).padStart(2, '0')}:00.000Z`
  );
  const day = FiscalDay.open({
    id: `day-${suffix}`, businessDate: `2026-08-${dayOfMonth}`,
    terminalId: `terminal-${suffix}`, originNodeId: 'node-001', openedBy: 'user-001',
    openedAt: openedAt ?? at(0), eventId: `event-${suffix}-day-opened`
  });
  const report = day.requestReport({
    id: `report-${suffix}`, type: 'X', idempotencyKey: `report-request-${suffix}`,
    requestFingerprint: `report-fingerprint-${suffix}`, actorId: 'user-001',
    occurredAt: at(1), eventId: `event-${suffix}-pending`
  });
  if (state === 'PENDING') return day;
  day.startReport({
    reportId: report.id, actorId: 'user-001', occurredAt: at(2),
    eventId: `event-${suffix}-printing`
  });
  if (state === 'PRINTING') return day;
  if (state === 'ISSUED') {
    day.markReportIssued({
      reportId: report.id, reportNumber: `X-${suffix}`, actorId: 'user-001',
      occurredAt: at(3), eventId: `event-${suffix}-issued`, evidence: committedEvidence
    });
    return day;
  }
  const evidence: FiscalOperationEvidence = state === 'RETRYING' || state === 'FAILED'
    ? notAppliedEvidence
    : unknownEvidence;
  day.recordReportError({
    reportId: report.id, code: 'FISCAL_PRINTER_TIMEOUT', evidence,
    retryable: state !== 'FAILED', actorId: 'user-001', occurredAt: at(3),
    eventId: `event-${suffix}-error`
  });
  if (state === 'RETRYING') {
    day.retryReport({
      reportId: report.id, actorId: 'user-001', occurredAt: at(4),
      eventId: `event-${suffix}-retrying`
    });
  } else if (state === 'FAILED') {
    day.markReportFailed({
      reportId: report.id, actorId: 'user-001', occurredAt: at(4),
      eventId: `event-${suffix}-failed`
    });
  }
  return day;
};

describe('DrizzleFiscalDayRepository', () => {
  const handles: DatabaseHandle[] = [];
  const directories: string[] = [];

  afterEach(() => {
    for (const handle of handles.splice(0)) handle.close();
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('finds pending and uncertain reports after reopening SQLite', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'supermarket-fiscal-day-'));
    directories.push(directory);
    const databasePath = join(directory, 'node.sqlite');
    let handle = openDatabase(databasePath);
    applyMigrations(handle.sqlite);
    let repository = new DrizzleFiscalDayRepository(handle);
    const unitOfWork = new SqliteUnitOfWork(handle.sqlite);
    const day = FiscalDay.open({
      id: 'day-001', businessDate: '2026-08-30', terminalId: 'terminal-001',
      originNodeId: 'node-001', openedBy: 'user-001',
      openedAt: new Date('2026-08-30T10:00:00.000Z'), eventId: 'event-001'
    });
    const report = day.requestReport({
      id: 'report-z-001', type: 'Z', idempotencyKey: 'request-z-001',
      requestFingerprint: 'fingerprint-z-001', actorId: 'user-001',
      occurredAt: new Date('2026-08-30T20:00:00.000Z'), eventId: 'event-002'
    });
    day.startReport({
      reportId: report.id, actorId: 'user-001',
      occurredAt: new Date('2026-08-30T20:01:00.000Z'), eventId: 'event-003'
    });
    day.recordReportError({
      reportId: report.id, code: 'FISCAL_PRINTER_TIMEOUT', evidence: unknownEvidence,
      retryable: true, actorId: 'user-001',
      occurredAt: new Date('2026-08-30T20:02:00.000Z'), eventId: 'event-004'
    });
    await unitOfWork.execute(() => repository.save(day));
    const pendingDay = FiscalDay.open({
      id: 'day-002', businessDate: '2026-08-31', terminalId: 'terminal-001',
      originNodeId: 'node-001', openedBy: 'user-001',
      openedAt: new Date('2026-08-31T10:00:00.000Z'), eventId: 'event-005'
    });
    pendingDay.requestReport({
      id: 'report-x-001', type: 'X', idempotencyKey: 'request-x-001',
      requestFingerprint: 'fingerprint-x-001', actorId: 'user-001',
      occurredAt: new Date('2026-08-31T12:00:00.000Z'), eventId: 'event-006'
    });
    await unitOfWork.execute(() => repository.save(pendingDay));
    handle.close();

    handle = openDatabase(databasePath);
    handles.push(handle);
    repository = new DrizzleFiscalDayRepository(handle);

    const recoverable = await repository.findRecoverable();

    expect(recoverable).toHaveLength(2);
    expect(recoverable[0]).toMatchObject({ id: 'day-001', state: 'Z_PENDING' });
    expect(recoverable[0]?.reports).toMatchObject([{
      id: 'report-z-001', type: 'Z', status: 'ERROR', lastEvidence: unknownEvidence
    }]);
    expect(recoverable[0]?.reports[0]?.transitions.at(-1)?.evidence).toEqual(unknownEvidence);
    expect(recoverable[1]?.reports).toMatchObject([{
      id: 'report-x-001', type: 'X', status: 'PENDING'
    }]);
  });

  it('rejects a report ID owned by another fiscal day and rolls back', async () => {
    const handle = openDatabase(':memory:');
    handles.push(handle);
    applyMigrations(handle.sqlite);
    const repository = new DrizzleFiscalDayRepository(handle);
    const unitOfWork = new SqliteUnitOfWork(handle.sqlite);
    const first = FiscalDay.open({
      id: 'day-a', businessDate: '2026-08-29', terminalId: 'terminal-a',
      originNodeId: 'node-001', openedBy: 'user-001',
      openedAt: new Date('2026-08-29T08:00:00.000Z'), eventId: 'event-day-a'
    });
    first.requestReport({
      id: 'shared-report', type: 'X', idempotencyKey: 'key-a',
      requestFingerprint: 'fingerprint-a', actorId: 'user-001',
      occurredAt: new Date('2026-08-29T09:00:00.000Z'), eventId: 'event-report-a'
    });
    await unitOfWork.execute(() => repository.save(first));
    const second = FiscalDay.open({
      id: 'day-b', businessDate: '2026-08-30', terminalId: 'terminal-b',
      originNodeId: 'node-001', openedBy: 'user-001',
      openedAt: new Date('2026-08-30T08:00:00.000Z'), eventId: 'event-day-b'
    });
    second.requestReport({
      id: 'shared-report', type: 'X', idempotencyKey: 'key-b',
      requestFingerprint: 'fingerprint-b', actorId: 'user-001',
      occurredAt: new Date('2026-08-30T09:00:00.000Z'), eventId: 'event-report-b'
    });

    await expect(unitOfWork.execute(() => repository.save(second)))
      .rejects.toMatchObject({ code: 'FISCAL_REPORT_IDENTITY_CONFLICT' });
    expect(await repository.findById('day-b')).toBeNull();
    expect((await repository.findById('day-a'))?.reports[0]).toMatchObject({
      id: 'shared-report', idempotencyKey: 'key-a'
    });
  });

  it('rolls back the day when a new report transition reuses an event ID', async () => {
    const handle = openDatabase(':memory:');
    handles.push(handle);
    applyMigrations(handle.sqlite);
    const repository = new DrizzleFiscalDayRepository(handle);
    const unitOfWork = new SqliteUnitOfWork(handle.sqlite);
    const day = createDayWithReportInState('PENDING', 1);
    await unitOfWork.execute(() => repository.save(day));
    day.startReport({
      reportId: 'report-001', actorId: 'user-001',
      occurredAt: new Date('2026-08-01T12:02:00.000Z'),
      eventId: 'event-001-pending'
    });

    await expect(unitOfWork.execute(() => repository.save(day)))
      .rejects.toMatchObject({ code: 'DATABASE_CONSTRAINT_VIOLATION' });
    expect((await repository.findById('day-001'))?.reports[0]).toMatchObject({
      status: 'PENDING', attempts: 0
    });
    expect(handle.sqlite.prepare(`
      select count(*) from fiscal_report_transitions where day_id = 'day-001'
    `).pluck().get()).toBe(1);
  });

  it('recovers days with non-terminal reports and excludes terminal-only days', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'supermarket-fiscal-report-states-'));
    directories.push(directory);
    const databasePath = join(directory, 'node.sqlite');
    let handle = openDatabase(databasePath);
    applyMigrations(handle.sqlite);
    const repository = new DrizzleFiscalDayRepository(handle);
    const unitOfWork = new SqliteUnitOfWork(handle.sqlite);
    const states: FiscalReportState[] = [
      'PENDING', 'PRINTING', 'ERROR', 'RETRYING', 'ISSUED', 'FAILED'
    ];
    for (const [index, state] of states.entries()) {
      await unitOfWork.execute(() => repository.save(createDayWithReportInState(state, index + 1)));
    }
    handle.close();

    handle = openDatabase(databasePath);
    handles.push(handle);
    const reopened = new DrizzleFiscalDayRepository(handle);
    const recoverable = await reopened.findRecoverable();

    expect(recoverable.map((day) => day.reports[0]?.status)).toEqual([
      'PENDING', 'PRINTING', 'ERROR', 'RETRYING'
    ]);
    expect((await reopened.findById('day-005'))?.reports[0]?.lastEvidence)
      .toEqual(committedEvidence);
    expect((await reopened.findById('day-006'))?.reports[0]?.lastEvidence)
      .toEqual(notAppliedEvidence);
    expect(handle.sqlite.prepare(`
      select count(*) from fiscal_reports where last_certainty is not null
    `).pluck().get()).toBe(0);
    expect(handle.sqlite.prepare(`
      select count(*) from fiscal_report_transitions where certainty is not null
    `).pluck().get()).toBe(0);
  });

  it('orders recoverable days and tied reports deterministically', async () => {
    const handle = openDatabase(':memory:');
    handles.push(handle);
    applyMigrations(handle.sqlite);
    const repository = new DrizzleFiscalDayRepository(handle);
    const unitOfWork = new SqliteUnitOfWork(handle.sqlite);
    const sameOpenTime = new Date('2026-08-01T08:00:00.000Z');
    await unitOfWork.execute(() => repository.save(
      createDayWithReportInState('PENDING', 2, sameOpenTime)
    ));
    const first = FiscalDay.open({
      id: 'day-001', businessDate: '2026-08-01', terminalId: 'terminal-001',
      originNodeId: 'node-001', openedBy: 'user-001', openedAt: sameOpenTime,
      eventId: 'event-day-001'
    });
    const sameRequestTime = new Date('2026-08-01T09:00:00.000Z');
    first.requestReport({
      id: 'report-b', type: 'X', idempotencyKey: 'key-b',
      requestFingerprint: 'fingerprint-b', actorId: 'user-001',
      occurredAt: sameRequestTime, eventId: 'event-report-b'
    });
    first.requestReport({
      id: 'report-a', type: 'X', idempotencyKey: 'key-a',
      requestFingerprint: 'fingerprint-a', actorId: 'user-001',
      occurredAt: sameRequestTime, eventId: 'event-report-a'
    });
    await unitOfWork.execute(() => repository.save(first));

    const recoverable = await repository.findRecoverable();
    expect(recoverable.map(({ id }) => id)).toEqual(['day-001', 'day-002']);
    expect(recoverable[0]?.reports.map(({ id }) => id)).toEqual(['report-a', 'report-b']);
  });
});
