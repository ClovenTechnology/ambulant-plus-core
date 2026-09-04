import { NextRequest, NextResponse } from 'next/server';
import { authErrorResponse, requireClinicianAuth } from '@/src/lib/clinician-auth';
import { createTrustedClinicianIdentityHeader } from '@/src/lib/clinician-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CANONICAL_API_GATEWAY = 'https://api-gateway.ambulantplus.co.za';

function clean(value: unknown, max = 2000) {
  return String(value ?? '').trim().slice(0, max);
}

function gatewayBase() {
  const base =
    process.env.APIGW_BASE ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    CANONICAL_API_GATEWAY;
  return String(base).replace(/\/+$/, '');
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireClinicianAuth(req, { allowAdmin: false, allowAdminStaff: false });
  if (!auth.ok) return authErrorResponse(auth);
  if (auth.role !== 'clinician') {
    return NextResponse.json({ ok: false, error: 'clinician_required' }, { status: 403 });
  }

  const id = clean(params.id, 180);
  if (!id) {
    return NextResponse.json({ ok: false, error: 'lab_order_id_required' }, { status: 400 });
  }

  let trustedIdentity: string;
  try {
    trustedIdentity = createTrustedClinicianIdentityHeader(req);
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || 'identity_bridge_failed') },
      { status: Number(error?.status || 500), headers: { 'cache-control': 'no-store' } },
    );
  }

  try {
    const upstream = await fetch(
      `${gatewayBase()}/api/labs/${encodeURIComponent(id)}/pdf`,
      {
        method: 'GET',
        headers: {
          'x-ambulant-identity': trustedIdentity,
          accept: 'application/pdf',
        },
        cache: 'no-store',
      },
    );

    const body = await upstream.arrayBuffer();
    const headers = new Headers();
    for (const key of ['content-type', 'content-disposition', 'etag', 'last-modified']) {
      const value = upstream.headers.get(key);
      if (value) headers.set(key, value);
    }
    headers.set('cache-control', 'no-store');

    return new NextResponse(body, {
      status: upstream.status,
      headers,
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: 'api_gateway_unreachable',
      message: String(error?.message || error || 'gateway_unreachable'),
    }, { status: 502 });
  }
}
