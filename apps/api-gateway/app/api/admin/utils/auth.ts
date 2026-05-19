import { NextRequest, NextResponse } from 'next/server';
import { readIdentity } from '@/src/lib/identity';

export type AdminAuthResult =
  | { ok: true; uid: string; role: string }
  | { ok: false; response: NextResponse };

export async function verifyAdminRequest(req: NextRequest): Promise<AdminAuthResult> {
  const who = readIdentity(req.headers);

  if (!who.uid || who.role !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 }),
    };
  }

  return { ok: true, uid: who.uid, role: who.role };
}