import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  FiscalDocument,
  type FiscalDocumentState,
  type FiscalOperationEvidence
} from '@supermarket/core';
import { openDatabase, type DatabaseHandle } from './connection.js';
import { DrizzleFiscalDocumentRepository } from './fiscal-document-repository.js';
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

const createDocumentInState = (
  state: FiscalDocumentState,
  sequence: number,
  createdAt?: Date
): FiscalDocument => {
  const suffix = String(sequence).padStart(3, '0');
  const at = (minute: number): Date => new Date(`2026-08-30T10:${String(minute).padStart(2, '0')}:00.000Z`);
  const document = FiscalDocument.create({
    id: `fiscal-${suffix}`,
    content: {
      referenceId: `sale-${suffix}`, type: 'INVOICE', currencyCode: 'USD',
      lines: [{
        id: `line-${suffix}`, description: 'Coffee', quantityScaled: 1, quantityScale: 0,
        unitPriceMinorUnits: 1_000, taxRateBasisPoints: 0, totalMinorUnits: 1_000
      }],
      payments: [{ methodCode: 'CASH_USD', amountMinorUnits: 1_000 }],
      totalMinorUnits: 1_000
    },
    idempotencyKey: `request-${suffix}`, requestFingerprint: `fingerprint-${suffix}`,
    terminalId: 'terminal-001', originNodeId: 'node-001', createdBy: 'user-001',
    createdAt: createdAt ?? at(sequence), eventId: `event-${suffix}-pending`
  });
  if (state === 'PENDING') return document;
  document.startPrinting({
    actorId: 'user-001', occurredAt: at(sequence + 10), eventId: `event-${suffix}-printing`
  });
  if (state === 'PRINTING') return document;
  if (state === 'ISSUED') {
    document.markIssued({
      fiscalNumber: `INV-${suffix}`, actorId: 'user-001', occurredAt: at(sequence + 20),
      eventId: `event-${suffix}-issued`, evidence: committedEvidence
    });
    return document;
  }
  const evidence: FiscalOperationEvidence = state === 'RETRYING' || state === 'FAILED'
    ? notAppliedEvidence
    : unknownEvidence;
  document.recordError({
    code: 'FISCAL_PRINTER_TIMEOUT', evidence, retryable: state !== 'FAILED',
    actorId: 'user-001', occurredAt: at(sequence + 20), eventId: `event-${suffix}-error`
  });
  if (state === 'RETRYING') {
    document.beginRetry({
      actorId: 'user-001', occurredAt: at(sequence + 30), eventId: `event-${suffix}-retrying`
    });
  } else if (state === 'FAILED') {
    document.markFailed({
      actorId: 'user-001', occurredAt: at(sequence + 30), eventId: `event-${suffix}-failed`
    });
  }
  return document;
};

