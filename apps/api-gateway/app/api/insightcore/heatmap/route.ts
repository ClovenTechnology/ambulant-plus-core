// apps/api-gateway/app/api/insightcore/heatmap/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { buildSyndromicHeatmap } from '@/src/insightcore/syndromeHeatmap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseDateParam(value: string | null): Date | null {
  if (!value) return null;

  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const parsedTo = parseDateParam(searchParams.get('to'));
  const to = parsedTo ?? new Date();

  const parsedFrom = parseDateParam(searchParams.get('from'));
  const from = parsedFrom ?? new Date(to.getTime() - 1000 * 60 * 60 * 24 * 56);

  if (from.getTime() >= to.getTime()) {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_date_range',
        message: '`from` must be earlier than `to`.',
      },
      { status: 400 },
    );
  }

  const data = await buildSyndromicHeatmap(from, to);

  return NextResponse.json({
    ok: true,
    data,
    meta: {
      from: from.toISOString(),
      to: to.toISOString(),
    },
  });
}