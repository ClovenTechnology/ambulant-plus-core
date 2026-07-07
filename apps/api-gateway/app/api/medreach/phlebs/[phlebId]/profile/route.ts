// apps/api-gateway/app/api/medreach/phlebs/[phlebId]/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { emitEvent } from '@/src/lib/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanBoolean(value: unknown, fallback: boolean | undefined = undefined) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return fallback;
}

function cleanDecimalNumber(value: unknown, fallback = 0) {
  const n = Number(value);

  return Number.isFinite(n) ? n : fallback;
}

function roleOf(who: any) {
  return String(who.role || '').toLowerCase();
}

function projectPhleb(row: any, options: { includeVerifiedIdentity?: boolean } = {}) {
  const data: Record<string, any> = {
    id: row.id,
    userId: row.userId,
    displayName: row.displayName ?? null,
    avatarUrl: row.avatarUrl ?? null,
    phone: row.phone ?? null,
    contactPhone: row.phone ?? null,
    vehicleType: row.vehicleType ?? null,
    serviceAreaMeta: row.serviceAreaMeta ?? null,
    profileMeta: row.profileMeta ?? null,

    active: row.active,
    approvalStatus: row.approvalStatus,

    country: row.country,
    currency: row.currency,

    payoutAccountMasked: row.payoutAccountMasked ?? null,

    commissionKind: row.commissionKind,
    commissionValue: Number(row.commissionValue ?? 0),

    defaultLabId: row.defaultLabId ?? null,
    defaultLab: row.defaultLab
      ? {
          id: row.defaultLab.id,
          name: row.defaultLab.name,
          displayName: row.defaultLab.displayName ?? row.defaultLab.name,
          logoUrl: row.defaultLab.logoUrl ?? null,
          active: row.defaultLab.active,
          status: row.defaultLab.status,
          country: row.defaultLab.country,
          currency: row.defaultLab.currency,
        }
      : null,

    ratingAvg: row.ratingAvg == null ? null : Number(row.ratingAvg),
    ratingCount: row.ratingCount,
    completedJobsCount: row.completedJobsCount,
    cancelledJobsCount: row.cancelledJobsCount,

    approvedByUserId: row.approvedByUserId ?? null,
    approvedAt: row.approvedAt?.toISOString?.() ?? null,
    rejectedByUserId: row.rejectedByUserId ?? null,
    rejectedAt: row.rejectedAt?.toISOString?.() ?? null,
    rejectionReason: row.rejectionReason ?? null,

    createdAt: row.createdAt?.toISOString?.() ?? null,
    updatedAt: row.updatedAt?.toISOString?.() ?? null,
  };

  if (options.includeVerifiedIdentity) {
    data.verifiedIdentityMeta = row.verifiedIdentityMeta ?? null;
  }

  return data;
}

async function findPhleb(phlebId: string) {
  return prisma.medReachPhlebProfile.findFirst({
    where: {
      OR: [{ id: phlebId }, { userId: phlebId }],
    },
    include: {
      defaultLab: true,
    },
  });
}