describe('DrizzleFiscalDocumentRepository', () => {
  const handles: DatabaseHandle[] = [];
  const directories: string[] = [];

  afterEach(() => {
    for (const handle of handles.splice(0)) handle.close();
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rehydrates a recoverable state after reopening SQLite and protects issued evidence', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'supermarket-fiscal-'));
    directories.push(directory);
    const databasePath = join(directory, 'node.sqlite');
    let handle = openDatabase(databasePath);
    applyMigrations(handle.sqlite);
    let repository = new DrizzleFiscalDocumentRepository(handle);
    let unitOfWork = new SqliteUnitOfWork(handle.sqlite);
    const document = FiscalDocument.create({
      id: 'fiscal-001',
      content: {
        referenceId: 'sale-001', type: 'INVOICE', currencyCode: 'USD',
        lines: [{
          id: 'line-001', description: 'Coffee', quantityScaled: 1, quantityScale: 0,
          unitPriceMinorUnits: 1_000, taxRateBasisPoints: 0, totalMinorUnits: 1_000
        }],
        payments: [{ methodCode: 'CASH_USD', amountMinorUnits: 1_000 }],
        totalMinorUnits: 1_000
      },
      idempotencyKey: 'request-001', requestFingerprint: 'fingerprint-001',
      terminalId: 'terminal-001', originNodeId: 'node-001', createdBy: 'user-001',
      createdAt: new Date('2026-08-30T10:00:00.000Z'), eventId: 'event-001'
    });
    await unitOfWork.execute(() => repository.save(document));
    document.startPrinting({
      actorId: 'user-001', occurredAt: new Date('2026-08-30T10:01:00.000Z'),
      eventId: 'event-002'
    });
    document.recordError({
      code: 'FISCAL_PRINTER_TIMEOUT', evidence: unknownEvidence, retryable: true,
      actorId: 'user-001', occurredAt: new Date('2026-08-30T10:01:30.000Z'),
      eventId: 'event-003'
    });
    await unitOfWork.execute(() => repository.save(document));
    handle.close();

    handle = openDatabase(databasePath);
    handles.push(handle);
    repository = new DrizzleFiscalDocumentRepository(handle);
    unitOfWork = new SqliteUnitOfWork(handle.sqlite);
    const recovered = await repository.findByIdempotencyKey('node-001', 'request-001');
    expect(recovered).toMatchObject({
      status: 'ERROR', attempts: 1, version: 3, lastEvidence: unknownEvidence
    });
    expect(recovered?.transitions.at(-1)?.evidence).toEqual(unknownEvidence);
    expect((await repository.findRecoverable()).map(({ id }) => id)).toEqual(['fiscal-001']);
    recovered?.markIssued({
      fiscalNumber: 'INV-000001', actorId: 'user-001',
      occurredAt: new Date('2026-08-30T10:02:00.000Z'), eventId: 'event-004',
      evidence: committedEvidence
    });
    if (recovered) await unitOfWork.execute(() => repository.save(recovered));
    expect(await repository.findById('fiscal-001')).toMatchObject({
      status: 'ISSUED', lastEvidence: committedEvidence
    });
    expect(() => handle.sqlite.prepare(
      "update fiscal_documents set status = 'ERROR' where id = 'fiscal-001'"
    ).run()).toThrowError('issued fiscal documents are immutable');
    expect(() => handle.sqlite.prepare(
      "delete from fiscal_document_transitions where event_id = 'event-001'"
    ).run()).toThrowError('fiscal document transitions are append-only');
    expect(() => handle.sqlite.prepare(`
      insert into fiscal_document_lines (
        document_id, sequence, line_id, description, quantity_scaled,
        quantity_scale, unit_price_minor_units, tax_rate_basis_points,
        total_minor_units
      ) values ('fiscal-001', 1, 'late-line', 'Late line', 1, 0, 0, 0, 0)
    `).run()).toThrowError('fiscal document content is sealed');
    expect(() => handle.sqlite.prepare(`
      insert into fiscal_document_payments (
        document_id, sequence, method_code, amount_minor_units
      ) values ('fiscal-001', 1, 'LATE', 1)
    `).run()).toThrowError('fiscal document content is sealed');
  });

  it('rolls back the aggregate when a new transition reuses an event ID', async () => {
    const handle = openDatabase(':memory:');
    handles.push(handle);
    applyMigrations(handle.sqlite);
    const repository = new DrizzleFiscalDocumentRepository(handle);
    const unitOfWork = new SqliteUnitOfWork(handle.sqlite);
    const document = createDocumentInState('PENDING', 1);
    await unitOfWork.execute(() => repository.save(document));
    document.startPrinting({
      actorId: 'user-001', occurredAt: new Date('2026-08-30T10:20:00.000Z'),
      eventId: 'event-001-pending'
    });

    await expect(unitOfWork.execute(() => repository.save(document)))
      .rejects.toMatchObject({ code: 'DATABASE_CONSTRAINT_VIOLATION' });
    expect(await repository.findById('fiscal-001')).toMatchObject({
      status: 'PENDING', version: 1, attempts: 0
    });
    expect(handle.sqlite.prepare(`
      select count(*) from fiscal_document_transitions where document_id = 'fiscal-001'
    `).pluck().get()).toBe(1);
  });

  it('recovers every non-terminal document state after reopening SQLite', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'supermarket-fiscal-states-'));
    directories.push(directory);
    const databasePath = join(directory, 'node.sqlite');
    let handle = openDatabase(databasePath);
    applyMigrations(handle.sqlite);
    const repository = new DrizzleFiscalDocumentRepository(handle);
    const unitOfWork = new SqliteUnitOfWork(handle.sqlite);
    const states: FiscalDocumentState[] = [
      'PENDING', 'PRINTING', 'ERROR', 'RETRYING', 'ISSUED', 'FAILED'
    ];
    for (const [index, state] of states.entries()) {
      await unitOfWork.execute(() => repository.save(createDocumentInState(state, index + 1)));
    }
    handle.close();

    handle = openDatabase(databasePath);
    handles.push(handle);
    const reopened = new DrizzleFiscalDocumentRepository(handle);

    expect((await reopened.findRecoverable()).map(({ status }) => status)).toEqual([
      'PENDING', 'PRINTING', 'ERROR', 'RETRYING'
    ]);
    expect((await reopened.findById('fiscal-005'))?.lastEvidence).toEqual(committedEvidence);
    expect((await reopened.findById('fiscal-006'))?.lastEvidence).toEqual(notAppliedEvidence);
    expect(handle.sqlite.prepare(`
      select count(*) from fiscal_documents where last_certainty is not null
    `).pluck().get()).toBe(0);
    expect(handle.sqlite.prepare(`
      select count(*) from fiscal_document_transitions where certainty is not null
    `).pluck().get()).toBe(0);
  });

  it('orders recoverable documents deterministically when timestamps tie', async () => {
    const handle = openDatabase(':memory:');
    handles.push(handle);
    applyMigrations(handle.sqlite);
    const repository = new DrizzleFiscalDocumentRepository(handle);
    const unitOfWork = new SqliteUnitOfWork(handle.sqlite);
    const sameTime = new Date('2026-08-30T10:00:00.000Z');
    await unitOfWork.execute(() => repository.save(
      createDocumentInState('PENDING', 2, sameTime)
    ));
    await unitOfWork.execute(() => repository.save(
      createDocumentInState('PENDING', 1, sameTime)
    ));

    expect((await repository.findRecoverable()).map(({ id }) => id)).toEqual([
      'fiscal-001', 'fiscal-002'
    ]);
  });
});
