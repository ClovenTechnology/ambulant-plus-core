import { NextResponse } from 'next/server';
import { PrismaEvaluationStore } from '@/src/insightcore/PrismaEvaluationStore';
import { ResearchSignalScorecard } from '@/../../packages/insightcore/src/evaluation/ResearchSignalScorecard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const store = new PrismaEvaluationStore();
  const { episodes } = await store.recent();

  const researchSignals =
    episodes?.flatMap((e: any) => e.payload?.researchSignals || []) || [];

  return NextResponse.json({
    item: new ResearchSignalScorecard().build({
      researchSignals: {
        totalResearchSignals: researchSignals.length,
      },
      researchPipelines: { pipelines: [] },
    }),
  });
}