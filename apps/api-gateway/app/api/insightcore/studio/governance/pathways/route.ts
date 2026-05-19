import { NextRequest, NextResponse } from 'next/server';
import { InMemoryOrgGovernanceProvider } from '@/../../packages/insightcore/src/governance/InMemoryOrgGovernanceProvider';
import { DbOrgGovernanceProvider } from '@/../../packages/insightcore/src/governance/DbOrgGovernanceProvider';
import { PrismaRuntimeGovernanceStore } from '@/src/insightcore/PrismaRuntimeGovernanceStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId') || 'org-default';

  const provider = new DbOrgGovernanceProvider(
    new PrismaRuntimeGovernanceStore(),
    new InMemoryOrgGovernanceProvider(),
  );

  const bundle = await provider.get(orgId);

  return NextResponse.json({
    items: bundle?.pathways || [],
  });
}