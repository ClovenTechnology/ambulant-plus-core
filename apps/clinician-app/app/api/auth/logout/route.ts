import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IS_PROD = process.env.NODE_ENV === 'production';

const CONFIGURED_COOKIE =
  process.env.CLINICIAN_SESSION_COOKIE || 'ambulant_clinician_session';

const COOKIE_NAMES = Array.from(
  new Set([
    CONFIGURED_COOKIE,
    'clinician_session',
    'ambulant_clinician_session',
    '__Host-ambulant_clinician_session',
    'ambulant.clinician.token',
    'ambulant_session',
    '__Host-ambulant_session',
    'ambulant.session',
    'ambulant_identity',
    'ambulant_uid',
    'token',
    'access_token',
    'refresh_token',
    'session',
    'auth_session',
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
  ]),
);

function expireCookies(res: NextResponse) {
  for (const name of COOKIE_NAMES) {
    res.cookies.set(name, '', {
      path: '/',
      expires: new Date(0),
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax',
      secure: IS_PROD || name.startsWith('__Host-') || name.startsWith('__Secure-'),
    });
  }

  res.headers.set('cache-control', 'no-store, max-age=0');
  res.headers.set('pragma', 'no-cache');

  return res;
}

export async function POST() {
  return expireCookies(
    NextResponse.json({
      ok: true,
      redirectTo: '/auth/login?reason=signed_out',
    }),
  );
}

export async function GET(req: NextRequest) {
  const url = new URL('/auth/login', req.url);
  url.searchParams.set('reason', 'signed_out');

  return expireCookies(NextResponse.redirect(url));
}
