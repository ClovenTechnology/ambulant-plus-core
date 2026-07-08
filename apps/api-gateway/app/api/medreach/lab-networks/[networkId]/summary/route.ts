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

function n(value: number | null | undefined) {
  return Number(value || 0);
}

function emptyMoney(currency: string) {
  return {
    currency,
    records: 0,
    subtotalCents: 0,
    logisticsFeeCents: 0,
    urgentSurchargeCents: 0,
    coldChainSurchargeCents: 0,
    platformFeeCents: 0,
    labGrossCents: 0,
    phlebGrossCents: 0,
    labNetCents: 0,
    phlebNetCents: 0,
    sponsorAmountMinor: 0,
    patientCopayMinor: 0,
  };
}

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

  const branchIds = branches.map((branch) => branch.id);

  const financialRows =
    branchIds.length > 0
      ? await prisma.medReachOrderFinancial.groupBy({
          by: ['labId', 'currency'],
          where: {
            labId: { in: branchIds },
          },
          _sum: {
            subtotalCents: true,
            logisticsFeeCents: true,
            urgentSurchargeCents: true,
            coldChainSurchargeCents: true,
            platformFeeCents: true,
            labGrossCents: true,
            phlebGrossCents: true,
            labNetCents: true,
            phlebNetCents: true,
            sponsorAmountMinor: true,
            patientCopayMinor: true,
          },
          _count: {
            _all: true,
          },
        })
      : [];

  const revenueByCurrencyMap = new Map<string, ReturnType<typeof emptyMoney>>();
  const revenueByLabId = new Map<string, ReturnType<typeof emptyMoney>[]>();

  for (const row of financialRows) {
    const currency = row.currency || network.currency || 'ZAR';
    const total = revenueByCurrencyMap.get(currency) || emptyMoney(currency);
    const branchTotal = emptyMoney(currency);

    branchTotal.records = n(row._count?._all);
    branchTotal.subtotalCents = n(row._sum.subtotalCents);
    branchTotal.logisticsFeeCents = n(row._sum.logisticsFeeCents);
    branchTotal.urgentSurchargeCents = n(row._sum.urgentSurchargeCents);
    branchTotal.coldChainSurchargeCents = n(row._sum.coldChainSurchargeCents);
    branchTotal.platformFeeCents = n(row._sum.platformFeeCents);
    branchTotal.labGrossCents = n(row._sum.labGrossCents);
    branchTotal.phlebGrossCents = n(row._sum.phlebGrossCents);
    branchTotal.labNetCents = n(row._sum.labNetCents);
    branchTotal.phlebNetCents = n(row._sum.phlebNetCents);
    branchTotal.sponsorAmountMinor = n(row._sum.sponsorAmountMinor);
    branchTotal.patientCopayMinor = n(row._sum.patientCopayMinor);

    total.records += branchTotal.records;
    total.subtotalCents += branchTotal.subtotalCents;
    total.logisticsFeeCents += branchTotal.logisticsFeeCents;
    total.urgentSurchargeCents += branchTotal.urgentSurchargeCents;
    total.coldChainSurchargeCents += branchTotal.coldChainSurchargeCents;
    total.platformFeeCents += branchTotal.platformFeeCents;
    total.labGrossCents += branchTotal.labGrossCents;
    total.phlebGrossCents += branchTotal.phlebGrossCents;
    total.labNetCents += branchTotal.labNetCents;
    total.phlebNetCents += branchTotal.phlebNetCents;
    total.sponsorAmountMinor += branchTotal.sponsorAmountMinor;
    total.patientCopayMinor += branchTotal.patientCopayMinor;

    revenueByCurrencyMap.set(currency, total);

    const perBranch = revenueByLabId.get(row.labId) || [];
    perBranch.push(branchTotal);
    revenueByLabId.set(row.labId, perBranch);
  }

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
      branches: branches.map((branch) => ({
        ...projectBranch(branch),
        revenueByCurrency: revenueByLabId.get(branch.id) || [],
      })),
      revenue: {
        available: financialRows.length > 0,
        byCurrency: Array.from(revenueByCurrencyMap.values()),
        reason:
          financialRows.length > 0
            ? null
            : 'No MedReachOrderFinancial rows exist yet for HQ-visible branches.',
        notes: [
          'Revenue uses MedReachOrderFinancial cent/minor-unit fields only.',
          'Lab gross/net and phlebotomist gross/net are reported separately.',
          'Values are grouped by currency to avoid cross-currency mixing.',
        ],
      },
      reviews: {
        available: false,
        reason:
          'No MedReach lab review/rating model exists yet. ClinicianRating is not used for lab branch ratings.',
      },
    },
  });
}