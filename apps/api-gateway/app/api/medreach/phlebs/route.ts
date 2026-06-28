// apps/api-gateway/app/api/medreach/phlebs/route.ts
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

function cleanInt(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);

  if (!Number.isFinite(n)) return fallback;

  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function cleanDecimalNumber(value: unknown, fallback = 0) {
  const n = Number(value);

  return Number.isFinite(n) ? n : fallback;
}

function roleOf(who: any) {
  return String(who.role || '').toLowerCase();
}

function canListPhlebs(role: string) {
  return ['admin', 'lab', 'lab_staff', 'clinician', 'system'].includes(role);
}

function canCreatePhleb(role: string) {
  return ['admin', 'system', 'phleb'].includes(role);
}

function projectPhleb(row: any) {
  return {
    id: row.id,
    userId: row.userId,

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
}

async function assertLabCanSeePhlebs(req: NextRequest, who: any) {
  const role = roleOf(who);

  if (['admin', 'clinician', 'system'].includes(role)) return { ok: true, labId: null };

  if (role === 'lab') {
    const labId = cleanString(req.headers.get('x-lab-id'));

    if (!labId) return { ok: false, labId: null };

    const lab = await prisma.labPartner.findUnique({
      where: { id: labId },
      select: {
        id: true,
        active: true,
        status: true,
        ownerUserId: true,
      },
    });

    if (!lab || !lab.active) return { ok: false, labId: null };
    if (lab.ownerUserId && who.uid && lab.ownerUserId !== who.uid) {
      return { ok: false, labId: null };
    }

    return { ok: true, labId };
  }

  if (role === 'lab_staff') {
    const labId = cleanString(req.headers.get('x-staff-lab-id'));

    if (!labId || !who.uid) return { ok: false, labId: null };

    const staff = await prisma.medReachLabStaff.findFirst({
      where: {
        userId: who.uid,
        labId,
        active: true,
        status: 'ACTIVE',
      },
      select: { labId: true },
    });

    return { ok: staff?.labId === labId, labId: staff?.labId ?? null };
  }

  return { ok: false, labId: null };
}

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);
  const role = roleOf(who);

  if (!canListPhlebs(role)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const labScope = await assertLabCanSeePhlebs(req, who);

  if (!labScope.ok) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);

  const q = cleanString(url.searchParams.get('q'));
  const country = cleanString(url.searchParams.get('country'));
  const currency = cleanString(url.searchParams.get('currency'));
  const approvalStatus = cleanString(url.searchParams.get('approvalStatus') || url.searchParams.get('status'));
  const defaultLabId = cleanString(url.searchParams.get('defaultLabId') || labScope.labId);
  const active = cleanBoolean(url.searchParams.get('active'), role === 'admin' ? undefined : true);
  const limit = cleanInt(url.searchParams.get('limit'), 100, 1, 300);

  const where: Record<string, any> = {};

  if (active !== undefined) where.active = active;
  if (country) where.country = country.toUpperCase().slice(0, 2);
  if (currency) where.currency = currency.toUpperCase().slice(0, 3);
  if (approvalStatus) where.approvalStatus = approvalStatus.toUpperCase();
  if (defaultLabId) where.defaultLabId = defaultLabId;

  if (q) {
    where.OR = [
      { id: { contains: q, mode: 'insensitive' } },
      { userId: { contains: q, mode: 'insensitive' } },
      { payoutAccountMasked: { contains: q, mode: 'insensitive' } },
    ];
  }

  const rows = await prisma.medReachPhlebProfile.findMany({
    where,
    orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    include: {
      defaultLab: true,
    },
  });

  return NextResponse.json({
    ok: true,
    data: rows.map(projectPhleb),
    meta: {
      count: rows.length,
      role,
      labScope: labScope.labId,
    },
  });
}

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  const role = roleOf(who);

  if (!canCreatePhleb(role)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const userId = cleanString(body.userId || body.phlebId || who.uid);

  if (!userId) {
    return NextResponse.json({ ok: false, error: 'missing_userId' }, { status: 400 });
  }

  if (role === 'phleb' && who.uid && userId !== who.uid) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const requestedApproval = cleanString(body.approvalStatus || body.status).toUpperCase();
  const approvalStatus =
    role === 'admin' || role === 'system'
      ? requestedApproval || 'ACTIVE'
      : 'PENDING';

  const active =
    role === 'admin' || role === 'system'
      ? cleanBoolean(body.active, true) ?? true
      : true;

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

  const row = await prisma.medReachPhlebProfile.upsert({
    where: { userId },
    create: {
      userId,
      active,
      approvalStatus: approvalStatus as any,
      country: cleanString(body.country).toUpperCase().slice(0, 2) || 'ZA',
      currency: cleanString(body.currency).toUpperCase().slice(0, 3) || 'ZAR',
      payoutAccountMasked: cleanString(body.payoutAccountMasked) || null,
      commissionKind: (cleanString(body.commissionKind).toUpperCase() || 'PERCENT') as any,
      commissionValue: cleanDecimalNumber(body.commissionValue, 0),
      defaultLabId,
      approvedAt:
        approvalStatus === 'ACTIVE' && (role === 'admin' || role === 'system')
          ? new Date()
          : null,
      approvedByUserId:
        approvalStatus === 'ACTIVE' && (role === 'admin' || role === 'system')
          ? who.uid
          : null,
    },
    update: {
      active,
      approvalStatus: approvalStatus as any,
      country: cleanString(body.country).toUpperCase().slice(0, 2) || 'ZA',
      currency: cleanString(body.currency).toUpperCase().slice(0, 3) || 'ZAR',
      payoutAccountMasked: cleanString(body.payoutAccountMasked) || null,
      commissionKind: (cleanString(body.commissionKind).toUpperCase() || 'PERCENT') as any,
      commissionValue: cleanDecimalNumber(body.commissionValue, 0),
      defaultLabId,
      approvedAt:
        approvalStatus === 'ACTIVE' && (role === 'admin' || role === 'system')
          ? new Date()
          : undefined,
      approvedByUserId:
        approvalStatus === 'ACTIVE' && (role === 'admin' || role === 'system')
          ? who.uid
          : undefined,
    },
    include: {
      defaultLab: true,
    },
  });

  await prisma.auditEvent.create({
    data: {
      kind: 'medreach_phleb_profile_upserted',
      actorId: who.uid,
      actorRole: who.role,
      subjectId: row.id,
      meta: {
        phlebProfileId: row.id,
        userId: row.userId,
        approvalStatus: row.approvalStatus,
        defaultLabId: row.defaultLabId,
      },
    },
  });

  emitEvent({
    kind: 'medreach_phleb_profile_upserted',
    payload: {
      phlebProfileId: row.id,
      userId: row.userId,
      approvalStatus: row.approvalStatus,
      defaultLabId: row.defaultLabId,
    },
    targets: { admin: true },
  });

  return NextResponse.json(
    {
      ok: true,
      data: projectPhleb(row),
    },
    { status: 201 },
  );
}