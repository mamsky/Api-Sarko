// @ts-check
/**
 * ESLint flat config for Node / NestJS packages (apps/api, apps/worker, shared libs).
 */
import tseslint from 'typescript-eslint';
import globals from 'globals';

import { baseConfig } from './index.js';

export default tseslint.config(
  ...baseConfig,
  {
    files: ['**/*.{ts,tsx,mts,cts,js,mjs,cjs}'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // Backend logging goes through the NestJS Logger — raw console.log is a smell.
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports', disallowTypeAnnotations: false },
      ],
      // NestJS DI relies on runtime metadata; empty constructors are legitimate.
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
);
