// apps/patient-app/app/api/family/invitations/[id]/resend/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { gatewayBase, forwardIdentityHeaders, readJsonSafe } from '../../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const res = await fetch(`${gatewayBase()}/api/family/invitations/${encodeURIComponent(params.id)}/resend`, {
      method: 'POST',
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
      { ok: false, error: e?.message || 'Failed to resend invitation' },
      { status: 502 },
    );
  }
}