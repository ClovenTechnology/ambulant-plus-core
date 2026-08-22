import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';
import { requireAdminApiSession } from '@/app/api/_adminApiSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { caseId: string; encounterId: string } },
) {
  const auth = await requireAdminApiSession(req, [
    'clinical:read',
    'clinical:write',
    'patients:read',
    'patients:manage',
    'admin:read',
  ]);
  if (!auth.ok) return auth.response;

  try {
    const upstream = await fetch(
      new URL(
        `/api/cases/${encodeURIComponent(params.caseId)}/encounters/${encodeURIComponent(params.encounterId)}`,
        apigwBase(),
      ),
      { method: 'GET', headers: auth.gatewayHeaders, cache: 'no-store' },
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
