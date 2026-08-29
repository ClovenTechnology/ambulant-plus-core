// apps/api-gateway/app/api/codes/rxnorm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { searchRxNorm, ensureRxNormLoaded } from '@ambulant/clinical-codes/rxnorm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const startedAt = performance.now();
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 50);
    const preferGeneric = (searchParams.get('preferGeneric') ?? '1') !== '0';
    const loaded = await ensureRxNormLoaded();
    const items = q.length >= 2 ? await searchRxNorm(q, { limit, preferGeneric }) : [];
    const timingMs = Math.round((performance.now() - startedAt) * 10) / 10;
    return NextResponse.json(
      { ok: true, loaded, items, catalogue: { system: 'RxNorm', source: 'NLM/RxNav-derived local catalogue' }, timingMs },
      { headers: { 'cache-control': 'public, max-age=60, stale-while-revalidate=300', 'server-timing': `rxnorm;dur=${timingMs}` } },
    );
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'rxnorm_search_failed', items: [] }, { status: 500, headers: { 'cache-control': 'no-store' } });
  }
}
