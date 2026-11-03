// @ts-check
/**
 * `@sarko/eslint-config/node` is an ESLint **flat** config (eslint >= 9), so the
 * legacy `.eslintrc.cjs` + `extends` form cannot consume it. This file is the
 * flat-config equivalent of `.eslintrc.cjs { extends: ['@sarko/eslint-config/node'] }`.
 */
import nodeConfig from '@sarko/eslint-config/node';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'src/database/migrations/**'],
  },
  ...nodeConfig,
];
