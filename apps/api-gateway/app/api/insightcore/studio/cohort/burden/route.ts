import { NextRequest, NextResponse } from 'next/server';
import { PrismaCohortSegmentationStore } from '@/src/insightcore/PrismaCohortSegmentationStore';
import { RiskBurdenTrend } from '@/../../packages/insightcore/src/cohort/RiskBurdenTrend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId') || undefined;
  const base = await new PrismaCohortSegmentationStore().summary(orgId);

  return NextResponse.json({
    item: new RiskBurdenTrend().build({
      totalEpisodes: base.totalEpisodes,
      highOrCriticalEpisodes: base.highOrCriticalEpisodes,
    }),
  });
}