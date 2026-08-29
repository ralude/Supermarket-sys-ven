import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { InfrastructureError } from '@supermarket/shared';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

export type DatabaseHandle = {
  readonly sqlite: Database.Database;
  readonly db: BetterSQLite3Database<typeof schema>;
  readonly close: () => void;
};

const configurePragmas = (sqlite: Database.Database, path: string): void => {
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('synchronous = NORMAL');

  if (path !== ':memory:') {
    assertPragma(sqlite, 'journal_mode', 'wal');
  }

  assertPragma(sqlite, 'foreign_keys', 1);
  assertPragma(sqlite, 'busy_timeout', 5000);
  assertPragma(sqlite, 'synchronous', 1);
};

const assertPragma = (sqlite: Database.Database, name: string, expected: string | number): void => {
  const actual = sqlite.pragma(name, { simple: true });
  const normalizedActual = typeof actual === 'string' ? actual.toLowerCase() : actual;
  const normalizedExpected = typeof expected === 'string' ? expected.toLowerCase() : expected;

  if (normalizedActual !== normalizedExpected) {
    throw new InfrastructureError(
      'DATABASE_PRAGMA_MISMATCH',
      'SQLite pragma verification failed.',
      { details: { pragma: name, expected, actual } }
    );
  }
};

type LockOwner = { pid: number; token: string };

const isRunning = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
};

const acquireNodeLock = (path: string): (() => void) => {
  if (path === ':memory:') return () => undefined;
  const lockPath = `${resolve(path)}.owner`;
  const owner: LockOwner = { pid: process.pid, token: randomUUID() };
  const writeOwner = (): void => writeFileSync(lockPath, JSON.stringify(owner), { flag: 'wx' });

  try {
    writeOwner();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    try {
      const existing = JSON.parse(readFileSync(lockPath, 'utf8')) as LockOwner;
      if (Number.isInteger(existing.pid) && isRunning(existing.pid)) {
        throw new InfrastructureError('DATABASE_NODE_LOCKED', 'Database already has an active node owner.');
      }
      unlinkSync(lockPath);
      writeOwner();
    } catch (lockError) {
      if (lockError instanceof InfrastructureError) throw lockError;
      throw new InfrastructureError(
        'DATABASE_NODE_LOCKED',
        'Database node ownership could not be acquired.',
        { cause: lockError }
      );
    }
  }

  return () => {
    try {
      const current = JSON.parse(readFileSync(lockPath, 'utf8')) as LockOwner;
      if (current.token === owner.token) unlinkSync(lockPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  };
};

export const openDatabase = (path: string): DatabaseHandle => {
  let sqlite: Database.Database;
  let releaseNodeLock = (): void => undefined;

  try {
    sqlite = new Database(path);
  } catch (error) {
    throw new InfrastructureError(
      'DATABASE_OPEN_FAILED',
      'SQLite database could not be opened.',
      { cause: error }
    );
  }

  try {
    releaseNodeLock = acquireNodeLock(path);
    configurePragmas(sqlite, path);
    const db = drizzle(sqlite, { schema });
    let closed = false;

    return {
      sqlite,
      db,
      close: () => {
        if (!closed) {
          try {
            sqlite.close();
          } finally {
            releaseNodeLock();
            closed = true;
          }
        }
      }
    };
  } catch (error) {
    sqlite.close();
    releaseNodeLock();

    if (error instanceof InfrastructureError) {
      throw error;
    }

    throw new InfrastructureError(
      'DATABASE_PRAGMA_MISMATCH',
      'SQLite configuration could not be verified.',
      { cause: error }
    );
  }
};
