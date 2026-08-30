import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  application,
  type ExecutionContext
} from '@supermarket/core';
import { FiscalPrinterFake } from '@supermarket/driver-fiscal';
import { DrizzleAuditWriter } from './audit-writer.js';
import { DrizzleBusinessEventStore } from './business-event-store.js';
import { openDatabase, type DatabaseHandle } from './connection.js';
import { DrizzleFiscalDayRepository } from './fiscal-day-repository.js';
import { DrizzleFiscalDocumentRepository } from './fiscal-document-repository.js';
import { applyMigrations } from './migrations.js';
import { DrizzleOutboxStore } from './outbox-store.js';
import { SqliteUnitOfWork } from './unit-of-work.js';

const { IssueFiscalDocument, PrintXReport, PrintZReport, ReconcileFiscalState } = application;

describe('fiscal flow', () => {
  const handles: DatabaseHandle[] = [];
  const directories: string[] = [];

  afterEach(() => {
    for (const handle of handles.splice(0)) handle.close();
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('reconciles a timeout after restart without duplicate printing and persists X/Z', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'supermarket-fiscal-flow-'));
    directories.push(directory);
    const databasePath = join(directory, 'node.sqlite');
    let handle = openDatabase(databasePath);
    applyMigrations(handle.sqlite);
    const printer = new FiscalPrinterFake({
      now: () => new Date('2026-08-30T20:00:00.000Z')
    });
    printer.queueResponses('ACK', 'ACK', 'ACK', 'TIMEOUT');
    let sequence = 0;
    const ids = { generate: () => `fiscal-id-${++sequence}` };
    const clock = { now: () => new Date('2026-08-30T20:00:00.000Z') };
    const authorization = { authorize: async () => true };
    const context: ExecutionContext = {
      actorId: 'user-001', actorRoleCodes: ['manager'], terminalId: 'terminal-001',
      originNodeId: 'node-001', correlationId: 'correlation-001',
      idempotencyKey: 'invoice-request-001'
    };
    const build = (database: DatabaseHandle) => {
      const unitOfWork = new SqliteUnitOfWork(database.sqlite);
      const events = new DrizzleBusinessEventStore(database);
      const outbox = new DrizzleOutboxStore(database);
      const audit = new DrizzleAuditWriter(database);
      const documents = new DrizzleFiscalDocumentRepository(database);
      const days = new DrizzleFiscalDayRepository(database);
      return {
        documents,
        days,
        issue: new IssueFiscalDocument(
          documents, printer, authorization, ids, ids, ids, clock,
          unitOfWork, events, outbox, audit
        ),
        reconcile: new ReconcileFiscalState(
          documents, printer, authorization, ids, ids, clock,
          unitOfWork, events, outbox, audit
        ),
        x: new PrintXReport(
          days, printer, authorization, ids, ids, ids, clock,
          unitOfWork, events, outbox, audit
        ),
        z: new PrintZReport(
          days, printer, authorization, ids, ids, ids, clock,
          unitOfWork, events, outbox, audit
        )
      };
    };
    let services = build(handle);
    const issue = await services.issue.execute({
      content: {
        referenceId: 'sale-001', type: 'INVOICE', currencyCode: 'USD',
        lines: [{
          id: 'line-001', description: 'Coffee', quantityScaled: 1, quantityScale: 0,
          unitPriceMinorUnits: 1_000, taxRateBasisPoints: 0, totalMinorUnits: 1_000
        }],
        payments: [{ methodCode: 'CASH_USD', amountMinorUnits: 1_000 }],
        totalMinorUnits: 1_000
      },
      reason: 'Completed sale'
    }, context);
    expect(issue.ok).toBe(false);
    const documentId = (await services.documents.findByIdempotencyKey(
      'node-001', 'invoice-request-001'
    ))?.id;
    expect(documentId).toBeTruthy();
    expect(printer.commands.map(({ name }) => name)).toEqual([
      'OPEN', 'ITEM', 'PAYMENT', 'CLOSE'
    ]);
    handle.close();

    handle = openDatabase(databasePath);
    handles.push(handle);
    services = build(handle);
    const reconciled = await services.reconcile.execute({
      documentId: documentId ?? '', reason: 'Startup recovery'
    }, context);
    expect(reconciled).toMatchObject({
      ok: true,
      value: { status: 'ISSUED', fiscalNumber: 'INV-000001' }
    });
    expect(printer.commands).toHaveLength(4);

    const x = await services.x.execute({
      dayId: 'day-001', businessDate: '2026-08-30', reason: 'Control report'
    }, { ...context, idempotencyKey: 'x-request-001' });
    expect(x).toMatchObject({ ok: true, value: { dayState: 'DAY_OPEN', status: 'ISSUED' } });
    const z = await services.z.execute({
      dayId: 'day-001', businessDate: '2026-08-30', reason: 'Daily close'
    }, { ...context, idempotencyKey: 'z-request-001' });
    expect(z).toMatchObject({ ok: true, value: { dayState: 'DAY_CLOSED', status: 'ISSUED' } });

    expect(handle.sqlite.prepare(
      "select count(*) from business_event where event_type = 'FiscalDocumentIssued'"
    ).pluck().get()).toBe(1);
    expect(handle.sqlite.prepare(
      "select count(*) from outbox_event where event_type in ('FiscalDocumentIssued', 'FiscalXReportIssued', 'FiscalZReportIssued')"
    ).pluck().get()).toBe(3);
    expect(handle.sqlite.prepare(
      "select count(*) from audit_log where action like 'FISCAL_%'"
    ).pluck().get()).toBe(4);
  });
});
