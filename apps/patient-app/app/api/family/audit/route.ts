// apps/patient-app/app/api/family/audit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { gatewayBase, forwardIdentityHeaders, readJsonSafe } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const qs = req.nextUrl.searchParams.toString();
    const res = await fetch(`${gatewayBase()}/api/family/audit${qs ? `?${qs}` : ''}`, {
      method: 'GET',
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

    return NextResponse.json(json ?? { ok: true, items: [] }, {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to load family audit history' },
      { status: 502 },
    );
  }
}