// apps/clinician-app/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CLINICIAN_SESSION_COOKIE =
  process.env.CLINICIAN_SESSION_COOKIE || 'ambulant_clinician_session';

function clearSession() {
  const res = NextResponse.json(
    { ok: true },
    { headers: { 'cache-control': 'no-store, max-age=0' } },
  );

  res.cookies.set(CLINICIAN_SESSION_COOKIE, '', {
    path: '/',
    expires: new Date(0),
    maxAge: 0,
  });

  return res;
}

export async function POST() {
  return clearSession();
}

export async function GET() {
  return clearSession();
}
