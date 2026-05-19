import { NextRequest, NextResponse } from 'next/server';
import { PrismaRuntimeRolloutStore } from '@/src/insightcore/PrismaRuntimeRolloutStore';
import { PrismaRuntimeExperimentAssignmentStore } from '@/src/insightcore/PrismaRuntimeExperimentAssignmentStore';
import { RuntimeDriftSummary } from '@/../../packages/insightcore/src/evaluation/RuntimeDriftSummary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId') || undefined;
  const rolloutRecords = await new PrismaRuntimeRolloutStore().list(orgId);
  const experimentAssignments = await new PrismaRuntimeExperimentAssignmentStore().list(orgId);

  return NextResponse.json({
    item: new RuntimeDriftSummary().build({
      rolloutRecords,
      experimentAssignments,
    }),
  });
}