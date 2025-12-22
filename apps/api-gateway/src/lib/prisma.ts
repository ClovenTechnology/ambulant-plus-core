// apps/api-gateway/src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// World-class default: avoid query logging in prod (noise + cost).
const log =
  process.env.NODE_ENV === 'development'
    ? (['query', 'error', 'warn'] as any)
    : (['error', 'warn'] as any);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log,
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
