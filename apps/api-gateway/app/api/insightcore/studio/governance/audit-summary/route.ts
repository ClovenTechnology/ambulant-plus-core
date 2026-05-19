import { NextRequest, NextResponse } from 'next/server';
import { PrismaGovernanceAuditStore } from '@/src/insightcore/PrismaGovernanceAuditStore';
import { GovernanceAuditSummary } from '@/../../packages/insightcore/src/governance/GovernanceAuditSummary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId') || undefined;
  const changes = await new PrismaGovernanceAuditStore().list(orgId);

  return NextResponse.json({
    item: new GovernanceAuditSummary().build({ changes }),
  });
}