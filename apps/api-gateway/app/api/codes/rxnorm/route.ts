// apps/api-gateway/app/api/codes/rxnorm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { searchRxNorm, ensureRxNormLoaded } from '@ambulant/clinical-codes/rxnorm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 50);
    const preferGeneric = (searchParams.get('preferGeneric') ?? '1') !== '0';

    const loaded = await ensureRxNormLoaded();
    if (!q || q.length < 2) return NextResponse.json({ ok: true, loaded, items: [] });

    const items = await searchRxNorm(q, { limit, preferGeneric });
    return NextResponse.json({ ok: true, loaded, items });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'rxnorm_search_failed', items: [] },
      { status: 500 },
    );
  }
}
