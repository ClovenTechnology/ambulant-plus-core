import { NextRequest, NextResponse } from 'next/server';
import { PrismaCohortSegmentationStore } from '@/src/insightcore/PrismaCohortSegmentationStore';
import { CohortSegmenter } from '@/../../packages/insightcore/src/cohort/CohortSegmenter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId') || undefined;
  const base = await new PrismaCohortSegmentationStore().summary(orgId);

  return NextResponse.json({
    item: new CohortSegmenter().segment({
      totalPatients: base.totalPatients,
      maternalPatients: base.maternalPatients,
      chronicPatients: base.chronicPatients,
      researchPatients: base.researchPatients,
    }),
  });
}