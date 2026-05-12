// apps/api-gateway/src/auth/index.ts
import type { NextRequest } from 'next/server';
import { verifyAdminRequest } from '../../app/api/utils/auth';

/**
 * Minimal auth helpers expected by gateway routes.
 * This file deliberately imports the existing app/api/utils/auth helper
 * through a relative path so it works in Vercel/Next build without relying
 * on the "@/app/..." alias.
 */

export async function requireAdmin(req: NextRequest) {
  const result = await verifyAdminRequest(req);

  if (result === false || (typeof result === 'object' && result && (result as any).ok === false)) {
    const err: any = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  return true;
}

export function getUid(req: NextRequest) {
  return (
    req.headers.get('x-uid') ||
    req.headers.get('x-user-id') ||
    req.headers.get('x-ambulant-user-id') ||
    req.headers.get('x-user') ||
    'anon'
  );
}