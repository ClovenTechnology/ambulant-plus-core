import { NextResponse } from 'next/server';
import { ExecutionQualitySummary } from '@/../../packages/insightcore/src/evaluation/ExecutionQualitySummary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    item: new ExecutionQualitySummary().build({
      runtimeAudit: null,
      trace: null,
      lineage: null,
    }),
  });
}