import { NextRequest, NextResponse } from 'next/server';
import { PrismaCohortSegmentationStore } from '@/src/insightcore/PrismaCohortSegmentationStore';
import { ChronicCareCohortLens } from '@/../../packages/insightcore/src/cohort/ChronicCareCohortLens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId') || undefined;
  const base = await new PrismaCohortSegmentationStore().summary(orgId);

  return NextResponse.json({
    item: new ChronicCareCohortLens().build({
      chronicPatients: base.chronicPatients,
      chronicEpisodes: base.chronicEpisodes,
    }),
  });
}