// apps/api-gateway/app/api/codes/labs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { searchLabTests } from '@ambulant/clinical-codes/lab-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 50);

    if (q.length < 2) return NextResponse.json({ ok: true, items: [] });

    const items = searchLabTests(q, { limit });
    return NextResponse.json({
      ok: true,
      items,
      catalogue: {
        country: 'ZA',
        source: 'local_sa_lab_seed',
        providerComplete: false,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'lab_search_failed', items: [] },
      { status: 500 },
    );
  }
}
