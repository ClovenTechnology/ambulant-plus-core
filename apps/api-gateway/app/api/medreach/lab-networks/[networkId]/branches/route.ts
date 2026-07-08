// apps/api-gateway/app/api/medreach/lab-networks/[networkId]/branches/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { emitEvent } from '@/src/lib/events';
import {
  canManageNetwork,
  canReadNetwork,
  cleanBoolean,
  cleanBranchType,
  cleanString,
  projectBranch,
  roleOf,
  writeNetworkAudit,
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

  const url = new URL(req.url);
  const includeHidden = cleanBoolean(url.searchParams.get('includeHidden'), false);
  const includeInactive = cleanBoolean(url.searchParams.get('includeInactive'), false);
  const role = roleOf(who);

  const where: Record<string, any> = { networkId };

  if (!includeHidden && !['admin', 'system'].includes(role)) where.hqVisible = true;
  if (!includeInactive) where.active = true;

  const branches = await prisma.labPartner.findMany({
    where,
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    include: branchInclude,
  });

  return NextResponse.json({
    ok: true,
    data: branches.map(projectBranch),
    counts: {
      total: branches.length,
      active: branches.filter((branch) => branch.active).length,
      visibleToHq: branches.filter((branch) => branch.hqVisible).length,
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { networkId: string } },
) {
  const who = readIdentity(req.headers);
  const networkId = cleanString(params.networkId);

  if (!networkId) {
    return NextResponse.json({ ok: false, error: 'missing_networkId' }, { status: 400 });
  }

  const allowed = await canManageNetwork(req, networkId, who);

  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const labId = cleanString(body.labId || body.branchId);
  const branchCode = cleanString(body.branchCode);

  if (!labId) {
    return NextResponse.json({ ok: false, error: 'missing_labId' }, { status: 400 });
  }

  const existing = await prisma.labPartner.findUnique({
    where: { id: labId },
    select: { id: true, networkId: true, name: true },
  });

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'lab_not_found' }, { status: 404 });
  }

  if (existing.networkId && existing.networkId !== networkId) {
    return NextResponse.json(
      { ok: false, error: 'lab_already_attached_to_another_network' },
      { status: 409 },
    );
  }

  const branch = await prisma.labPartner.update({
    where: { id: labId },
    data: {
      networkId,
      branchCode: branchCode || existing.id,
      branchType: cleanBranchType(body.branchType) as any,
      hqVisible: cleanBoolean(body.hqVisible, true),
    },
    include: branchInclude,
  });

  await writeNetworkAudit('medreach_lab_network_branch_attached', who, branch.id, {
    networkId,
    labId: branch.id,
    branchCode: branch.branchCode,
    branchType: branch.branchType,
  });

  emitEvent({
    kind: 'medreach_lab_network_branch_attached',
    payload: {
      networkId,
      labId: branch.id,
      branchCode: branch.branchCode,
      branchType: branch.branchType,
      at: new Date().toISOString(),
    },
    targets: { admin: true },
  });

  return NextResponse.json({
    ok: true,
    data: projectBranch(branch),
  });
}