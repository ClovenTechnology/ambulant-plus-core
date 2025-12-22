// apps/patient-app/src/lib/prisma.ts
/**
 * Minimal safe prisma client shim for the patient-app.
 * In this monorepo the canonical Prisma client + migrations live elsewhere.
 * During web dev we tolerate Prisma not being generated.
 */

let _prisma: any | null = null;

export function getPrisma() {
  if (_prisma) return _prisma;
  try {
    // Lazy require keeps Next dev server from crashing if @prisma/client isn't generated
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PrismaClient } = require('@prisma/client');
    // Reuse a global in dev to avoid creating extra connections on HMR
    // eslint-disable-next-line no-var
    var globalAny = global as any;
    _prisma =
      globalAny.__patientPrisma__ ??
      new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
      });
    if (process.env.NODE_ENV !== 'production') globalAny.__patientPrisma__ = _prisma;
  } catch (e) {
    // Not available — return null and let callers short-circuit or stub
    if (process.env.NODE_ENV === 'development') {
      console.warn('Prisma client not available (ok in dev without DB).');
    }
    _prisma = null;
  }
  return _prisma;
}

// Export a stable handle so `import { prisma }` works
export const prisma = getPrisma();
export default prisma;
