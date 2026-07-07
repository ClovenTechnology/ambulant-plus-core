// apps/api-gateway/app/api/medreach/labs/[labId]/staff/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { emitEvent } from '@/src/lib/events';
import { push, sseKeys } from '@/src/lib/sse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STAFF_ROLES = ['OWNER', 'ADMIN', 'OPERATIONS', 'RESULTS', 'BILLING', 'VIEWER'] as const;
const STAFF_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'REVOKED'] as const;

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function roleOf(who: any) {
  return String(who.role || '').toLowerCase();
}

function cleanBoolean(value: unknown, fallback: boolean | undefined = undefined) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return fallback;
}

function cleanRole(value: unknown) {
  const role = cleanString(value).toUpperCase();

  return STAFF_ROLES.includes(role as any) ? role : 'VIEWER';
}

function cleanStatus(value: unknown, fallback = 'PENDING') {
  const status = cleanString(value).toUpperCase();

  return STAFF_STATUSES.includes(status as any) ? status : fallback;
}

function projectStaff(row: any) {
  return {
    id: row.id,
    userId: row.userId,
    labId: row.labId,
    role: row.role,
    active: row.active,
    status: row.status,
    invitedBy: row.invitedBy ?? null,
    approvedBy: row.approvedBy ?? null,
    invitedAt: row.invitedAt?.toISOString?.() ?? null,
    approvedAt: row.approvedAt?.toISOString?.() ?? null,
    createdAt: row.createdAt?.toISOString?.() ?? null,
    updatedAt: row.updatedAt?.toISOString?.() ?? null,
  };
}

async function canManageStaff(req: NextRequest, labId: string, who: any) {
  const role = roleOf(who);

  if (['admin', 'system'].includes(role)) return true;

  if (role === 'lab') {
    const headerLabId = cleanString(req.headers.get('x-lab-id'));

    if (!headerLabId || headerLabId !== labId) return false;

    const lab = await prisma.labPartner.findUnique({
      where: { id: labId },
      select: {
        id: true,
        active: true,
        status: true,
        ownerUserId: true,
        canManageStaff: true,
      },
    });

    if (!lab || !lab.active || lab.status !== 'ACTIVE' || !lab.canManageStaff) return false;
    if (lab.ownerUserId && who.uid && lab.ownerUserId !== who.uid) return false;

    return true;
  }

  if (role === 'lab_staff') {
    const headerLabId = cleanString(req.headers.get('x-staff-lab-id'));

    if (!headerLabId || headerLabId !== labId || !who.uid) return false;

    const staff = await prisma.medReachLabStaff.findFirst({
      where: {
        userId: who.uid,
        labId,
        active: true,
        status: 'ACTIVE',
        role: { in: ['OWNER', 'ADMIN'] as any },
        lab: {
          active: true,
          status: 'ACTIVE',
          canManageStaff: true,
        },
      },
      select: { labId: true },
    });

    return staff?.labId === labId;
  }

  return false;
}

async function canReadStaff(req: NextRequest, labId: string, who: any) {
  const role = roleOf(who);

  if (['admin', 'system'].includes(role)) return true;

  if (role === 'lab') {
    const headerLabId = cleanString(req.headers.get('x-lab-id'));

    if (!headerLabId || headerLabId !== labId) return false;

    const lab = await prisma.labPartner.findUnique({
      where: { id: labId },
      select: {
        id: true,
        active: true,
        status: true,
        ownerUserId: true,
      },
    });

    if (!lab || !lab.active || lab.status !== 'ACTIVE') return false;
    if (lab.ownerUserId && who.uid && lab.ownerUserId !== who.uid) return false;

    return true;
  }

  if (role === 'lab_staff') {
    const headerLabId = cleanString(req.headers.get('x-staff-lab-id'));

    if (!headerLabId || headerLabId !== labId || !who.uid) return false;

    const staff = await prisma.medReachLabStaff.findFirst({
      where: {
        userId: who.uid,
        labId,
        active: true,
        status: 'ACTIVE',
      },
      select: { labId: true },
    });

    return staff?.labId === labId;
  }

  return false;
}

async function emitStaffEvent(kind: string, labId: string, who: any, staff: any, extra: Record<string, any> = {}) {
  const payload = {
    kind,
    labId,
    staffId: staff.id,
    userId: staff.userId,
    role: staff.role,
    status: staff.status,
    active: staff.active,
    at: new Date().toISOString(),
    ...extra,
  };

  await prisma.auditEvent.create({
    data: {
      kind,
      actorId: who.uid,
      actorRole: who.role,
      subjectId: staff.id,
      meta: payload,
    },
  });

  emitEvent({
    kind,
    payload,
    targets: { admin: true },
  });

  await push(sseKeys.lab(labId), payload);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { labId: string } },
) {
  const who = readIdentity(req.headers);
  const labId = cleanString(params.labId);

  if (!labId) {
    return NextResponse.json({ ok: false, error: 'missing_labId' }, { status: 400 });
  }

  const allowed = await canReadStaff(req, labId, who);

  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = cleanString(url.searchParams.get('status')).toUpperCase();
  const active = cleanBoolean(url.searchParams.get('active'), undefined);

  const where: Record<string, any> = { labId };

  if (STAFF_STATUSES.includes(status as any)) {
    where.status = status;
  }

  if (active !== undefined) {
    where.active = active;
  }

  const rows = await prisma.medReachLabStaff.findMany({
    where,
    orderBy: [{ active: 'desc' }, { role: 'asc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({
    ok: true,
    data: rows.map(projectStaff),
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
  { params }: { params: { labId: string } },
) {
  const who = readIdentity(req.headers);
  const labId = cleanString(params.labId);

  if (!labId) {
    return NextResponse.json({ ok: false, error: 'missing_labId' }, { status: 400 });
  }

  const allowed = await canManageStaff(req, labId, who);

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
  const role = cleanRole(body.role);
  const requestedStatus = cleanStatus(body.status, 'PENDING');

  if (!userId) {
    return NextResponse.json({ ok: false, error: 'missing_userId' }, { status: 400 });
  }

  const lab = await prisma.labPartner.findUnique({
    where: { id: labId },
    select: { id: true, active: true, status: true, canManageStaff: true },
  });

  if (!lab || !lab.active || lab.status !== 'ACTIVE') {
    return NextResponse.json({ ok: false, error: 'lab_not_active' }, { status: 400 });
  }

  if (!lab.canManageStaff && !['admin', 'system'].includes(roleOf(who))) {
    return NextResponse.json({ ok: false, error: 'staff_management_disabled' }, { status: 403 });
  }

  const status = ['ACTIVE', 'PENDING'].includes(requestedStatus) ? requestedStatus : 'PENDING';
  const active = status === 'ACTIVE';
  const now = new Date();

  const staff = await prisma.medReachLabStaff.upsert({
    where: {
      userId_labId: {
        userId,
        labId,
      },
    },
    create: {
      userId,
      labId,
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

  await emitStaffEvent('medreach_lab_staff_invited', labId, who, staff, {
    requestedStatus: status,
  });

  return NextResponse.json({
    ok: true,
    data: projectStaff(staff),
  });
}