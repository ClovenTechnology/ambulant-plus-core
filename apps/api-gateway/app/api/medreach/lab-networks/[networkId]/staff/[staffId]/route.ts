// apps/api-gateway/app/api/medreach/lab-networks/[networkId]/staff/[staffId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { emitEvent } from '@/src/lib/events';
import {
  canManageNetwork,
  cleanNetworkStaffRole,
  cleanString,
  projectNetworkStaff,
  writeNetworkAudit,
} from '@/src/lib/medreach-lab-network';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STAFF_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'REVOKED'] as const;

function cleanStatus(value: unknown) {
  const status = cleanString(value).toUpperCase();

  return STAFF_STATUSES.includes(status as any) ? status : null;
}

function cleanBoolean(value: unknown, fallback: boolean | undefined = undefined) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return fallback;
}

async function findStaff(networkId: string, staffId: string) {
  return prisma.medReachLabNetworkStaff.findFirst({
    where: {
      networkId,
      OR: [{ id: staffId }, { userId: staffId }],
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { networkId: string; staffId: string } },
) {
  const who = readIdentity(req.headers);
  const networkId = cleanString(params.networkId);
  const staffId = cleanString(params.staffId);

  if (!networkId) {
    return NextResponse.json({ ok: false, error: 'missing_networkId' }, { status: 400 });
  }

  if (!staffId) {
    return NextResponse.json({ ok: false, error: 'missing_staffId' }, { status: 400 });
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

  const existing = await findStaff(networkId, staffId);

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'staff_not_found' }, { status: 404 });
  }

  const data: Record<string, any> = {};
  const status = cleanStatus(body.status);
  const active = cleanBoolean(body.active, undefined);

  if ('role' in body) {
    data.role = cleanNetworkStaffRole(body.role) as any;
  }

  if (status) {
    data.status = status as any;
    data.active = status === 'ACTIVE';

    if (status === 'ACTIVE') {
      data.approvedBy = who.uid;
      data.approvedAt = new Date();
    }

    if (status === 'SUSPENDED' || status === 'REJECTED' || status === 'REVOKED') {
      data.active = false;
    }
  }

  if (active !== undefined && !status) {
    data.active = active;

    if (!active && existing.status === 'ACTIVE') {
      data.status = 'SUSPENDED' as any;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_changes' }, { status: 400 });
  }

  const updated = await prisma.medReachLabNetworkStaff.update({
    where: { id: existing.id },
    data,
  });

  await writeNetworkAudit('medreach_lab_network_staff_updated', who, updated.id, {
    networkId,
    staffId: updated.id,
    userId: updated.userId,
    changedFields: Object.keys(data),
    role: updated.role,
    status: updated.status,
    active: updated.active,
  });

  emitEvent({
    kind: 'medreach_lab_network_staff_updated',
    payload: {
      networkId,
      staffId: updated.id,
      userId: updated.userId,
      changedFields: Object.keys(data),
      role: updated.role,
      status: updated.status,
      active: updated.active,
      at: new Date().toISOString(),
    },
    targets: { admin: true },
  });

  return NextResponse.json({
    ok: true,
    data: projectNetworkStaff(updated),
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { networkId: string; staffId: string } },
) {
  const who = readIdentity(req.headers);
  const networkId = cleanString(params.networkId);
  const staffId = cleanString(params.staffId);

  if (!networkId) {
    return NextResponse.json({ ok: false, error: 'missing_networkId' }, { status: 400 });
  }

  if (!staffId) {
    return NextResponse.json({ ok: false, error: 'missing_staffId' }, { status: 400 });
  }

  const allowed = await canManageNetwork(req, networkId, who);

  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const existing = await findStaff(networkId, staffId);

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'staff_not_found' }, { status: 404 });
  }

  const updated = await prisma.medReachLabNetworkStaff.update({
    where: { id: existing.id },
    data: {
      active: false,
      status: 'REVOKED' as any,
    },
  });

  await writeNetworkAudit('medreach_lab_network_staff_revoked', who, updated.id, {
    networkId,
    staffId: updated.id,
    userId: updated.userId,
    role: updated.role,
  });

  emitEvent({
    kind: 'medreach_lab_network_staff_revoked',
    payload: {
      networkId,
      staffId: updated.id,
      userId: updated.userId,
      role: updated.role,
      at: new Date().toISOString(),
    },
    targets: { admin: true },
  });

  return NextResponse.json({
    ok: true,
    data: projectNetworkStaff(updated),
  });
}