// apps/patient-app/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = 'ambulant_session';

const PUBLIC_PATHS = new Set([
  '/favicon.ico',
  '/favicon.svg',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.json',
  '/manifest.webmanifest',
]);

const PUBLIC_PREFIXES = [
  '/auth',
  '/privacy',
  '/terms',
  '/api/auth',
  '/_next',
  '/brand',
  '/assets',
  '/images',
  '/icons',
];

function isStaticAsset(pathname: string) {
  return /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|json|webmanifest|woff|woff2|ttf|otf)$/i.test(
    pathname,
  );
}

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (isStaticAsset(pathname)) return true;

  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
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

  // Patient app login issues a signed JWT. Do not accept opaque fallback cookies.
  if (parts.length !== 3) return false;

  try {
    const payload = JSON.parse(base64UrlDecode(parts[1])) as {
      exp?: unknown;
      sub?: unknown;
      uid?: unknown;
      actorType?: unknown;
    };

    if (!payload.sub && !payload.uid) return false;

    if (typeof payload.actorType === 'string' && payload.actorType !== 'PATIENT') {
      return false;
    }

    if (typeof payload.exp !== 'number') return false;

    return payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function hasActivePatientSession(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  return Boolean(token && sessionLooksActive(token));
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (hasActivePatientSession(req)) {
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|favicon.svg).*)'],
};