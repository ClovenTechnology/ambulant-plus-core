import { NextResponse } from 'next/server';
import { ComplianceStatusSummary } from '@/../../packages/insightcore/src/governance/ComplianceStatusSummary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    item: new ComplianceStatusSummary().build({
      hasGovernanceAudit: true,
      hasRuntimeAudit: true,
      hasRolloutRecords: true,
      hasExperimentAssignments: true,
    }),
  });
}