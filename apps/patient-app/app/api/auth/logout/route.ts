// apps/patient-app/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';

function expireCookie(res: NextResponse, name: string, httpOnly: boolean) {
  res.cookies.set({
    name,
    value: '',
    path: '/',
    httpOnly,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  });
}

export async function POST() {
  const res = NextResponse.json(
    { ok: true },
    { headers: { 'cache-control': 'no-store, max-age=0' } },
  );

  const cookiesToClear = [
    'ambulant_session',
    '__Host-ambulant_session',
    'ambulant.session',
    'auth_session',
    'session',
    'token',
    'ambulant_token',
    'ambulant.token',
    'access_token',
    'refresh_token',
    'patient_session',
    'ambulant_identity',
    'ambulant_uid',
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
  ];

  for (const name of cookiesToClear) {
    expireCookie(res, name, true);
    expireCookie(res, name, false);
  }

  return res;
}

export async function GET() {
  return POST();
}
