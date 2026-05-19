// apps/patient-app/app/api/family/relationships/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { gatewayBase, forwardIdentityHeaders, readJsonSafe } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const upstream = `${gatewayBase()}/api/family/relationships`;

    const res = await fetch(upstream, {
      method: 'GET',
      headers: forwardIdentityHeaders(req),
      cache: 'no-store',
    });

    const body = await readJsonSafe(res);

    if (!res.ok) {
      return NextResponse.json(
        body ?? { ok: false, error: `Gateway responded ${res.status}` },
        { status: res.status },
      );
    }

    return NextResponse.json(body ?? { ok: true, asHost: [], asSubject: [] }, {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to load family relationships' },
      { status: 502 },
    );
  }
}