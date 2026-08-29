import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { InfrastructureError } from '@supermarket/shared';
import { openDatabase, type DatabaseHandle } from './connection.js';

describe('SQLite connection', () => {
  const handles: DatabaseHandle[] = [];

  afterEach(() => {
    for (const handle of handles.splice(0)) {
      handle.close();
    }
  });

  it('opens an in-memory database with verified pragmas and Drizzle', () => {
    const handle = openDatabase(':memory:');
    handles.push(handle);

    expect(handle.sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(handle.sqlite.pragma('busy_timeout', { simple: true })).toBe(5000);
    expect(handle.sqlite.pragma('synchronous', { simple: true })).toBe(1);
    expect(handle.db.get(sql`select 1 as one`)).toEqual({ one: 1 });
  });

  it('opens a temporary file database with WAL enabled', () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'supermarket-db-'));
    const handle = openDatabase(join(temporaryDirectory, 'smoke.sqlite'));
    handles.push(handle);

    expect(handle.sqlite.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(handle.sqlite.pragma('foreign_keys', { simple: true })).toBe(1);

    handle.close();
    handles.splice(handles.indexOf(handle), 1);
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it('maps an invalid database path to an infrastructure error', () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'supermarket-db-'));
    rmSync(temporaryDirectory, { recursive: true, force: true });

    let caught: unknown;
    try {
      openDatabase(join(temporaryDirectory, 'missing', 'database.sqlite'));
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(InfrastructureError);
    expect((caught as InfrastructureError).code).toBe('DATABASE_OPEN_FAILED');
  });

  it('allows only one owner for a node database and releases ownership on close', () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'supermarket-db-'));
    const databasePath = join(temporaryDirectory, 'node.sqlite');
    const first = openDatabase(databasePath);
    handles.push(first);

    expect(() => openDatabase(databasePath)).toThrowError(
      expect.objectContaining({ code: 'DATABASE_NODE_LOCKED' })
    );

    first.close();
    handles.splice(handles.indexOf(first), 1);
    const reopened = openDatabase(databasePath);
    reopened.close();
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });
});
