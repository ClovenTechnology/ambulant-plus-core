import { NextRequest, NextResponse } from 'next/server';
import { InMemoryOrgGovernanceProvider } from '@/../../packages/insightcore/src/governance/InMemoryOrgGovernanceProvider';
import { DbOrgGovernanceProvider } from '@/../../packages/insightcore/src/governance/DbOrgGovernanceProvider';
import { PrismaRuntimeGovernanceStore } from '@/src/insightcore/PrismaRuntimeGovernanceStore';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId') || 'org-default';

  const provider = new DbOrgGovernanceProvider(
    new PrismaRuntimeGovernanceStore(),
    new InMemoryOrgGovernanceProvider(),
  );

  const latestUpdate = await prisma.runtimeEvent.findFirst({
    where: {
      kind: 'insight.governance.org.update',
      orgId,
    },
    orderBy: { ts: 'desc' },
  });

  return NextResponse.json({
    item: await provider.get(orgId),
    latestUpdate: latestUpdate
      ? {
          id: latestUpdate.id,
          ts: latestUpdate.ts.toString(),
        }
      : null,
  });
}