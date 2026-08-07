/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  // The test files are excluded from tsconfig.json (they shouldn't ship in the
  // build output), so ts-jest needs the Jest/Node types loaded explicitly.
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { types: ['jest', 'node'], isolatedModules: true } }],
  },
};
