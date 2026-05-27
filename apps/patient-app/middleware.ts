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
  '/api',
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

  if (parts.length !== 3) {
    // Keep this tolerant so future opaque session-cookie providers do not
    // accidentally lock authenticated users out.
    return raw.length > 16;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(parts[1])) as { exp?: unknown };

    if (typeof payload.exp !== 'number') {
      return true;
    }

    return payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function readSession(req: NextRequest) {
  for (const name of SESSION_COOKIE_NAMES) {
    const value = req.cookies.get(name)?.value;
    if (value && sessionLooksActive(value)) {
      return value;
    }
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|favicon.svg).*)'],
};