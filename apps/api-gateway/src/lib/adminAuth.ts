// apps/api-gateway/src/lib/adminAuth.ts
import { NextRequest } from 'next/server';

export function assertAdmin(req: NextRequest) {
  // Worldclass path: replace this with your real RBAC (session/JWT/roles)
  const key = process.env.ADMIN_API_KEY;

  // In development, allow if no key set
  if (!key && process.env.NODE_ENV !== 'production') return;

  const headerKey = req.headers.get('x-admin-key') || '';
  if (!key || headerKey !== key) {
    const err: any = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
}
