import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function apigwBase() {
  const base =
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    '';

  if (!base) {
    throw new Error('api_gateway_base_url_missing');
  }

  return base.replace(/\/+$/, '');
}

function forwardHeaders(req: NextRequest) {
  const headers = new Headers();

  for (const key of [
    'authorization',
    'cookie',
    'content-type',
    'x-user-id',
    'x-user-role',
    'x-user-roles',
    'x-org-id',
    'x-tenant-id',
    'x-correlation-id',
  ]) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  return headers;
}

async function proxyResponse(res: Response) {
  const text = await res.text();
  const contentType = res.headers.get('content-type') || 'application/json';

  return new NextResponse(text || null, {
    status: res.status,
    headers: {
      'content-type': contentType,
      'cache-control': 'no-store',
    },
  });
}

function proxyError(error: unknown) {
  const message = error instanceof Error ? error.message : 'careport_kyc_proxy_failed';

  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    { status: 500 },
  );
}
export async function POST(
  req: NextRequest,
  { params }: { params: { pharmacyId: string } },
) {
  try {
    const pharmacyId = String(params.pharmacyId || '').trim();

    if (!pharmacyId) {
      return NextResponse.json(
        { ok: false, error: 'pharmacyId_required' },
        { status: 400 },
      );
    }

    const upstream =
      apigwBase() +
      '/api/careport/admin/kyc/pharmacies/' +
      encodeURIComponent(pharmacyId) +
      '/decision';

    const body = await req.text();

    const res = await fetch(upstream, {
      method: 'POST',
      headers: forwardHeaders(req),
      body: body || '{}',
      cache: 'no-store',
    });

    return proxyResponse(res);
  } catch (error) {
    return proxyError(error);
  }
}