import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'architecture-boundaries',
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});

