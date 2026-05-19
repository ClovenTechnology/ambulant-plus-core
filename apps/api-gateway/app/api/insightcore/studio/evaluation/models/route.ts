import { NextResponse } from 'next/server';
import { PrismaEvaluationStore } from '@/src/insightcore/PrismaEvaluationStore';
import { ModelScorecard } from '@/../../packages/insightcore/src/evaluation/ModelScorecard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const store = new PrismaEvaluationStore();
  const { episodes } = await store.recent();

  const inferences =
    episodes?.flatMap((e: any) => e.payload?.inferences || []) || [];

  return NextResponse.json({
    item: new ModelScorecard().build({
      inferences,
    }),
  });
}