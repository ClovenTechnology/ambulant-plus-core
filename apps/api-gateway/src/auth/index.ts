// apps/api-gateway/src/auth/index.ts
import type { NextRequest } from 'next/server';
import { verifyAdminRequest } from '@/src/lib/admin-auth';
import {
  readIdentity,
  requireTrustedIdentityInProduction,
} from '@/src/lib/identity';

/** Shared auth helpers retained for older routes. */

export async function requireAdmin(req: NextRequest) {
  const ok = await verifyAdminRequest(req);

  if (!ok) {
    const err = new Error('Unauthorized');
    // @ts-ignore legacy route compatibility
    err.status = 401;
    throw err;
  }

  return true;
}

export function getUid(req: NextRequest) {
  const who = readIdentity(req.headers);
  requireTrustedIdentityInProduction(req.headers, who);

  if (who.uid) return who.uid;

  if (process.env.NODE_ENV !== 'production') return 'anon';

  const err = new Error('Unauthorized');
  // @ts-ignore legacy route compatibility
  err.status = 401;
  throw err;
}