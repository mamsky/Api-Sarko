// @ts-check
/**
 * Base ESLint flat config shared by every SARKO package.
 *
 * Consumers:
 *   - Node / NestJS backend  -> `@sarko/eslint-config/node`
 *   - React + Vite admin     -> `@sarko/eslint-config/react`
 *   - library (no globals)   -> `@sarko/eslint-config`
 */
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

/** Paths that are never linted. */
export const IGNORES = [
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/coverage/**',
  '**/node_modules/**',
  '**/generated/**',
  '**/*.d.ts',
];

/** Rules applied to every TypeScript file in the monorepo. */
export const SHARED_TS_RULES = {
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/consistent-type-imports': [
    'error',
    { prefer: 'type-imports', fixStyle: 'separate-type-imports', disallowTypeAnnotations: false },
  ],
  '@typescript-eslint/no-unused-vars': [
    'warn',
    { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
  ],
  'import/no-duplicates': 'error',
  'import/no-self-import': 'error',
  'import/order': [
    'warn',
    {
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
      'newlines-between': 'always',
      alphabetize: { order: 'asc', caseInsensitive: true },
    },
  ],
};

export const baseConfig = tseslint.config(
  { ignores: IGNORES },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    plugins: { import: importPlugin },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.es2022 },
    },
    rules: SHARED_TS_RULES,
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.es2022, ...globals.node },
    },
    rules: {
      'no-console': ['warn', { allow: ['error', 'warn'] }],
    },
  },
);

export default baseConfig;
