// apps/admin-dashboard/lib/prisma.ts

// Reuse the canonical Prisma singleton from api-gateway so the whole
// monorepo shares one client per process.
export { prisma } from '../../api-gateway/lib/prisma';
