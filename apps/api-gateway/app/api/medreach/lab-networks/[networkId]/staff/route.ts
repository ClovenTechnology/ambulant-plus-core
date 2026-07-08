// apps/api-gateway/app/api/medreach/lab-networks/[networkId]/staff/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { emitEvent } from '@/src/lib/events';
import {
  NETWORK_STAFF_ROLES,
  canManageNetwork,
  canReadNetwork,
  cleanNetworkStaffRole,
  cleanString,
  projectNetworkStaff,
  roleOf,
  writeNetworkAudit,
} from '@/src/lib/medreach-lab-network';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STAFF_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'REVOKED'] as const;

function cleanStatus(value: unknown, fallback = 'PENDING') {
  const status = cleanString(value).toUpperCase();

  return STAFF_STATUSES.includes(status as any) ? status : fallback;
}

function cleanBoolean(value: unknown, fallback: boolean | undefined = undefined) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return fallback;
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

  const url = new URL(req.url);
  const role = cleanString(url.searchParams.get('role')).toUpperCase();
  const status = cleanString(url.searchParams.get('status')).toUpperCase();
  const active = cleanBoolean(url.searchParams.get('active'), undefined);

  const where: Record<string, any> = { networkId };

  if (NETWORK_STAFF_ROLES.includes(role as any)) where.role = role as any;
  if (STAFF_STATUSES.includes(status as any)) where.status = status as any;
  if (active !== undefined) where.active = active;

  const rows = await prisma.medReachLabNetworkStaff.findMany({
    where,
    orderBy: [{ active: 'desc' }, { role: 'asc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({
    ok: true,
    data: rows.map(projectNetworkStaff),
    counts: {
      total: rows.length,
      active: rows.filter((row) => row.active && row.status === 'ACTIVE').length,
      pending: rows.filter((row) => row.status === 'PENDING').length,
      suspended: rows.filter((row) => row.status === 'SUSPENDED').length,
      revoked: rows.filter((row) => row.status === 'REVOKED').length,
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

  const userId = cleanString(body.userId || body.userRef || body.staffUserId);
  const requestedStatus = cleanStatus(body.status, 'PENDING');
  const status = ['ACTIVE', 'PENDING'].includes(requestedStatus) ? requestedStatus : 'PENDING';
  const active = status === 'ACTIVE';
  const role = cleanNetworkStaffRole(body.role);
  const now = new Date();

  if (!userId) {
    return NextResponse.json({ ok: false, error: 'missing_userId' }, { status: 400 });
  }

  const network = await prisma.medReachLabNetwork.findUnique({
    where: { id: networkId },
    select: { id: true, active: true, status: true },
  });

  if (!network || !network.active) {
    return NextResponse.json({ ok: false, error: 'network_not_active' }, { status: 400 });
  }

  const staff = await prisma.medReachLabNetworkStaff.upsert({
    where: {
      userId_networkId: {
        userId,
        networkId,
      },
    },
    create: {
      userId,
      networkId,
      role: role as any,
      status: status as any,
      active,
      invitedBy: who.uid,
      approvedBy: status === 'ACTIVE' ? who.uid : null,
      invitedAt: now,
      approvedAt: status === 'ACTIVE' ? now : null,
    },
    update: {
      role: role as any,
      status: status as any,
      active,
      invitedBy: who.uid,
      approvedBy: status === 'ACTIVE' ? who.uid : null,
      invitedAt: now,
      approvedAt: status === 'ACTIVE' ? now : null,
    },
  });

  await writeNetworkAudit('medreach_lab_network_staff_saved', who, staff.id, {
    networkId,
    staffId: staff.id,
    userId,
    role: staff.role,
    status: staff.status,
    active: staff.active,
  });

  emitEvent({
    kind: 'medreach_lab_network_staff_saved',
    payload: {
      networkId,
      staffId: staff.id,
      userId,
      role: staff.role,
      status: staff.status,
      active: staff.active,
      at: new Date().toISOString(),
    },
    targets: { admin: true },
  });

  return NextResponse.json({
    ok: true,
    data: projectNetworkStaff(staff),
  });
}