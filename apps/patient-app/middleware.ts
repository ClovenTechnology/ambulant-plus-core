// apps/patient-app/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE_NAMES = [
  'ambulant_session',
  '__Host-ambulant_session',
  'ambulant.session',
  'auth_session',
  'session',
  'token',
];

const PUBLIC_PREFIXES = [
  '/auth',
  '/privacy',
  '/terms',
  '/api',
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.json',
  '/brand',
  '/assets',
  '/images',
  '/icons',
];

function isPublicPath(pathname: string) {
  if (pathname.includes('.')) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function base64UrlDecode(value: string) {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return atob(padded);
  } catch {
    return '';
  }
}

function sessionLooksActive(token: string) {
  const raw = String(token || '').trim();
  if (!raw) return false;

  const parts = raw.split('.');
  if (parts.length !== 3) {
    // Allow opaque session values if a future auth provider switches format.
    return raw.length > 16;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(parts[1])) as { exp?: unknown };
    if (typeof payload.exp !== 'number') return true;
    return payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function readSession(req: NextRequest) {
  for (const name of SESSION_COOKIE_NAMES) {
    const value = req.cookies.get(name)?.value;
    if (value && sessionLooksActive(value)) return value;
  }

  return '';
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const session = readSession(req);
  if (session) {
    return NextResponse.next();
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/auth/login';
  loginUrl.search = '';
  loginUrl.searchParams.set('next', `${pathname}${search}` || '/');

  const res = NextResponse.redirect(loginUrl);
  res.headers.set('cache-control', 'no-store, max-age=0');
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
