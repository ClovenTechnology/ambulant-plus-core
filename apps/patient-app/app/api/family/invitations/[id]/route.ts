// apps/patient-app/app/api/family/invitations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { gatewayBase, forwardIdentityHeaders, readJsonSafe } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const res = await fetch(`${gatewayBase()}/api/family/invitations/${encodeURIComponent(params.id)}`, {
      method: 'DELETE',
      headers: forwardIdentityHeaders(req),
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
      { ok: false, error: e?.message || 'Failed to cancel invitation' },
      { status: 502 },
    );
  }
}