async function canReadProfile(req: NextRequest, phleb: any, who: any) {
  const role = roleOf(who);

  if (['admin', 'system', 'clinician'].includes(role)) return true;

  if (role === 'phleb') {
    return Boolean(who.uid && phleb.userId === who.uid);
  }

  if (role === 'lab') {
    const labId = cleanString(req.headers.get('x-lab-id'));

    if (!labId) return false;
    if (phleb.defaultLabId === labId) return true;

    const lab = await prisma.labPartner.findUnique({
      where: { id: labId },
      select: { ownerUserId: true, active: true },
    });

    return Boolean(lab?.active && lab.ownerUserId && who.uid && lab.ownerUserId === who.uid);
  }

  if (role === 'lab_staff') {
    const labId = cleanString(req.headers.get('x-staff-lab-id'));

    if (!labId || !who.uid) return false;
    if (phleb.defaultLabId !== labId) return false;

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

function canWriteProfile(phleb: any, who: any) {
  const role = roleOf(who);

  if (['admin', 'system'].includes(role)) return true;

  if (role === 'phleb') {
    return Boolean(who.uid && phleb.userId === who.uid);
  }

  return false;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { phlebId: string } },
) {
  const who = readIdentity(req.headers);
  const phlebId = cleanString(params.phlebId);

  if (!phlebId) {
    return NextResponse.json({ ok: false, error: 'missing_phlebId' }, { status: 400 });
  }

  const phleb = await findPhleb(phlebId);

  if (!phleb) {
    return NextResponse.json({ ok: false, error: 'phleb_not_found' }, { status: 404 });
  }

  const allowed = await canReadProfile(req, phleb, who);

  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    data: projectPhleb(phleb),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { phlebId: string } },
) {
  const who = readIdentity(req.headers);
  const role = roleOf(who);
  const phlebId = cleanString(params.phlebId);

  if (!phlebId) {
    return NextResponse.json({ ok: false, error: 'missing_phlebId' }, { status: 400 });
  }

  const existing = await findPhleb(phlebId);

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'phleb_not_found' }, { status: 404 });
  }

  if (!canWriteProfile(existing, who)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const admin = ['admin', 'system'].includes(role);
  const data: Record<string, any> = {};

  if ('country' in body) {
    data.country = cleanString(body.country).toUpperCase().slice(0, 2) || existing.country;
  }

  if ('currency' in body) {
    data.currency = cleanString(body.currency).toUpperCase().slice(0, 3) || existing.currency;
  }

  if ('payoutAccountMasked' in body) {
    data.payoutAccountMasked = cleanString(body.payoutAccountMasked) || null;
  }

  if ('defaultLabId' in body) {
    const defaultLabId = cleanString(body.defaultLabId) || null;

    if (defaultLabId) {
      const lab = await prisma.labPartner.findUnique({
        where: { id: defaultLabId },
        select: { id: true, active: true, status: true },
      });

      if (!lab || !lab.active || lab.status !== 'ACTIVE') {
        return NextResponse.json(
          { ok: false, error: 'default_lab_not_found_or_inactive' },
          { status: 400 },
        );
      }
    }

    data.defaultLabId = defaultLabId;
  }

  if (admin && 'active' in body) {
    data.active = cleanBoolean(body.active, existing.active);
  }

  if (admin && ('approvalStatus' in body || 'status' in body)) {
    const approvalStatus = cleanString(body.approvalStatus || body.status).toUpperCase();

    if (!approvalStatus) {
      return NextResponse.json({ ok: false, error: 'missing_approval_status' }, { status: 400 });
    }

    data.approvalStatus = approvalStatus as any;

    if (approvalStatus === 'ACTIVE') {
      data.active = true;
      data.approvedAt = new Date();
      data.approvedByUserId = who.uid;
      data.rejectedAt = null;
      data.rejectedByUserId = null;
      data.rejectionReason = null;
    }

    if (approvalStatus === 'REJECTED') {
      data.active = false;
      data.rejectedAt = new Date();
      data.rejectedByUserId = who.uid;
      data.rejectionReason = cleanString(body.rejectionReason) || existing.rejectionReason || 'Rejected';
    }
  }

  if (admin && 'commissionKind' in body) {
    data.commissionKind = cleanString(body.commissionKind).toUpperCase() as any;
  }

  if (admin && 'commissionValue' in body) {
    data.commissionValue = cleanDecimalNumber(body.commissionValue, 0);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_changes' }, { status: 400 });
  }

  const row = await prisma.medReachPhlebProfile.update({
    where: { id: existing.id },
    data,
    include: {
      defaultLab: true,
    },
  });

  await prisma.auditEvent.create({
    data: {
      kind: 'medreach_phleb_profile_updated',
      actorId: who.uid,
      actorRole: who.role,
      subjectId: row.id,
      meta: {
        phlebProfileId: row.id,
        userId: row.userId,
        changedFields: Object.keys(data),
      },
    },
  });

  emitEvent({
    kind: 'medreach_phleb_profile_updated',
    payload: {
      phlebProfileId: row.id,
      userId: row.userId,
      changedFields: Object.keys(data),
    },
    targets: { admin: true },
  });

  return NextResponse.json({
    ok: true,
    data: projectPhleb(row, {
      includeVerifiedIdentity: ['admin', 'system', 'phleb'].includes(role),
    }),
  });
}