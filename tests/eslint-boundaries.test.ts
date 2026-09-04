import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

describe('renderer import boundary', () => {
  it.each([
    '@supermarket/core',
    '@supermarket/driver-db',
    'node:fs',
    'electron',
    'drizzle-orm',
    'better-sqlite3'
  ])('rejects %s', async (dependency) => {
    const [result] = await new ESLint().lintText(`import '${dependency}';`, {
      filePath: 'apps/desktop/src/renderer/src/forbidden-probe.ts'
    });
    expect(result?.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'no-restricted-imports', severity: 2 })
    ]));
  });
});

