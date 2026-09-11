import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';
import { requireAdminApiSession } from '@/app/api/_adminApiSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function forward(req: NextRequest, method: 'GET' | 'POST') {
  const auth = await requireAdminApiSession(
    req,
    method === 'GET'
      ? ['admin:read', 'admin:write', 'compliance:read', 'compliance:manage', 'compliance.read', 'compliance.manage']
      : ['admin:write', 'compliance:manage', 'compliance.manage'],
  );
  if (!auth.ok) return auth.response;

  const headers = new Headers(auth.gatewayHeaders);
  headers.set('accept', 'application/json');
  if (method === 'POST') headers.set('content-type', 'application/json');

  const path = `/api/admin/compliance/renewals${method === 'GET' ? req.nextUrl.search : ''}`;
  try {
    const upstream = await fetch(new URL(path, apigwBase()), {
      method,
      headers,
      body: method === 'POST' ? await req.text() : undefined,
      cache: 'no-store',
    });
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store, max-age=0',
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'compliance_renewals_upstream_unavailable' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
}

export async function GET(req: NextRequest) {
  return forward(req, 'GET');
}

export async function POST(req: NextRequest) {
  return forward(req, 'POST');
}
