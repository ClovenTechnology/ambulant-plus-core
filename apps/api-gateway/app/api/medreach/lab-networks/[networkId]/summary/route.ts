// apps/api-gateway/app/api/medreach/lab-networks/[networkId]/summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import {
  canReadNetwork,
  cleanString,
  projectBranch,
  projectNetwork,
} from '@/src/lib/medreach-lab-network';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const branchInclude = {
  _count: {
    select: {
      staffMembers: true,
      medReachJobs: true,
      orderFinancials: true,
      offeredTests: true,
      panels: true,
      specimenBundles: true,
    },
  },
};

export async function GET(
  req: NextRequest,
  { params }: { params: { networkId: string } },
) {
  const who = readIdentity(req.headers);
  const networkId = cleanString(params.networkId);

  if (!networkId) {
    return NextResponse.json({ ok: false, error: 'missing_networkId' }, { status: 400 });
  }

  const allowed = await canReadNetwork(req, networkId, who);

  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const network = await prisma.medReachLabNetwork.findUnique({
    where: { id: networkId },
    include: {
      _count: {
        select: {
          branches: true,
          staffMembers: true,
        },
      },
    },
  });

  if (!network) {
    return NextResponse.json({ ok: false, error: 'network_not_found' }, { status: 404 });
  }

  const branches = await prisma.labPartner.findMany({
    where: {
      networkId,
      hqVisible: true,
    },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    include: branchInclude,
  });

  const totals = branches.reduce(
    (acc, branch) => {
      acc.branches += 1;
      if (branch.active) acc.activeBranches += 1;
      acc.staffMembers += branch._count.staffMembers;
      acc.jobs += branch._count.medReachJobs;
      acc.financialRecords += branch._count.orderFinancials;
      acc.tests += branch._count.offeredTests;
      acc.panels += branch._count.panels;
      acc.specimenBundles += branch._count.specimenBundles;
      return acc;
    },
    {
      branches: 0,
      activeBranches: 0,
      staffMembers: 0,
      jobs: 0,
      financialRecords: 0,
      tests: 0,
      panels: 0,
      specimenBundles: 0,
    },
  );

  return NextResponse.json({
    ok: true,
    data: {
      network: projectNetwork(network),
      totals,
      branches: branches.map(projectBranch),
      revenue: {
        available: false,
        reason:
          'Revenue aggregation is intentionally not calculated until MedReachOrderFinancial money fields are inspected and mapped safely.',
      },
      reviews: {
        available: false,
        reason:
          'Review aggregation is intentionally not calculated until branch review/rating storage is inspected and mapped safely.',
      },
    },
  });
}