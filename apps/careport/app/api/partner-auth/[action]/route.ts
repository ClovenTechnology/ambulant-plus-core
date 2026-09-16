import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function base() {
  const value = process.env.APIGW_BASE || process.env.API_GATEWAY_BASE_URL || process.env.API_GATEWAY_URL || process.env.NEXT_PUBLIC_APIGW_BASE || process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL;
  if (!value) throw new Error('gateway_not_configured');
  return new URL(value);
}
async function proxy(req: NextRequest, { params }: { params: { action: string } }) {
  try {
    if (!['me', 'login', 'activate', 'logout', 'password'].includes(params.action)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if (req.method !== 'GET' && (req.headers.get('origin') !== new URL(req.url).origin || req.headers.get('sec-fetch-site') === 'cross-site')) return NextResponse.json({ error: 'same_origin_required' }, { status: 403 });
    const gateway = base();
    const headers = new Headers({ accept: 'application/json', 'content-type': 'application/json', origin: gateway.origin });
    const name = process.env.NODE_ENV === 'production' ? '__Host-ambulant_partner_session' : 'ambulant_partner_session';
    const session = req.cookies.get(name)?.value;
    if (session) headers.set('authorization', 'Bearer ' + session);
    // Forward only the partner cookie. Admin/patient cookies are not used for partner login.
    if (session) headers.set('cookie', name + '=' + session);
    const upstream = await fetch(new URL('/api/partner-auth/' + params.action, gateway), { method: req.method, headers, cache: 'no-store', redirect: 'error', body: req.method === 'GET' ? undefined : await req.text() });
    const out = new Headers({ 'content-type': 'application/json', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
    const cookie = upstream.headers.get('set-cookie');
    if (cookie) out.set('set-cookie', cookie);
    return new NextResponse(await upstream.text(), { status: upstream.status, headers: out });
  } catch { return NextResponse.json({ error: 'partner_service_unavailable' }, { status: 503, headers: { 'cache-control': 'no-store' } }); }
}
export const GET = proxy;
export const POST = proxy;
