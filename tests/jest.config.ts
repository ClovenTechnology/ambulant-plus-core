import type { Config } from 'jest';
const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^@devices/(.*)$': '<rootDir>/shared/devices/$1',
  },
  setupFiles: ['<rootDir>/tests/setup.env.ts'],
  maxWorkers: 1,
};
export default config;
