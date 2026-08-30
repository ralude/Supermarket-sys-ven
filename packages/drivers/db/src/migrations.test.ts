import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { InfrastructureError } from '@supermarket/shared';
import { openDatabase, type DatabaseHandle } from './connection.js';
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
      expect.objectContaining({ version: 8, name: 'inventory' })
    ]);

    const tables = handle.sqlite.prepare(
      "select name from sqlite_master where type = 'table' order by name"
    ).pluck().all();
    expect(tables).toEqual(expect.arrayContaining([
      'business_event',
      'audit_log',
      'cash_movements',
      'exchange_rates',
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
});
