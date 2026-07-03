import { NextResponse, type NextRequest } from 'next/server';
import { adminBaseUrl, gatewayBase } from './src/lib/env';

type GatewayMe = {
  authenticated?: boolean;
  user?: {
    id?: string | null;
    email?: string | null;
    roles?: string[];
    scopes?: string[];
  } | null;
};

const ALLOWED_SCOPE_OR_ROLE = new Set([
  'manageroles',
  'tech',
  'compliance',
  'reports',
  'rnd',
  'admin',
  'superadmin',
  'super_admin',
  'owner'
]);

function isPublicPath(pathname: string) {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/robots') ||
    pathname.startsWith('/sitemap') ||
    pathname === '/api/health'
  );
}

function hasInsightCoreAccess(me: GatewayMe | null) {
  if (!me?.authenticated || !me.user) return false;

  const values = [
    ...(Array.isArray(me.user.scopes) ? me.user.scopes : []),
    ...(Array.isArray(me.user.roles) ? me.user.roles : [])
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);

  return values.some((value) => ALLOWED_SCOPE_OR_ROLE.has(value));
}

async function fetchMe(req: NextRequest): Promise<GatewayMe | null> {
  const response = await fetch(`${gatewayBase()}/api/auth/me`, {
    method: 'GET',
    headers: {
      cookie: req.headers.get('cookie') || '',
      'x-admin-origin': req.nextUrl.origin,
      'x-insightcore-origin': req.nextUrl.origin
    },
    cache: 'no-store'
  });

  if (!response.ok) return null;

  const text = await response.text();
  return text ? (JSON.parse(text) as GatewayMe) : null;
}

function redirectToAdminSignin(req: NextRequest) {
  const url = new URL('/auth/signin', adminBaseUrl());
  url.searchParams.set('next', req.nextUrl.href);
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  let me: GatewayMe | null = null;

  try {
    me = await fetchMe(req);
  } catch (error: any) {
    if (String(error?.message || '') === 'gateway_base_not_configured') {
      return new NextResponse('gateway_base_not_configured', { status: 503 });
    }

    me = null;
  }

  if (!hasInsightCoreAccess(me)) {
    return redirectToAdminSignin(req);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map)).*)']
};