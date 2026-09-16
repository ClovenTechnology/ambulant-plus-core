import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
async function proxy(req: NextRequest) {
  try {
    if (req.method === 'POST' && (req.headers.get('origin') !== new URL(req.url).origin || req.headers.get('sec-fetch-site') === 'cross-site')) return NextResponse.json({ error: 'same_origin_required' }, { status: 403 });
    const value = process.env.API_GATEWAY_BASE_URL || process.env.API_GATEWAY_URL || process.env.APIGW_BASE || process.env.NEXT_PUBLIC_APIGW_BASE || process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL;
    if (!value) throw new Error('gateway_not_configured');
    const gateway = new URL(value);
    const token = req.cookies.get('adm.profile')?.value;
    if (!token) return NextResponse.json({ error: 'admin_authentication_required' }, { status: 401 });
    const upstream = await fetch(new URL('/api/admin/partner-access' + req.nextUrl.search, gateway), { method: req.method, cache: 'no-store', redirect: 'error', headers: { cookie: 'adm.profile=' + token, origin: gateway.origin, 'content-type': 'application/json' }, body: req.method === 'POST' ? await req.text() : undefined });
    return new NextResponse(await upstream.text(), { status: upstream.status, headers: { 'cache-control': 'no-store', 'content-type': 'application/json', 'referrer-policy': 'no-referrer' } });
  } catch { return NextResponse.json({ error: 'partner_service_unavailable' }, { status: 503 }); }
}
export const GET = proxy;
export const POST = proxy;
