import { NextResponse } from 'next/server';
import { RuntimeExecutionPlanner } from '@/../../packages/insightcore/src/runtime/RuntimeExecutionPlanner';
import { RuntimeExecutionAudit } from '@/../../packages/insightcore/src/runtime/RuntimeExecutionAudit';
import { RuntimePolicyScorecard } from '@/../../packages/insightcore/src/governance/RuntimePolicyScorecard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const plan = new RuntimeExecutionPlanner().build({ researchMode: false });
  const audit = new RuntimeExecutionAudit().build({
    plan,
    researchInferenceCount: 0,
    deploymentInferenceCount: 0,
  });

  return NextResponse.json({
    item: new RuntimePolicyScorecard().build({
      runtimePlan: plan,
      runtimeAudit: audit,
    }),
  });
}