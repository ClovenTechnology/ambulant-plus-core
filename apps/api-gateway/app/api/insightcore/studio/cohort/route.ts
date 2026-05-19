import { NextRequest, NextResponse } from 'next/server';
import { PrismaCohortReadModel } from '@/src/insightcore/PrismaCohortReadModel';
import { CohortSignalSummary } from '@/../../packages/insightcore/src/cohort/CohortSignalSummary';
import { OmopCohortProjection } from '@/../../packages/insightcore/src/omop/OmopCohortProjection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId') || undefined;
  const base = await new PrismaCohortReadModel().summary(orgId);
  const summary = new CohortSignalSummary().build(base);

  return NextResponse.json({
    item: summary,
    omop: new OmopCohortProjection().map(summary),
  });
}