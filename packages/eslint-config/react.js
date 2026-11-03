// @ts-check
/**
 * ESLint flat config for React + TypeScript apps (apps/admin).
 *
 * Enforces the SARKO folder-structure skill:
 *   1. NO relative imports — always the `@/` alias.
 *   2. NO deep feature imports — features expose a single public barrel `index.ts`,
 *      consumers import `@/features/orders`, never `@/features/orders/OrderView`.
 */
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

import { baseConfig } from './index.js';

const RELATIVE_IMPORT_MESSAGE =
  'Gunakan alias @/ — relative import dilarang (skill struktur folder). ' +
  'Contoh: import { x } from "@/features/auth/LoginView".';

const DEEP_FEATURE_IMPORT_MESSAGE =
  'Import fitur hanya lewat barrel: @/features/<nama>. ' +
  'Tambahkan re-export di @/features/<nama>/index.ts, jangan menembus folder internal.';

/**
 * The two import policies every admin source file must obey.
 * Kept in one `no-restricted-imports` config so a single violation reports once.
 */
export const ADMIN_IMPORT_RULES = {
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: ['./*', '../*'],
          message: RELATIVE_IMPORT_MESSAGE,
          allowTypeImports: false,
        },
        {
          group: ['@/features/*/*', '@/features/*/*/*', '@/features/*/*/*/*'],
          message: DEEP_FEATURE_IMPORT_MESSAGE,
          allowTypeImports: false,
        },
      ],
    },
  ],
};

export default tseslint.config(
  ...baseConfig,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2022 },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['error', 'warn'] }],
    },
  },
  {
    // The folder-structure contract. Applies to every TS/TSX file in the app;
    // build tooling configs at the app root are exempt (they run in Node, not the bundle).
    files: ['**/*.{ts,tsx}'],
    ignores: ['**/*.config.{ts,tsx,mts,cts}', '**/*.d.ts', '**/vitest.setup.{ts,tsx}'],
    rules: ADMIN_IMPORT_RULES,
  },
);
