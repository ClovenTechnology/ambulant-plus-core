import { NextResponse } from 'next/server';
import { RuntimeExecutionPlanner } from '@/../../packages/insightcore/src/runtime/RuntimeExecutionPlanner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    item: new RuntimeExecutionPlanner().build({
      researchMode: false,
    }),
  });
}