import type { Config } from 'jest';
const config: Config = {
  testEnvironment: 'node',
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  testMatch: ['**/src/__tests__/**/*.spec.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
};
export default config;
