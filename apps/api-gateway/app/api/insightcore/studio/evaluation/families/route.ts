import { NextResponse } from 'next/server';
import { RuntimeExecutionPlanner } from '@/../../packages/insightcore/src/runtime/RuntimeExecutionPlanner';
import { FamilyScorecard } from '@/../../packages/insightcore/src/evaluation/FamilyScorecard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const plan = new RuntimeExecutionPlanner().build({ researchMode: false });

  return NextResponse.json({
    item: new FamilyScorecard().build({
      families: plan.families,
    }),
  });
}