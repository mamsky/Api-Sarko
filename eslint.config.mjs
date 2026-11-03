// @ts-check
import nodeConfig from '@sarko/eslint-config/node';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'src/database/migrations/**'],
  },
  ...nodeConfig,
  {
    // NestJS memakai decorator metadata untuk DI: kelas yang di-inject pada
    // constructor HARUS tetap jadi import nilai. `import type` menghapus
    // metadata itu dan container gagal resolve dependency saat runtime.
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-var-requires': 'off',
    },
  },
];
