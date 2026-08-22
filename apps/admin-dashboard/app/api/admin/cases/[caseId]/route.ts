import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';
import { requireAdminApiSession } from '@/app/api/_adminApiSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function forward(
  req: NextRequest,
  method: 'GET' | 'PATCH',
  caseId: string,
) {
  const auth = await requireAdminApiSession(
    req,
    method === 'GET'
      ? ['clinical:read', 'clinical:write', 'patients:read', 'patients:manage', 'admin:read']
      : ['clinical:write', 'patients:manage', 'admin:write'],
  );
  if (!auth.ok) return auth.response;

  const headers = new Headers(auth.gatewayHeaders);
  if (method === 'PATCH') headers.set('content-type', 'application/json');

  try {
    const upstream = await fetch(
      new URL(`/api/cases/${encodeURIComponent(caseId)}`, apigwBase()),
      {
        method,
        headers,
        body: method === 'PATCH' ? await req.text() : undefined,
        cache: 'no-store',
      },
    );
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'case_upstream_unavailable' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { caseId: string } },
) {
  return forward(req, 'GET', params.caseId);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { caseId: string } },
) {
  return forward(req, 'PATCH', params.caseId);
}
