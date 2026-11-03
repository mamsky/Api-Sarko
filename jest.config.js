/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Only the four modules that the plan (§7.1) requires >= 80% coverage on.
  // Collecting from the whole tree would make the threshold unreachable while
  // the remaining modules are still scaffolded.
  collectCoverageFrom: [
    'src/modules/ordering/**/*.ts',
    'src/modules/payment/**/*.ts',
    'src/modules/inventory/**/*.ts',
    'src/modules/sync/**/*.ts',
    '!src/**/*.module.ts',
    '!src/**/index.ts',
    '!src/**/*.dto.ts',
    '!src/**/dto/**',
    '!src/**/repositories/**',
    '!src/**/events/**',
    '!src/**/*.spec.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80,
    },
  },
  clearMocks: true,
  testTimeout: 20000,
};
