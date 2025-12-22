// apps/patient-app/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';

function expireCookie(res: NextResponse, name: string) {
  // Clear cookie on common scopes.
  // (If you later set cookies with a specific domain, you may need to also set domain=... here.)
  res.cookies.set({
    name,
    value: '',
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  });

  // Also clear a non-HttpOnly variant (in case you used it).
  res.cookies.set({
    name,
    value: '',
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  });
}

export async function POST() {
  const res = NextResponse.json({ ok: true });

  // Add every session/token cookie name you might set in patient-app.
  const cookiesToClear = [
    'ambulant_session',
    'ambulant_token',
    'ambulant.token',
    'token',
    'access_token',
    'refresh_token',
    'patient_session',
    'ambulant_identity',
    'ambulant_uid',

    // if ever used next-auth
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
  ];

  for (const c of cookiesToClear) expireCookie(res, c);

  // Prevent caching of logout response
  res.headers.set('cache-control', 'no-store, max-age=0');

  return res;
}

// Optional: allow GET logout for convenience (harmless)
export async function GET() {
  return POST();
}
