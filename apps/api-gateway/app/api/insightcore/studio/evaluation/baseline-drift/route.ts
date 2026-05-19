import { NextResponse } from 'next/server';
import { BaselineDriftSummary } from '@/../../packages/insightcore/src/evaluation/BaselineDriftSummary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    item: new BaselineDriftSummary().build({
      baselineTrend: null,
      baselineState: null,
    }),
  });
}