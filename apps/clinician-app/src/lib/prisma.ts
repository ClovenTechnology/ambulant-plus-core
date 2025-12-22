// apps/clinician-app/src/lib/prisma.ts
/**
 * Minimal safe prisma client shim for the patient-app.
 * NOTE: In this monorepo the canonical Prisma client + migrations live under `apps/api-gateway`.
 * Prefer calling the API gateway from patient-app server routes instead of importing Prisma directly.
 */

import { PrismaClient } from '@prisma/client';

declare global {
  // use a global to avoid re-creating client during HMR in dev
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  var __prismaClient__: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__prismaClient__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prismaClient__ = prisma;
}
