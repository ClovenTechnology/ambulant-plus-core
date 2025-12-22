// apps/api-gateway/app/api/insightcore/heatmap/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { buildSyndromicHeatmap } from '@/src/insightcore/syndromeHeatmap';
import type { InsightCoreConfig } from '@/src/insightcore/syndromeHeatmap';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get('from');
  const toStr = searchParams.get('to');

  const to = toStr ? new Date(toStr) : new Date();
  const from =
    fromStr ? new Date(fromStr) : new Date(to.getTime() - 1000 * 60 * 60 * 24 * 56); // last 8 weeks

  // TODO: load config from wherever /api/insightcore/config stores it.
  const config: InsightCoreConfig | undefined = undefined;

  const data = await buildSyndromicHeatmap({ from, to, config });

  return NextResponse.json({ ok: true, data });
}
