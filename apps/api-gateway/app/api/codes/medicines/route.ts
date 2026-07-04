// apps/api-gateway/app/api/codes/medicines/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { searchMedicines } from '@ambulant/clinical-codes/medicine-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 50);
    const includeRxNorm = (searchParams.get('includeRxNorm') ?? '1') !== '0';

    if (q.length < 2) return NextResponse.json({ ok: true, items: [] });

    const items = await searchMedicines(q, { limit, includeRxNorm });
    return NextResponse.json({
      ok: true,
      items,
      catalogue: {
        country: 'ZA',
        source: 'local_sa_seed_plus_rxnorm',
        nappiComplete: false,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'medicine_search_failed', items: [] },
      { status: 500 },
    );
  }
}
