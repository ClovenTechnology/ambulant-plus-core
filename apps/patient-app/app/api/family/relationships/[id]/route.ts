// apps/patient-app/app/api/family/relationships/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { gatewayBase, forwardIdentityHeaders, readJsonSafe } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.text();

    const res = await fetch(`${gatewayBase()}/api/family/relationships/${encodeURIComponent(params.id)}`, {
      method: 'PATCH',
      headers: {
        ...Object.fromEntries(forwardIdentityHeaders(req).entries()),
        'content-type': 'application/json',
      },
      body,
      cache: 'no-store',
    });

    const json = await readJsonSafe(res);

    if (!res.ok) {
      return NextResponse.json(
        json ?? { ok: false, error: `Gateway responded ${res.status}` },
        { status: res.status },
      );
    }

    return NextResponse.json(json ?? { ok: true }, {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to update relationship' },
      { status: 502 },
    );
  }
}