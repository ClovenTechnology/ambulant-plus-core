import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { readIdentity } from '@/src/lib/identity';

export type AdminAuthResult =
  | { ok: true; uid: string; role: string; source?: string }
  | { ok: false; response: NextResponse };

function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);

  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function hasTrustedAdminKey(req: NextRequest) {
  const expected = String(process.env.ADMIN_API_KEY || '').trim();
  if (!expected) return false;

  const got =
    req.headers.get('x-admin-key') ||
    req.headers.get('X-Admin-Key') ||
    '';

  const actual = String(got || '').trim();
  if (!actual) return false;

  return safeEqual(actual, expected);
}

export async function verifyAdminRequest(req: NextRequest): Promise<AdminAuthResult> {
  /*
   * Human Admin sessions take priority.
   *
   * The dashboard session represents the real operator.
   * Do not replace this identity with the machine key identity.
   */
  const who = readIdentity(req.headers);

  if (
    who.trusted === true &&
    who.uid &&
    (
      who.role === 'admin' ||
      who.role === 'admin_staff'
    )
  ) {
    return {
      ok: true,
      uid: who.uid,
      role: who.role,
      source: 'identity',
    };
  }

  /*
   * Machine authentication remains available only
   * for trusted service-to-service callers.
   */
  if (hasTrustedAdminKey(req)) {
    return {
      ok: true,
      uid: 'admin-api-key',
      role: 'admin',
      source: 'admin-api-key',
    };
  }

  return {
    ok: false,
    response: NextResponse.json(
      {
        ok: false,
        error: 'unauthorized',
      },
      {
        status: 401,
      },
    ),
  };
}
