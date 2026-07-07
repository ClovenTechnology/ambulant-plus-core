// apps/api-gateway/app/api/medreach/labs/[labId]/staff/[staffId]/route.ts
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

function cleanBoolean(value: unknown, fallback: boolean | undefined = undefined) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return fallback;
}

function roleOf(who: any) {
  return String(who.role || '').toLowerCase();
}

function cleanRole(value: unknown) {
  const role = cleanString(value).toUpperCase();

  return STAFF_ROLES.includes(role as any) ? role : null;
}

function cleanStatus(value: unknown) {
  const status = cleanString(value).toUpperCase();

  return STAFF_STATUSES.includes(status as any) ? status : null;
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

async function findStaff(labId: string, staffId: string) {
  return prisma.medReachLabStaff.findFirst({
    where: {
      labId,
      OR: [{ id: staffId }, { userId: staffId }],
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { labId: string; staffId: string } },
) {
  const who = readIdentity(req.headers);
  const labId = cleanString(params.labId);
  const staffId = cleanString(params.staffId);

  if (!labId) {
    return NextResponse.json({ ok: false, error: 'missing_labId' }, { status: 400 });
  }

  if (!staffId) {
    return NextResponse.json({ ok: false, error: 'missing_staffId' }, { status: 400 });
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

  const existing = await findStaff(labId, staffId);

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'staff_not_found' }, { status: 404 });
  }

  const data: Record<string, any> = {};
  const role = cleanRole(body.role);
  const status = cleanStatus(body.status);
  const active = cleanBoolean(body.active, undefined);

  if (role) data.role = role as any;

  if (status) {
    data.status = status as any;
    data.active = status === 'ACTIVE';

    if (status === 'ACTIVE') {
      data.approvedBy = who.uid;
      data.approvedAt = new Date();
    }

    if (status === 'REVOKED' || status === 'SUSPENDED' || status === 'REJECTED') {
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

  const updated = await prisma.medReachLabStaff.update({
    where: { id: existing.id },
    data,
  });

  await emitStaffEvent('medreach_lab_staff_updated', labId, who, updated, {
    changedFields: Object.keys(data),
  });

  return NextResponse.json({
    ok: true,
    data: projectStaff(updated),
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { labId: string; staffId: string } },
) {
  const who = readIdentity(req.headers);
  const labId = cleanString(params.labId);
  const staffId = cleanString(params.staffId);

  if (!labId) {
    return NextResponse.json({ ok: false, error: 'missing_labId' }, { status: 400 });
  }

  if (!staffId) {
    return NextResponse.json({ ok: false, error: 'missing_staffId' }, { status: 400 });
  }

  const allowed = await canManageStaff(req, labId, who);

  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const existing = await findStaff(labId, staffId);

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'staff_not_found' }, { status: 404 });
  }

  const updated = await prisma.medReachLabStaff.update({
    where: { id: existing.id },
    data: {
      active: false,
      status: 'REVOKED' as any,
    },
  });

  await emitStaffEvent('medreach_lab_staff_revoked', labId, who, updated);

  return NextResponse.json({
    ok: true,
    data: projectStaff(updated),
  });
}