
/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */

export default {
    clearMocks: true,
    collectCoverage: true,
    coverageDirectory: 'coverage',
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['src/**/*.spec.ts'], // This line tells Jest to only consider files with .spec.ts
  };