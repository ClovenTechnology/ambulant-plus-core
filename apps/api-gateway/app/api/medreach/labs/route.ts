// apps/api-gateway/app/api/medreach/labs/route.ts
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

function cleanMoneyCents(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : fallback;
}

function cleanDecimalNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function roleOf(who: any) {
  return String(who.role || '').toLowerCase();
}

function canListLabs(role: string) {
  return ['admin', 'lab', 'lab_staff', 'clinician', 'patient', 'system'].includes(role);
}

function projectLab(lab: any) {
  return {
    id: lab.id,
    name: lab.name,
    displayName: lab.displayName ?? lab.name,
    contact: lab.contact ?? null,
    logoUrl: lab.logoUrl ?? null,
    website: lab.website ?? null,
    operationalPhone: lab.operationalPhone ?? null,
    operationalEmail: lab.operationalEmail ?? null,
    addressLine1: lab.addressLine1 ?? null,
    addressLine2: lab.addressLine2 ?? null,
    city: lab.city ?? null,
    province: lab.province ?? null,
    postalCode: lab.postalCode ?? null,
    profileMeta: lab.profileMeta ?? null,
    active: lab.active,
    status: lab.status,
    onboardingStatus: lab.onboardingStatus ?? null,
    country: lab.country,
    currency: lab.currency,
    billingCycle: lab.billingCycle,
    canManageStaff: lab.canManageStaff,
    canPublishResults: lab.canPublishResults,
    commissionKind: lab.commissionKind,
    commissionValue: Number(lab.commissionValue ?? 0),
    monthlyAccessFeeCents: lab.monthlyAccessFeeCents,
    ownerUserId: lab.ownerUserId ?? null,
    payoutAccountMasked: lab.payoutAccountMasked ?? null,
    approvedAt: lab.approvedAt?.toISOString?.() ?? null,
    rejectedAt: lab.rejectedAt?.toISOString?.() ?? null,
    rejectionReason: lab.rejectionReason ?? null,
    createdAt: lab.createdAt?.toISOString?.() ?? null,
    updatedAt: lab.updatedAt?.toISOString?.() ?? null,
    counts: {
      offeredTests: lab._count?.offeredTests ?? 0,
      panels: lab._count?.panels ?? 0,
      staffMembers: lab._count?.staffMembers ?? 0,
      eligibleOrders: lab._count?.eligibleOrders ?? 0,
    },
  };
}

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);
  const role = roleOf(who);

  if (!canListLabs(role)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = cleanString(url.searchParams.get('q'));
  const country = cleanString(url.searchParams.get('country'));
  const currency = cleanString(url.searchParams.get('currency'));
  const status = cleanString(url.searchParams.get('status'));
  const active = cleanBoolean(url.searchParams.get('active'), role === 'admin' ? undefined : true);
  const limit = cleanInt(url.searchParams.get('limit'), 50, 1, 200);

  const where: Record<string, any> = {};

  if (active !== undefined) where.active = active;
  if (country) where.country = country.toUpperCase();
  if (currency) where.currency = currency.toUpperCase();

  if (status) {
    where.status = status.toUpperCase() as any;
  } else if (role !== 'admin') {
    where.status = 'ACTIVE' as any;
  }

  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { contact: { contains: q, mode: 'insensitive' } },
    ];
  }

  if (role === 'lab') {
    const headerLabId = cleanString(req.headers.get('x-lab-id'));
    if (headerLabId) where.id = headerLabId;
  }

  if (role === 'lab_staff') {
    const headerLabId = cleanString(req.headers.get('x-staff-lab-id'));
    if (!headerLabId || !who.uid) {
      return NextResponse.json({ ok: false, error: 'missing_staff_lab_id' }, { status: 400 });
    }

    const staff = await prisma.medReachLabStaff.findFirst({
      where: {
        userId: who.uid,
        labId: headerLabId,
        active: true,
        status: 'ACTIVE',
      },
      select: { labId: true },
    });

    if (!staff) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    where.id = staff.labId;
  }

  const labs = await prisma.labPartner.findMany({
    where,
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    take: limit,
    include: {
      _count: {
        select: {
          offeredTests: true,
          panels: true,
          staffMembers: true,
          eligibleOrders: true,
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    data: labs.map(projectLab),
    meta: {
      count: labs.length,
      role,
    },
  });
}

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  const role = roleOf(who);

  if (role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const name = cleanString(body.name);
  const contact = cleanString(body.contact);
  const country = cleanString(body.country) || 'ZA';
  const currency = cleanString(body.currency) || 'ZAR';

  if (!name) {
    return NextResponse.json({ ok: false, error: 'missing_name' }, { status: 400 });
  }

  const lab = await prisma.labPartner.create({
    data: {
      name,
      contact: contact || null,
      active: cleanBoolean(body.active, true) ?? true,
      status: (cleanString(body.status) || 'ACTIVE') as any,
      onboardingStatus: cleanString(body.onboardingStatus) || null,
      ownerUserId: cleanString(body.ownerUserId) || null,
      country: country.toUpperCase().slice(0, 2),
      currency: currency.toUpperCase().slice(0, 3),
      canManageStaff: cleanBoolean(body.canManageStaff, true) ?? true,
      canPublishResults: cleanBoolean(body.canPublishResults, true) ?? true,
      monthlyAccessFeeCents: cleanMoneyCents(body.monthlyAccessFeeCents, 0),
      commissionKind: (cleanString(body.commissionKind) || 'PERCENT') as any,
      commissionValue: cleanDecimalNumber(body.commissionValue, 0),
      payoutAccountMasked: cleanString(body.payoutAccountMasked) || null,
      approvedAt: cleanBoolean(body.approveNow, true) ? new Date() : null,
      approvedByUserId: cleanBoolean(body.approveNow, true) ? who.uid : null,
    },
  });

  await prisma.auditEvent.create({
    data: {
      kind: 'medreach_lab_created',
      actorId: who.uid,
      actorRole: who.role,
      subjectId: lab.id,
      meta: {
        labId: lab.id,
        name: lab.name,
        status: lab.status,
      },
    },
  });

  emitEvent({
    kind: 'medreach_lab_created',
    payload: {
      labId: lab.id,
      name: lab.name,
      status: lab.status,
    },
    targets: {
      admin: true,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      data: projectLab({ ...lab, _count: {} }),
    },
    { status: 201 },
  );
}