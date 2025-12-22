// apps/admin-dashboard/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { resolveEffectiveScopes, type SessionUser } from './src/lib/acl';

// --- Route protections (prefix -> required scopes) ---
const RULES: Array<{ prefix: string; required: string[] }> = [
  { prefix: '/settings/roles',  required: ['manageRoles'] },
  { prefix: '/settings/people', required: ['hr'] },       // departments, designations, role-requests
  { prefix: '/finance',         required: ['finance'] },
  { prefix: '/tech',            required: ['tech'] },
  { prefix: '/compliance',      required: ['compliance'] },
  { prefix: '/reports',         required: ['reports'] },
  { prefix: '/rnd',             required: ['rnd'] },
];

// Public paths (no auth required)
const isPublicPath = (pathname: string) =>
  pathname.startsWith('/_next') ||
  pathname.startsWith('/favicon') ||
  pathname.startsWith('/auth/signin') ||
  pathname.startsWith('/auth/signup') ||
  pathname.startsWith('/signout');

const APIGW =
  process.env.NEXT_PUBLIC_APIGW_BASE ||
  process.env.APIGW_BASE ||
  'http://localhost:3010';

type MeResponse = {
  authenticated: boolean;
  user?: {
    id: string | null;
    email: string | null;
    name?: string | null;
    departmentId?: string | null;
    designationId?: string | null;
    roles?: string[];   // direct + designation-derived (as implemented by gateway)
    scopes?: string[];  // effective scopes (preferred)
  };
};

// Ask the Gateway who this user is. Forward the Cookie header.
async function fetchMe(req: NextRequest): Promise<MeResponse | null> {
  try {
    const res = await fetch(`${APIGW}/api/auth/me`, {
      method: 'GET',
      headers: {
        cookie: req.headers.get('cookie') || '',
        'x-admin-origin': req.nextUrl.origin,
      },
      cache: 'no-store',
    });
    // Gateway returns 200 with authenticated:false if no session
    if (!res.ok) return null;
    const text = await res.text();
    return text ? (JSON.parse(text) as MeResponse) : null;
  } catch {
    return null;
  }
}

// Legacy local cookie fallback: adm.profile contains JSON SessionUser
function getSessionUserFromCookie(req: NextRequest): SessionUser | null {
  const raw = req.cookies.get('adm.profile')?.value;
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as SessionUser;
  } catch {
    return null;
  }
}

function redirectToSignin(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const url = req.nextUrl.clone();
  url.pathname = '/auth/signin';
  url.search = `?next=${encodeURIComponent(pathname + (search || ''))}`;
  return NextResponse.redirect(url);
}

function redirectHome(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = '/';
  url.search = '';
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public / auth paths → pass
  if (isPublicPath(pathname)) return NextResponse.next();

  // If no rule targets this path, allow
  const rule = RULES.find((r) => pathname.startsWith(r.prefix));
  if (!rule) return NextResponse.next();

  // 1) Preferred: use Gateway’s /api/auth/me
  const me = await fetchMe(req);
  if (!me || !me.authenticated || !me.user) {
    return redirectToSignin(req);
  }

  // 2) If gateway provided effective scopes, trust them
  let effectiveScopes: string[] | null =
    Array.isArray(me.user.scopes) ? me.user.scopes : null;

  // 3) Fallback: compute from local cookie if gateway didn’t include scopes
  if (!effectiveScopes) {
    const cookieUser = getSessionUserFromCookie(req);
    if (!cookieUser) return redirectToSignin(req);
    effectiveScopes = resolveEffectiveScopes(cookieUser);
  }

  // 4) Enforce access — any one required scope unlocks the section
  const ok = rule.required.some((s) => effectiveScopes!.includes(s));
  if (ok) return NextResponse.next();

  // 5) Not authorized → send home (or serve a 403)
  return redirectHome(req);
}

// Match everything except API and static assets
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.(?:png|jpg|ico|svg)).*)'],
};
