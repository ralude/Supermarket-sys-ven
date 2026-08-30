import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/shared/vitest.config.ts',
      'packages/core/vitest.config.ts',
      'apps/desktop/vitest.config.ts',
      'apps/server/vitest.config.ts',
      'packages/drivers/db/vitest.config.ts',
      'packages/drivers/fiscal/vitest.config.ts'
    ]
  }
});
