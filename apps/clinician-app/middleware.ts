import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const CLINICIAN_SESSION_COOKIE =
  process.env.CLINICIAN_SESSION_COOKIE || 'ambulant_clinician_session';

const PUBLIC_PATHS = new Set([
  '/favicon.ico',
  '/favicon.svg',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.json',
  '/manifest.webmanifest',
  '/terms',
  '/privacy',
  '/flexible-payment-and-pay-later',
]);

const PUBLIC_PREFIXES = [
  '/auth',
  '/training',
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

function decodeBase64UrlJson(value: string): any | null {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '=',
    );

    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function readClinicianSession(req: NextRequest): Record<string, any> | null {
  const raw = req.cookies.get(CLINICIAN_SESSION_COOKIE)?.value?.trim();

  if (!raw) return null;

  const payload = raw.includes('.') ? raw.split('.')[1] : raw;
  const parsed = decodeBase64UrlJson(payload || '');

  if (!parsed || typeof parsed !== 'object') return null;

  const expiresAt =
    typeof parsed.expiresAt === 'number'
      ? parsed.expiresAt
      : typeof parsed.exp === 'number'
        ? parsed.exp * 1000
        : null;

  if (expiresAt && expiresAt < Date.now()) return null;

  if (!parsed.sub && !parsed.clinicianId && !parsed.email) return null;

  return parsed;
}

function canUseFullWorkspace(session: Record<string, any>) {
  if (session.role === 'admin' || session.role === 'admin_staff') return true;
  if (session.canPractice === true) return true;
  if (session.trainingCompleted === true) return true;
  if (session.simulationMode === true) return true;
  if (String(session.onboardingStage || '').toLowerCase() === 'training_completed') return true;
  if (String(session.status || '').toLowerCase() === 'active') return true;

  return false;
}

function corsResponse(req: NextRequest) {
  const allowOrigin = process.env.CORS_ALLOW_ORIGIN ?? '*';
  const res = NextResponse.next();

  res.headers.set('Access-Control-Allow-Origin', allowOrigin);
  res.headers.set(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  );
  res.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, X-UID, X-Role, X-User-Id, X-User-Email, X-Clinician-Id, X-Clinician-Email',
  );

  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: res.headers });
  }

  return res;
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith('/api/')) {
    return corsResponse(req);
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const session = readClinicianSession(req);

  if (!session) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/auth/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('next', `${pathname}${search}` || '/');

    const res = NextResponse.redirect(loginUrl);
    res.headers.set('cache-control', 'no-store, max-age=0');

    return res;
  }

  if (!canUseFullWorkspace(session)) {
    const trainingUrl = req.nextUrl.clone();
    trainingUrl.pathname = '/training/schedule';
    trainingUrl.search = '';
    if (session.clinicianId) {
      trainingUrl.searchParams.set('clinicianId', String(session.clinicianId));
    }
    trainingUrl.searchParams.set('reason', 'training_required');
    trainingUrl.searchParams.set('next', `${pathname}${search}` || '/');

    const res = NextResponse.redirect(trainingUrl);
    res.headers.set('cache-control', 'no-store, max-age=0');

    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|favicon.svg).*)'],
};
