// ============================================================================
// 6) PATH: apps/patient-app/jest.config.ts  (NEW)
// ============================================================================
import type { Config } from 'jest';
const config: Config = {
  testEnvironment: 'jsdom',
  transform: { '^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: './tsconfig.json' }] },
  moduleFileExtensions: ['ts','tsx','js','jsx'],
  roots: ['<rootDir>/src'],
};
export default config;
