// apps/api-gateway/app/api/fx/_shared.ts
import type { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { assertAdmin } from '@/lib/adminAuth';

export const ISO_CCY = /^[A-Z]{3}$/;

export function normCcy(v: any) {
  return String(v || '').trim().toUpperCase();
}

export function isCcy(v: any) {
  const c = normCcy(v);
  return ISO_CCY.test(c);
}

export function toNumberDecimal(d: any): number {
  try {
    if (d == null) return 0;
    if (typeof d === 'number') return d;
    if (typeof d === 'string') return Number(d);
    if (d instanceof Prisma.Decimal) return Number(d.toString());
    if (typeof d?.toString === 'function') return Number(String(d));
    return Number(d);
  } catch {
    return 0;
  }
}

// Current convention: admin key gate. (World-class baseline.)
// Later: layer RBAC roles/claims without breaking endpoint contracts.
export function assertAdminFinance(req: NextRequest) {
  assertAdmin(req);
}

export function csvQuotes(v: string | null): string[] {
  if (!v) return [];
  return v
    .split(',')
    .map((x) => normCcy(x))
    .filter((x) => ISO_CCY.test(x));
}

export function safeAsOf(d: any): Date {
  const dt = d ? new Date(d) : new Date();
  return isNaN(dt.getTime()) ? new Date() : dt;
}
