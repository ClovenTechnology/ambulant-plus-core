import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';
import { gatewayProxyHeaders } from '@/src/lib/gateway-proxy';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; versionId: string } },
) {
  try {
    const base = apigwBase();
    if (!base) {
      return NextResponse.json(
        { ok: false, error: 'Missing API gateway base (apigwBase())' },
        { status: 500 },
      );
    }

    const body = await request.text();
    const upstream = `${base}/api/admin/forms/${encodeURIComponent(params.id)}/versions/${encodeURIComponent(params.versionId)}/structure`;
    const response = await fetch(upstream, {
      method: 'PUT',
      cache: 'no-store',
      headers: gatewayProxyHeaders(request, {
        'content-type': 'application/json',
      }),
      body: body || '{}',
    });

    const text = await response.text();
    if (!text) {
      return NextResponse.json(
        { ok: false, error: `Upstream returned empty body (HTTP ${response.status})` },
        { status: 502 },
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Upstream returned non-JSON form-structure response' },
        { status: 502 },
      );
    }

    if (typeof payload === 'object' && payload) {
      (payload as any).ok ??= response.ok;
    }

    return NextResponse.json(payload, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Admin form structure proxy failed' },
      { status: 502 },
    );
  }
}
