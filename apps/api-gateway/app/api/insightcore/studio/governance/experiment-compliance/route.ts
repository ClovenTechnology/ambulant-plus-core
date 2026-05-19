import { NextResponse } from 'next/server';
import { PrismaRuntimeExperimentAssignmentStore } from '@/src/insightcore/PrismaRuntimeExperimentAssignmentStore';
import { ExperimentComplianceLens } from '@/../../packages/insightcore/src/governance/ExperimentComplianceLens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const experimentAssignments = await new PrismaRuntimeExperimentAssignmentStore().list();

  return NextResponse.json({
    item: new ExperimentComplianceLens().build({
      experimentAssignments,
    }),
  });
}