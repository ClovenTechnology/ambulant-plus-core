// apps/api-gateway/app/api/medreach/lab-networks/[networkId]/branches/[labId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { emitEvent } from '@/src/lib/events';
import {
  canManageNetwork,
  cleanBoolean,
  cleanBranchType,
  cleanString,
  projectBranch,
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { networkId: string; labId: string } },
) {
  const who = readIdentity(req.headers);
  const networkId = cleanString(params.networkId);
  const labId = cleanString(params.labId);

  if (!networkId) {
    return NextResponse.json({ ok: false, error: 'missing_networkId' }, { status: 400 });
  }

  if (!labId) {
    return NextResponse.json({ ok: false, error: 'missing_labId' }, { status: 400 });
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

  const existing = await prisma.labPartner.findFirst({
    where: { id: labId, networkId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'branch_not_found' }, { status: 404 });
  }

  const data: Record<string, any> = {};

  if ('branchCode' in body) data.branchCode = cleanString(body.branchCode) || null;
  if ('branchType' in body) data.branchType = cleanBranchType(body.branchType) as any;
  if ('hqVisible' in body) data.hqVisible = cleanBoolean(body.hqVisible, true);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_changes' }, { status: 400 });
  }

  const branch = await prisma.labPartner.update({
    where: { id: labId },
    data,
    include: branchInclude,
  });

  await writeNetworkAudit('medreach_lab_network_branch_updated', who, labId, {
    networkId,
    labId,
    changedFields: Object.keys(data),
  });

  emitEvent({
    kind: 'medreach_lab_network_branch_updated',
    payload: {
      networkId,
      labId,
      changedFields: Object.keys(data),
      at: new Date().toISOString(),
    },
    targets: { admin: true },
  });

  return NextResponse.json({
    ok: true,
    data: projectBranch(branch),
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { networkId: string; labId: string } },
) {
  const who = readIdentity(req.headers);
  const networkId = cleanString(params.networkId);
  const labId = cleanString(params.labId);

  if (!networkId) {
    return NextResponse.json({ ok: false, error: 'missing_networkId' }, { status: 400 });
  }

  if (!labId) {
    return NextResponse.json({ ok: false, error: 'missing_labId' }, { status: 400 });
  }

  const allowed = await canManageNetwork(req, networkId, who);

  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const existing = await prisma.labPartner.findFirst({
    where: { id: labId, networkId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'branch_not_found' }, { status: 404 });
  }

  const branch = await prisma.labPartner.update({
    where: { id: labId },
    data: {
      networkId: null,
      branchCode: null,
      branchType: 'OWNED_BRANCH' as any,
      hqVisible: true,
    },
    include: branchInclude,
  });

  await writeNetworkAudit('medreach_lab_network_branch_detached', who, labId, {
    networkId,
    labId,
  });

  emitEvent({
    kind: 'medreach_lab_network_branch_detached',
    payload: {
      networkId,
      labId,
      at: new Date().toISOString(),
    },
    targets: { admin: true },
  });

  return NextResponse.json({
    ok: true,
    data: projectBranch(branch),
  });
}