import { NextResponse } from 'next/server';
import { PrismaRuntimeRolloutStore } from '@/src/insightcore/PrismaRuntimeRolloutStore';
import { RuntimeExecutionPlanner } from '@/../../packages/insightcore/src/runtime/RuntimeExecutionPlanner';
import { RolloutSafetyGate } from '@/../../packages/insightcore/src/governance/RolloutSafetyGate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const rolloutRecords = await new PrismaRuntimeRolloutStore().list();
  const runtimePlan = new RuntimeExecutionPlanner().build({ researchMode: false });

  return NextResponse.json({
    item: new RolloutSafetyGate().evaluate({
      rolloutRecords,
      runtimePlan,
    }),
  });
}