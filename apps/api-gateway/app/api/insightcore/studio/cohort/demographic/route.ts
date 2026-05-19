import { NextRequest, NextResponse } from 'next/server';
import { PrismaCohortIntelligenceStore } from '@/src/insightcore/PrismaCohortIntelligenceStore';
import { DemographicSignalLens } from '@/../../packages/insightcore/src/cohort/DemographicSignalLens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId') || undefined;
  const base = await new PrismaCohortIntelligenceStore().summary(orgId);

  return NextResponse.json({
    item: new DemographicSignalLens().build({
      totalPatients: base.totalPatients,
    }),
  });
}