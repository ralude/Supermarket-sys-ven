import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { InfrastructureError } from '@supermarket/shared';
import { openDatabase, type DatabaseHandle } from './connection.js';
import { DrizzleFiscalDayRepository } from './fiscal-day-repository.js';
import { DrizzleFiscalDocumentRepository } from './fiscal-document-repository.js';
import {
  applyMigrations,
  migrateDatabase,
  migrations,
  type Migration
} from './migrations.js';

describe('database migrations', () => {
  const handles: DatabaseHandle[] = [];
  const directories: string[] = [];

  afterEach(() => {
    for (const handle of handles.splice(0)) handle.close();
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('creates the versioned relational schema and is idempotent', () => {
    const handle = openDatabase(':memory:');
    handles.push(handle);

    expect(applyMigrations(handle.sqlite)).toEqual(migrations.map((migration) => migration.version));
    expect(applyMigrations(handle.sqlite)).toEqual([]);

    const applied = handle.sqlite.prepare(
      'select version, name, checksum from schema_migrations order by version'
    ).all();
    expect(applied).toEqual([
      expect.objectContaining({ version: 1, name: 'initial_business_schema' }),
      expect.objectContaining({ version: 2, name: 'business_event_ledger' }),
      expect.objectContaining({ version: 3, name: 'outbox' }),
      expect.objectContaining({ version: 4, name: 'audit_log' }),
      expect.objectContaining({ version: 5, name: 'idempotency' }),
      expect.objectContaining({ version: 6, name: 'cash_operational_integrity' }),
      expect.objectContaining({ version: 7, name: 'sale_shift_payments' }),
      expect.objectContaining({ version: 8, name: 'inventory' }),
      expect.objectContaining({ version: 9, name: 'fiscal' }),
      expect.objectContaining({ version: 10, name: 'fiscal_operation_evidence' }),
      expect.objectContaining({ version: 11, name: 'fiscal_integrity_guards' })
    ]);

    const tables = handle.sqlite.prepare(
      "select name from sqlite_master where type = 'table' order by name"
    ).pluck().all();
    expect(tables).toEqual(expect.arrayContaining([
      'business_event',
      'audit_log',
      'cash_movements',
      'exchange_rates',
      'fiscal_document_lines',
      'fiscal_document_payments',
      'fiscal_document_transitions',
      'fiscal_documents',
      'fiscal_days',
      'fiscal_report_transitions',
      'fiscal_reports',
      'idempotency_key',
      'outbox_event',
      'product_barcodes',
      'product_price_history',
      'products',
      'sale_discounts',
      'sale_items',
      'sale_payments',
      'sales',
      'schema_migrations',
      'shift_closing_balances',
      'shifts',
      'stock_batches',
      'stock_items',
      'stock_movements'
    ]));
    expect(handle.sqlite.prepare("pragma table_info('sales')").all())
      .toEqual(expect.arrayContaining([expect.objectContaining({ name: 'shift_id', notnull: 1 })]));
    expect(handle.sqlite.prepare("pragma table_info('cash_movements')").all())
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'source_id' }),
        expect.objectContaining({ name: 'source_event_id' })
      ]));
    for (const table of [
      'fiscal_documents',
      'fiscal_document_transitions',
      'fiscal_reports',
      'fiscal_report_transitions'
    ]) {
      const prefix = table.endsWith('transitions') ? '' : 'last_';
      expect(handle.sqlite.prepare(`pragma table_info('${table}')`).all())
        .toEqual(expect.arrayContaining([
          expect.objectContaining({ name: `${prefix}dispatch_state` }),
          expect.objectContaining({ name: `${prefix}command_effect` }),
          expect.objectContaining({ name: `${prefix}fiscal_commit` }),
          expect.objectContaining({ name: `${prefix}print_delivery` })
        ]));
    }
  });

  it('advances an existing database and rolls back a failed migration', () => {
    const handle = openDatabase(':memory:');
    handles.push(handle);
    applyMigrations(handle.sqlite);
    const next: Migration = {
      version: migrations.length + 1,
      name: 'add_probe',
      sql: 'create table migration_probe (id text primary key);'
    };

    expect(applyMigrations(handle.sqlite, [...migrations, next])).toEqual([next.version]);
    expect(() => applyMigrations(handle.sqlite, [
      ...migrations,
      next,
      { version: next.version + 1, name: 'broken', sql: 'create table' }
    ])).toThrowError(expect.objectContaining({ code: 'DATABASE_MIGRATION_FAILED' }));

    expect(handle.sqlite.prepare(
      'select count(*) from schema_migrations where version = ?'
    ).pluck().get(next.version + 1)).toBe(0);
  });

  it('rolls back DDL, DML and trigger changes from a partially executed migration', () => {
    const handle = openDatabase(':memory:');
    handles.push(handle);
    applyMigrations(handle.sqlite);
    const broken: Migration = {
      version: migrations.length + 1,
      name: 'broken_after_changes',
      sql: `
        create table rollback_probe (id text primary key);
        insert into rollback_probe (id) values ('changed');
        drop trigger fiscal_documents_no_delete;
        insert into missing_table (id) values ('fail');
      `
    };

    expect(() => applyMigrations(handle.sqlite, [...migrations, broken]))
      .toThrowError(expect.objectContaining({ code: 'DATABASE_MIGRATION_FAILED' }));
    expect(handle.sqlite.prepare(
      "select count(*) from sqlite_master where type = 'table' and name = 'rollback_probe'"
    ).pluck().get()).toBe(0);
    expect(handle.sqlite.prepare(
      "select count(*) from sqlite_master where type = 'trigger' and name = 'fiscal_documents_no_delete'"
    ).pluck().get()).toBe(1);
  });

  it('restores a verified backup when post-migration validation fails', () => {
    const directory = mkdtempSync(join(tmpdir(), 'supermarket-migration-'));
    directories.push(directory);
    const databasePath = join(directory, 'node.sqlite');
    const backupDirectory = join(directory, 'backups');
    migrateDatabase(databasePath, { backupDirectory });
    const initial = openDatabase(databasePath);
    initial.sqlite.prepare('insert into categories (id, name, is_active) values (?, ?, ?)')
      .run('category-001', 'Food', 1);
    initial.close();

    const next: Migration = {
      version: migrations.length + 1,
      name: 'post_backup_change',
      sql: 'create table post_backup_change (id text primary key);'
    };
    expect(() => migrateDatabase(databasePath, {
      backupDirectory,
      migrations: [...migrations, next],
      validate: () => {
        throw new Error('Injected startup validation failure.');
      }
    })).toThrowError(expect.objectContaining({ code: 'DATABASE_MIGRATION_VALIDATION_FAILED' }));

    const restored = openDatabase(databasePath);
    handles.push(restored);
    expect(restored.sqlite.prepare('select name from categories where id = ?')
      .pluck().get('category-001')).toBe('Food');
    expect(restored.sqlite.prepare(
      "select count(*) from sqlite_master where type = 'table' and name = 'post_backup_change'"
    ).pluck().get()).toBe(0);
    expect(readdirSync(backupDirectory)).toHaveLength(1);
  });

  it('reports migration checksum drift instead of rewriting history', () => {
    const handle = openDatabase(':memory:');
    handles.push(handle);
    applyMigrations(handle.sqlite);

    let caught: unknown;
    try {
      applyMigrations(handle.sqlite, [{ ...migrations[0] as Migration, sql: 'select 1;' }]);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(InfrastructureError);
    expect((caught as InfrastructureError).code).toBe('DATABASE_MIGRATION_MISMATCH');
  });

  it('upgrades legacy fiscal certainty without claiming a safe retry', async () => {
    const handle = openDatabase(':memory:');
    handles.push(handle);
    const legacyMigrations = migrations.filter(({ version }) => version <= 9);
    applyMigrations(handle.sqlite, legacyMigrations);
    handle.sqlite.exec(`
      insert into fiscal_documents (
        id, reference_id, document_type, currency_code, total_minor_units,
        idempotency_key, request_fingerprint, terminal_id, origin_node_id,
        created_by, created_at, status, version, attempts, fiscal_number,
        last_error_code, last_certainty, last_failure_retryable
      ) values (
        'legacy-document', 'legacy-sale', 'INVOICE', 'USD', 100,
        'legacy-key', 'legacy-fingerprint', 'terminal-001', 'node-001',
        'user-001', 1, 'ERROR', 2, 1, null,
        'FISCAL_PRINTER_TIMEOUT', 'NOT_SENT', 1
      );
      insert into fiscal_document_lines (
        document_id, sequence, line_id, description, quantity_scaled,
        quantity_scale, unit_price_minor_units, tax_rate_basis_points,
        total_minor_units
      ) values (
        'legacy-document', 0, 'legacy-line', 'Legacy item', 1, 0, 100, 0, 100
      );
      insert into fiscal_document_payments (
        document_id, sequence, method_code, amount_minor_units
      ) values ('legacy-document', 0, 'CASH_USD', 100);
      insert into fiscal_document_transitions (
        event_id, document_id, aggregate_version, from_status, to_status,
        actor_id, occurred_at, error_code, certainty
      ) values (
        'legacy-document-event', 'legacy-document', 2, 'PRINTING', 'ERROR',
        'user-001', 2, 'FISCAL_PRINTER_TIMEOUT', 'NOT_SENT'
      );
      insert into fiscal_documents (
        id, reference_id, document_type, currency_code, total_minor_units,
        idempotency_key, request_fingerprint, terminal_id, origin_node_id,
        created_by, created_at, status, version, attempts, fiscal_number,
        last_error_code, last_certainty, last_failure_retryable
      ) values (
        'legacy-unknown-document', 'legacy-unknown-sale', 'INVOICE', 'USD', 100,
        'legacy-unknown-key', 'legacy-unknown-fingerprint', 'terminal-001', 'node-001',
        'user-001', 3, 'ERROR', 2, 1, null,
        'FISCAL_PRINTER_TIMEOUT', 'UNKNOWN', 1
      );
      insert into fiscal_documents (
        id, reference_id, document_type, currency_code, total_minor_units,
        idempotency_key, request_fingerprint, terminal_id, origin_node_id,
        created_by, created_at, status, version, attempts, fiscal_number,
        last_error_code, last_certainty, last_failure_retryable
      ) values (
        'legacy-issued-document', 'legacy-issued-sale', 'INVOICE', 'USD', 100,
        'legacy-issued-key', 'legacy-issued-fingerprint', 'terminal-001', 'node-001',
        'user-001', 4, 'ISSUED', 2, 1, 'INV-LEGACY',
        null, 'UNKNOWN', 0
      );
      insert into fiscal_document_transitions (
        event_id, document_id, aggregate_version, from_status, to_status,
        actor_id, occurred_at, error_code, certainty
      ) values (
        'legacy-issued-document-event', 'legacy-issued-document', 2,
        'PRINTING', 'ISSUED', 'user-001', 5, null, 'UNKNOWN'
      );
      insert into fiscal_days (
        id, business_date, terminal_id, origin_node_id, opened_by, opened_at,
        state, version
      ) values (
        'legacy-day', '2026-08-29', 'terminal-002', 'node-001', 'user-001', 1,
        'DAY_OPEN', 4
      );
      insert into fiscal_reports (
        id, day_id, origin_node_id, report_type, idempotency_key,
        request_fingerprint, status, attempts, report_number, last_error_code,
        last_certainty, retryable, requested_by, requested_at
      ) values (
        'legacy-report', 'legacy-day', 'node-001', 'X', 'legacy-report-key',
        'legacy-report-fingerprint', 'ERROR', 1, null,
        'FISCAL_PRINTER_NAK', 'REJECTED', 0, 'user-001', 2
      );
      insert into fiscal_report_transitions (
        event_id, day_id, report_id, aggregate_version, from_status, to_status,
        actor_id, occurred_at, error_code, certainty
      ) values (
        'legacy-report-event', 'legacy-day', 'legacy-report', 2,
        'PRINTING', 'ERROR', 'user-001', 2, 'FISCAL_PRINTER_NAK', 'REJECTED'
      );
      insert into fiscal_reports (
        id, day_id, origin_node_id, report_type, idempotency_key,
        request_fingerprint, status, attempts, report_number, last_error_code,
        last_certainty, retryable, requested_by, requested_at
      ) values (
        'legacy-unknown-report', 'legacy-day', 'node-001', 'X',
        'legacy-unknown-report-key', 'legacy-unknown-report-fingerprint',
        'ERROR', 1, null, 'FISCAL_PRINTER_TIMEOUT', 'UNKNOWN', 1, 'user-001', 3
      );
      insert into fiscal_report_transitions (
        event_id, day_id, report_id, aggregate_version, from_status, to_status,
        actor_id, occurred_at, error_code, certainty
      ) values (
        'legacy-unknown-report-event', 'legacy-day', 'legacy-unknown-report', 3,
        'PRINTING', 'ERROR', 'user-001', 3, 'FISCAL_PRINTER_TIMEOUT', 'UNKNOWN'
      );
      insert into fiscal_reports (
        id, day_id, origin_node_id, report_type, idempotency_key,
        request_fingerprint, status, attempts, report_number, last_error_code,
        last_certainty, retryable, requested_by, requested_at
      ) values (
        'legacy-issued-report', 'legacy-day', 'node-001', 'X',
        'legacy-issued-report-key', 'legacy-issued-report-fingerprint',
        'ISSUED', 1, 'X-LEGACY', null, 'UNKNOWN', 0, 'user-001', 4
      );
      insert into fiscal_report_transitions (
        event_id, day_id, report_id, aggregate_version, from_status, to_status,
        actor_id, occurred_at, error_code, certainty
      ) values (
        'legacy-issued-report-event', 'legacy-day', 'legacy-issued-report', 4,
        'PRINTING', 'ISSUED', 'user-001', 4, null, 'UNKNOWN'
      );
    `);

    expect(applyMigrations(handle.sqlite)).toEqual([10, 11]);
    expect(handle.sqlite.prepare(`
      select last_dispatch_state as dispatchState,
        last_command_effect as commandEffect,
        last_fiscal_commit as fiscalCommit,
        last_print_delivery as printDelivery
      from fiscal_documents where id = 'legacy-document'
    `).get()).toEqual({
      dispatchState: 'STARTED', commandEffect: 'UNKNOWN',
      fiscalCommit: 'UNKNOWN', printDelivery: 'UNKNOWN'
    });
    expect(handle.sqlite.prepare(`
      select last_dispatch_state as dispatchState,
        last_command_effect as commandEffect,
        last_fiscal_commit as fiscalCommit,
        last_print_delivery as printDelivery
      from fiscal_documents where id = 'legacy-unknown-document'
    `).get()).toEqual({
      dispatchState: 'STARTED', commandEffect: 'UNKNOWN',
      fiscalCommit: 'UNKNOWN', printDelivery: 'UNKNOWN'
    });
    expect(handle.sqlite.prepare(`
      select last_dispatch_state as dispatchState,
        last_command_effect as commandEffect,
        last_fiscal_commit as fiscalCommit,
        last_print_delivery as printDelivery
      from fiscal_documents where id = 'legacy-issued-document'
    `).get()).toEqual({
      dispatchState: 'RESULT_RECEIVED', commandEffect: 'APPLIED',
      fiscalCommit: 'COMMITTED', printDelivery: 'UNKNOWN'
    });
    expect(handle.sqlite.prepare(`
      select last_dispatch_state as dispatchState,
        last_command_effect as commandEffect,
        last_fiscal_commit as fiscalCommit,
        last_print_delivery as printDelivery
      from fiscal_reports where id = 'legacy-report'
    `).get()).toEqual({
      dispatchState: 'RESULT_RECEIVED', commandEffect: 'REJECTED',
      fiscalCommit: 'UNKNOWN', printDelivery: 'UNKNOWN'
    });
    expect(handle.sqlite.prepare(`
      select last_dispatch_state as dispatchState,
        last_command_effect as commandEffect,
        last_fiscal_commit as fiscalCommit,
        last_print_delivery as printDelivery
      from fiscal_reports where id = 'legacy-unknown-report'
    `).get()).toEqual({
      dispatchState: 'STARTED', commandEffect: 'UNKNOWN',
      fiscalCommit: 'UNKNOWN', printDelivery: 'UNKNOWN'
    });
    expect(handle.sqlite.prepare(`
      select last_dispatch_state as dispatchState,
        last_command_effect as commandEffect,
        last_fiscal_commit as fiscalCommit,
        last_print_delivery as printDelivery
      from fiscal_reports where id = 'legacy-issued-report'
    `).get()).toEqual({
      dispatchState: 'RESULT_RECEIVED', commandEffect: 'APPLIED',
      fiscalCommit: 'COMMITTED', printDelivery: 'UNKNOWN'
    });
    expect(handle.sqlite.prepare(`
      select dispatch_state as dispatchState, command_effect as commandEffect,
        fiscal_commit as fiscalCommit, print_delivery as printDelivery
      from fiscal_document_transitions where event_id = 'legacy-document-event'
    `).get()).toEqual({
      dispatchState: 'STARTED', commandEffect: 'UNKNOWN',
      fiscalCommit: 'UNKNOWN', printDelivery: 'UNKNOWN'
    });
    for (const table of [
      'fiscal_documents', 'fiscal_document_transitions',
      'fiscal_reports', 'fiscal_report_transitions'
    ]) {
      const column = table.endsWith('transitions') ? 'certainty' : 'last_certainty';
      expect(handle.sqlite.prepare(
        `select count(*) from ${table} where ${column} is not null`
      ).pluck().get()).toBe(0);
    }
    expect(() => handle.sqlite.prepare(`
      update fiscal_documents set last_dispatch_state = null
      where id = 'legacy-document'
    `).run()).toThrowError('fiscal operation evidence is invalid');
    expect(() => handle.sqlite.prepare(`
      update fiscal_documents set
        last_dispatch_state = 'NOT_STARTED',
        last_command_effect = 'APPLIED',
        last_fiscal_commit = 'COMMITTED',
        last_print_delivery = 'COMPLETE'
      where id = 'legacy-document'
    `).run()).toThrowError('fiscal operation evidence is invalid');
    expect(() => handle.sqlite.prepare(`
      update fiscal_documents set last_certainty = 'UNKNOWN'
      where id = 'legacy-document'
    `).run()).toThrowError('legacy fiscal certainty is read-only');
    expect(() => handle.sqlite.prepare(`
      update fiscal_reports set last_print_delivery = null
      where id = 'legacy-report'
    `).run()).toThrowError('fiscal operation evidence is invalid');
    handle.sqlite.prepare(`
      insert into fiscal_days (
        id, business_date, terminal_id, origin_node_id, opened_by, opened_at,
        state, version
      ) values (
        'other-day', '2026-08-30', 'terminal-003', 'node-001', 'user-001', 7,
        'DAY_OPEN', 1
      )
    `).run();
    expect(() => handle.sqlite.prepare(`
      insert into fiscal_report_transitions (
        event_id, day_id, report_id, aggregate_version, from_status, to_status,
        actor_id, occurred_at, error_code, certainty,
        dispatch_state, command_effect, fiscal_commit, print_delivery
      ) values (
        'cross-day-event', 'other-day', 'legacy-report', 2, null, 'PENDING',
        'user-001', 8, null, null, null, null, null, null
      )
    `).run()).toThrowError('fiscal report transition day does not match report');
    expect(handle.sqlite.prepare(`
      select dispatch_state as dispatchState, command_effect as commandEffect,
        fiscal_commit as fiscalCommit, print_delivery as printDelivery
      from fiscal_document_transitions where event_id = 'legacy-issued-document-event'
    `).get()).toEqual({
      dispatchState: 'RESULT_RECEIVED', commandEffect: 'APPLIED',
      fiscalCommit: 'COMMITTED', printDelivery: 'UNKNOWN'
    });
    expect(handle.sqlite.prepare(`
      select dispatch_state as dispatchState, command_effect as commandEffect,
        fiscal_commit as fiscalCommit, print_delivery as printDelivery
      from fiscal_report_transitions where event_id = 'legacy-issued-report-event'
    `).get()).toEqual({
      dispatchState: 'RESULT_RECEIVED', commandEffect: 'APPLIED',
      fiscalCommit: 'COMMITTED', printDelivery: 'UNKNOWN'
    });
    expect(handle.sqlite.prepare(`
      select dispatch_state as dispatchState, command_effect as commandEffect,
        fiscal_commit as fiscalCommit, print_delivery as printDelivery
      from fiscal_report_transitions where event_id = 'legacy-report-event'
    `).get()).toEqual({
      dispatchState: 'RESULT_RECEIVED', commandEffect: 'REJECTED',
      fiscalCommit: 'UNKNOWN', printDelivery: 'UNKNOWN'
    });

    const legacyDocument = await new DrizzleFiscalDocumentRepository(handle)
      .findById('legacy-document');
    expect(() => legacyDocument?.beginRetry({
      actorId: 'user-001', occurredAt: new Date(6), eventId: 'blocked-document-retry'
    })).toThrowError(expect.objectContaining({ code: 'FISCAL_RETRY_RECONCILIATION_REQUIRED' }));
    const legacyDay = await new DrizzleFiscalDayRepository(handle).findById('legacy-day');
    expect(() => legacyDay?.retryReport({
      reportId: 'legacy-unknown-report', actorId: 'user-001',
      occurredAt: new Date(6), eventId: 'blocked-report-retry'
    })).toThrowError(expect.objectContaining({ code: 'FISCAL_REPORT_RECONCILIATION_REQUIRED' }));
    expect(() => handle.sqlite.prepare(
      "update fiscal_documents set last_error_code = null where id = 'legacy-issued-document'"
    ).run()).toThrowError('issued fiscal documents are immutable');
    expect(() => handle.sqlite.prepare(
      "update fiscal_reports set last_error_code = null where id = 'legacy-issued-report'"
    ).run()).toThrowError('issued fiscal reports are immutable');
    expect(() => handle.sqlite.prepare(`
      update fiscal_document_transitions set error_code = null
      where event_id = 'legacy-document-event'
    `).run()).toThrowError('fiscal document transitions are append-only');
    expect(() => handle.sqlite.prepare(`
      update fiscal_report_transitions set error_code = null
      where event_id = 'legacy-report-event'
    `).run()).toThrowError('fiscal report transitions are append-only');
  });
});
