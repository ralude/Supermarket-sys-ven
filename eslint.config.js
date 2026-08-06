import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import { configs as hooksConfigs } from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/coverage/**',
      'pnpm-lock.yaml'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.config.{js,ts}', 'apps/server/**/*.ts', 'packages/**/*.ts'],
    languageOptions: {
      globals: globals.node
    }
  },
  {
    files: ['apps/desktop/src/main/**/*.ts', 'apps/desktop/src/preload/**/*.ts'],
    languageOptions: {
      globals: globals.node
    }
  },
  {
    files: ['apps/desktop/src/renderer/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks
    },
    rules: {
      ...hooksConfigs.recommended.rules,
      'react-hooks/exhaustive-deps': 'warn'
    },
    languageOptions: {
      globals: globals.browser
    }
  }
);
