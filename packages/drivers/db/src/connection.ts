import Database from 'better-sqlite3';
import { InfrastructureError } from '@supermarket/shared';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

export type DatabaseHandle = {
  readonly sqlite: Database.Database;
  readonly db: BetterSQLite3Database;
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

export const openDatabase = (path: string): DatabaseHandle => {
  let sqlite: Database.Database;

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
    configurePragmas(sqlite, path);
    const db = drizzle(sqlite);
    let closed = false;

    return {
      sqlite,
      db,
      close: () => {
        if (!closed) {
          sqlite.close();
          closed = true;
        }
      }
    };
  } catch (error) {
    sqlite.close();

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
