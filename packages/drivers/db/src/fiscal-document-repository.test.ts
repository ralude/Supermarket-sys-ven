import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FiscalDocument } from '@supermarket/core';
import { openDatabase, type DatabaseHandle } from './connection.js';
import { DrizzleFiscalDocumentRepository } from './fiscal-document-repository.js';
import { applyMigrations } from './migrations.js';
import { SqliteUnitOfWork } from './unit-of-work.js';

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
    await unitOfWork.execute(() => repository.save(document));
    handle.close();

    handle = openDatabase(databasePath);
    handles.push(handle);
    repository = new DrizzleFiscalDocumentRepository(handle);
    unitOfWork = new SqliteUnitOfWork(handle.sqlite);
    const recovered = await repository.findByIdempotencyKey('node-001', 'request-001');
    expect(recovered).toMatchObject({ status: 'PRINTING', attempts: 1, version: 2 });
    expect((await repository.findRecoverable()).map(({ id }) => id)).toEqual(['fiscal-001']);
    recovered?.markIssued({
      fiscalNumber: 'INV-000001', actorId: 'user-001',
      occurredAt: new Date('2026-08-30T10:02:00.000Z'), eventId: 'event-003'
    });
    if (recovered) await unitOfWork.execute(() => repository.save(recovered));
    expect((await repository.findById('fiscal-001'))?.status).toBe('ISSUED');
    expect(() => handle.sqlite.prepare(
      "update fiscal_documents set status = 'ERROR' where id = 'fiscal-001'"
    ).run()).toThrowError('issued fiscal documents are immutable');
    expect(() => handle.sqlite.prepare(
      "delete from fiscal_document_transitions where event_id = 'event-001'"
    ).run()).toThrowError('fiscal document transitions are append-only');
  });
});
