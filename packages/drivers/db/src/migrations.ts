import { createHash, randomUUID } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import type Database from 'better-sqlite3';
import { InfrastructureError } from '@supermarket/shared';
import { openDatabase, type DatabaseHandle } from './connection.js';
import { initialBusinessSchemaSql } from './migrations/0001-initial-business-schema.js';

export type Migration = {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
};

export const migrations: readonly Migration[] = [{
  version: 1,
  name: 'initial_business_schema',
  sql: initialBusinessSchemaSql
}];

const checksum = (migration: Migration): string => createHash('sha256')
  .update(`${migration.version}:${migration.name}:${migration.sql}`)
  .digest('hex');

const createMigrationTable = (sqlite: Database.Database): void => {
  sqlite.exec(`
    create table if not exists schema_migrations (
      version integer primary key,
      name text not null,
      checksum text not null,
      applied_at integer not null
    );
  `);
};

export const applyMigrations = (
  sqlite: Database.Database,
  migrationList: readonly Migration[] = migrations
): number[] => {
  createMigrationTable(sqlite);
  const ordered = [...migrationList].sort((left, right) => left.version - right.version);
  if (ordered.some((migration, index) =>
    migration.version <= 0 || (index > 0 && ordered[index - 1]?.version === migration.version))) {
    throw new InfrastructureError(
      'DATABASE_MIGRATION_INVALID',
      'Migration versions must be unique positive integers.'
    );
  }

  const existing = new Map<number, { name: string; checksum: string }>(
    (sqlite.prepare('select version, name, checksum from schema_migrations').all() as Array<{
      version: number;
      name: string;
      checksum: string;
    }>).map((row) => [row.version, row])
  );
  const applied: number[] = [];

  for (const migration of ordered) {
    const recorded = existing.get(migration.version);
    const expectedChecksum = checksum(migration);
    if (recorded) {
      if (recorded.name !== migration.name || recorded.checksum !== expectedChecksum) {
        throw new InfrastructureError(
          'DATABASE_MIGRATION_MISMATCH',
          'An applied migration no longer matches its recorded checksum.',
          { details: { version: migration.version } }
        );
      }
      continue;
    }

    try {
      sqlite.exec('begin immediate');
      sqlite.exec(migration.sql);
      sqlite.prepare(
        'insert into schema_migrations (version, name, checksum, applied_at) values (?, ?, ?, ?)'
      ).run(migration.version, migration.name, expectedChecksum, Date.now());
      sqlite.exec('commit');
      applied.push(migration.version);
    } catch (error) {
      if (sqlite.inTransaction) sqlite.exec('rollback');
      throw new InfrastructureError(
        'DATABASE_MIGRATION_FAILED',
        'A database migration could not be applied.',
        { cause: error, details: { version: migration.version, name: migration.name } }
      );
    }
  }

  return applied;
};

const validateDatabase = (sqlite: Database.Database): void => {
  const integrity = sqlite.pragma('integrity_check', { simple: true });
  const foreignKeyFailures = sqlite.pragma('foreign_key_check') as unknown[];
  if (integrity !== 'ok' || foreignKeyFailures.length > 0) {
    throw new Error('SQLite integrity validation failed.');
  }
};

const removeSidecars = (databasePath: string): void => {
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = `${databasePath}${suffix}`;
    if (existsSync(sidecar)) unlinkSync(sidecar);
  }
};

const createBackup = (
  sqlite: Database.Database,
  databasePath: string,
  backupDirectory: string,
  retention: number
): string => {
  mkdirSync(backupDirectory, { recursive: true });
  const prefix = `${basename(databasePath)}.backup.`;
  const backupPath = join(backupDirectory, `${prefix}${Date.now()}-${randomUUID()}.sqlite`);
  sqlite.prepare('vacuum into ?').run(backupPath);

  const backup = openDatabase(backupPath);
  try {
    validateDatabase(backup.sqlite);
  } finally {
    backup.close();
  }

  const backups = readdirSync(backupDirectory)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.sqlite'))
    .map((name) => join(backupDirectory, name))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
  for (const expired of backups.slice(Math.max(1, retention))) unlinkSync(expired);
  return backupPath;
};

export type MigrationOptions = {
  readonly backupDirectory: string;
  readonly backupRetention?: number;
  readonly migrations?: readonly Migration[];
  readonly validate?: (handle: DatabaseHandle) => void;
};

export type MigrationResult = {
  readonly appliedVersions: readonly number[];
  readonly backupPath?: string;
};

export const migrateDatabase = (
  databasePath: string,
  options: MigrationOptions
): MigrationResult => {
  const resolvedPath = resolve(databasePath);
  const existed = existsSync(resolvedPath) && statSync(resolvedPath).size > 0;
  const handle = openDatabase(resolvedPath);
  let backupPath: string | undefined;

  try {
    if (existed) {
      backupPath = createBackup(
        handle.sqlite,
        resolvedPath,
        resolve(options.backupDirectory),
        options.backupRetention ?? 5
      );
    }
    const appliedVersions = applyMigrations(handle.sqlite, options.migrations ?? migrations);
    validateDatabase(handle.sqlite);
    options.validate?.(handle);
    return backupPath ? { appliedVersions, backupPath } : { appliedVersions };
  } catch (error) {
    handle.close();
    if (backupPath) {
      removeSidecars(resolvedPath);
      copyFileSync(backupPath, resolvedPath);
    }
    if (error instanceof InfrastructureError && error.code !== 'DATABASE_MIGRATION_VALIDATION_FAILED') {
      throw error;
    }
    throw new InfrastructureError(
      'DATABASE_MIGRATION_VALIDATION_FAILED',
      'Database validation failed and the previous backup was restored.',
      { cause: error }
    );
  } finally {
    if (handle.sqlite.open) handle.close();
  }
};
