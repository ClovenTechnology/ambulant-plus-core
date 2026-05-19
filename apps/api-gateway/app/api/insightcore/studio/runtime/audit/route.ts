import { NextRequest, NextResponse } from 'next/server';
import { RuntimeExecutionPlanner } from '@/../../packages/insightcore/src/runtime/RuntimeExecutionPlanner';
import { RuntimeExecutionAudit } from '@/../../packages/insightcore/src/runtime/RuntimeExecutionAudit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const researchMode = req.nextUrl.searchParams.get('researchMode') === '1';
  const plan = new RuntimeExecutionPlanner().build({ researchMode });

  return NextResponse.json({
    item: new RuntimeExecutionAudit().build({
      plan,
      researchInferenceCount: 0,
      deploymentInferenceCount: 0,
    }),
  });
}