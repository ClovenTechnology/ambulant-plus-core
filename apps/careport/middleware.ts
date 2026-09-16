import { NextRequest, NextResponse } from 'next/server';
const ROLES = ["pharmacy", "rider"];
const publicPaths = new Set(['/', '/auth/login', '/login', '/auth/activate', '/auth/signup', '/auth/signup/evidence', '/favicon.ico', '/robots.txt']);
const publicApis = new Set(['/api/partner-auth/login', '/api/partner-auth/activate', '/api/partner-auth/logout', '/api/partner-auth/me', '/api/onboarding/lab', '/api/onboarding/phleb', '/api/onboarding/evidence', '/api/careport/partners/pharmacy/apply', '/api/careport/partners/rider/apply']);
export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (publicPaths.has(path) || publicApis.has(path) || path.startsWith('/_next/')) return NextResponse.next();
  const denied = (status: number) => path.startsWith('/api/')
    ? NextResponse.json({ ok: false, error: status === 401 ? 'partner_session_required' : 'partner_access_denied' }, { status, headers: { 'cache-control': 'no-store' } })
    : NextResponse.redirect(new URL('/auth/login', req.url));
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && (req.headers.get('origin') !== new URL(req.url).origin || req.headers.get('sec-fetch-site') === 'cross-site')) return denied(403);
  const token = req.cookies.get(process.env.NODE_ENV === 'production' ? '__Host-ambulant_partner_session' : 'ambulant_partner_session')?.value;
  if (!token || !/^aps1_[A-Za-z0-9_-]{43}$/.test(token)) return denied(401);
  const gateway = process.env.APIGW_BASE || process.env.API_GATEWAY_BASE_URL || process.env.API_GATEWAY_URL || process.env.NEXT_PUBLIC_APIGW_BASE || process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL;
  if (!gateway) return denied(401);
  try {
    const upstream = await fetch(new URL('/api/partner-auth/me', gateway), { headers: { authorization: 'Bearer ' + token }, cache: 'no-store', redirect: 'error' });
    if (!upstream.ok) return denied(401);
    const { account } = await upstream.json();
    if (!account || !ROLES.includes(account.role)) return denied(403);
    const segments = path.split('/');
    if (['pharmacy', 'rider', 'lab', 'phleb'].includes(segments[1]) && segments[1] !== account.role) return denied(403);
    if (['lab', 'phleb'].includes(segments[1]) && segments[2] && ![account.actorRefId, account.userId].includes(decodeURIComponent(segments[2]))) return denied(403);
    if (path === '/admin' || path.startsWith('/admin/') || path.startsWith('/api/admin/')) return denied(403);
    const headers = new Headers(req.headers);
    for (const key of Array.from(headers.keys())) if (/^x-(?:ambulant-|role|uid|user-id|org|lab-id|staff-lab-id|actor-ref-id|network-id|staff-network-id)/.test(key)) headers.delete(key);
    headers.set('authorization', 'Bearer ' + token);
    return NextResponse.next({ request: { headers } });
  } catch { return denied(401); }
}
export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
