import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import { configs as hooksConfigs } from 'eslint-plugin-react-hooks';

const publicPackageImportGuard = {
  group: ['@supermarket/*/src/**'],
  message: 'Consume otros paquetes mediante sus exports publicos, no mediante archivos internos.'
};

const infrastructureLibraries = [
  'electron',
  'electron/**',
  'fastify',
  'fastify/**',
  'react',
  'react/**',
  'react-dom',
  'react-dom/**',
  'drizzle-orm',
  'drizzle-orm/**',
  'better-sqlite3'
];

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
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [publicPackageImportGuard] }]
    }
  },
  {
    files: ['**/*.config.{js,ts}', 'apps/server/**/*.ts', 'packages/**/*.ts'],
    languageOptions: {
      globals: globals.node
    }
  },
  {
    files: ['packages/shared/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            publicPackageImportGuard,
            {
              group: [
                '@supermarket/core',
                '@supermarket/core/**',
                '@supermarket/driver-*',
                '@supermarket/driver-*/**',
                ...infrastructureLibraries
              ],
              message: 'shared no puede depender de core, drivers ni infraestructura.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['packages/core/src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            publicPackageImportGuard,
            {
              group: [
                '**/application/**',
                '@supermarket/driver-*',
                '@supermarket/driver-*/**',
                ...infrastructureLibraries
              ],
              message: 'core/domain solo puede depender del dominio y de primitivas shared.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['packages/core/src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            publicPackageImportGuard,
            {
              group: ['@supermarket/driver-*', '@supermarket/driver-*/**', ...infrastructureLibraries],
              message: 'core/application define puertos y no importa adaptadores ni transportes.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['apps/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            publicPackageImportGuard,
            {
              group: ['drizzle-orm', 'drizzle-orm/**', 'better-sqlite3'],
              message: 'apps compone dependencias y no accede a SQLite o Drizzle directamente.'
            }
          ]
        }
      ]
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
      'react-hooks/exhaustive-deps': 'warn',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            publicPackageImportGuard,
            {
              group: [
                'node:*',
                'electron',
                'electron/**',
                '@supermarket/core',
                '@supermarket/core/**',
                'drizzle-orm',
                'drizzle-orm/**',
                'better-sqlite3',
                '@supermarket/driver-*',
                '@supermarket/driver-*/**'
              ],
              message: 'El renderer no puede importar core, Node.js, Electron, base de datos ni drivers.'
            }
          ]
        }
      ]
    },
    languageOptions: {
      globals: globals.browser
    }
  }
);
