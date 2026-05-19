import { NextResponse } from 'next/server';
import { PrismaRuntimeRolloutStore } from '@/src/insightcore/PrismaRuntimeRolloutStore';
import { PrismaRuntimeExperimentAssignmentStore } from '@/src/insightcore/PrismaRuntimeExperimentAssignmentStore';
import { PolicyDriftSummary } from '@/../../packages/insightcore/src/governance/PolicyDriftSummary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const rolloutRecords = await new PrismaRuntimeRolloutStore().list();
  const experimentAssignments = await new PrismaRuntimeExperimentAssignmentStore().list();

  return NextResponse.json({
    item: new PolicyDriftSummary().build({
      rolloutRecords,
      experimentAssignments,
    }),
  });
}