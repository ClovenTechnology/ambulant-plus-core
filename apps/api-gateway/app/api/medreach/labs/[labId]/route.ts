// apps/api-gateway/app/api/medreach/labs/[labId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { emitEvent } from '@/src/lib/events';
import { push, sseKeys } from '@/src/lib/sse';

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

function projectLab(lab: any, options: { includeVerifiedIdentity?: boolean } = {}) {
  const data: Record<string, any> = {
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
      specimenBundles: lab._count?.specimenBundles ?? 0,
    },
  };

  if (options.includeVerifiedIdentity) {
    data.verifiedIdentityMeta = lab.verifiedIdentityMeta ?? null;
  }

  return data;
}

async function assertLabReadAccess(req: NextRequest, labId: string, who: any) {
  const role = roleOf(who);

  if (['admin', 'clinician', 'patient', 'system'].includes(role)) {
    return true;
  }

  if (role === 'lab') {
    const headerLabId = cleanString(req.headers.get('x-lab-id'));
    if (!headerLabId || headerLabId !== labId) return false;

    const lab = await prisma.labPartner.findUnique({
      where: { id: labId },
      select: { id: true, active: true, status: true, ownerUserId: true },
    });

    if (!lab || !lab.active) return false;
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

async function assertLabWriteAccess(req: NextRequest, labId: string, who: any) {
  const role = roleOf(who);

  if (role === 'admin') return true;

  if (role === 'lab') {
    const headerLabId = cleanString(req.headers.get('x-lab-id'));
    if (!headerLabId || headerLabId !== labId) return false;

    const lab = await prisma.labPartner.findUnique({
      where: { id: labId },
      select: { id: true, active: true, status: true, ownerUserId: true },
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
        role: { in: ['OWNER', 'ADMIN', 'MANAGER'] as any },
      },
      select: { labId: true },
    });

    return staff?.labId === labId;
  }

  return false;
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

  const allowed = await assertLabReadAccess(req, labId, who);

  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const lab = await prisma.labPartner.findUnique({
    where: { id: labId },
    include: {
      _count: {
        select: {
          offeredTests: true,
          panels: true,
          staffMembers: true,
          eligibleOrders: true,
          specimenBundles: true,
        },
      },
    },
  });

  if (!lab) {
    return NextResponse.json({ ok: false, error: 'lab_not_found' }, { status: 404 });
  }

  const role = roleOf(who);

  if (!lab.active && role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'lab_not_found' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    data: projectLab(lab, {
      includeVerifiedIdentity: ['admin', 'system', 'lab', 'lab_staff'].includes(role),
    }),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { labId: string } },
) {
  const who = readIdentity(req.headers);
  const labId = cleanString(params.labId);

  if (!labId) {
    return NextResponse.json({ ok: false, error: 'missing_labId' }, { status: 400 });
  }

  const allowed = await assertLabWriteAccess(req, labId, who);

  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const role = roleOf(who);
  const admin = role === 'admin' || role === 'system';

  const data: Record<string, any> = {};

  const protectedFields = [
    'name',
    'active',
    'status',
    'onboardingStatus',
    'ownerUserId',
    'country',
    'currency',
    'canManageStaff',
    'canPublishResults',
    'monthlyAccessFeeCents',
    'commissionKind',
    'commissionValue',
    'approvedAt',
    'approvedByUserId',
    'rejectedAt',
    'rejectedByUserId',
    'rejectionReason',
    'approveNow',
    'verifiedIdentityMeta',
  ];

  if (!admin && protectedFields.some((field) => field in body)) {
    return NextResponse.json(
      { ok: false, error: 'locked_lab_identity_or_admin_field' },
      { status: 403 },
    );
  }

  if ('name' in body && admin) data.name = cleanString(body.name);
  if ('contact' in body) data.contact = cleanString(body.contact) || null;
  if ('active' in body && admin) data.active = cleanBoolean(body.active, true);
  if ('status' in body && admin) data.status = cleanString(body.status).toUpperCase() as any;
  if ('onboardingStatus' in body && admin) {
    data.onboardingStatus = cleanString(body.onboardingStatus) || null;
  }
  if ('ownerUserId' in body && admin) {
    data.ownerUserId = cleanString(body.ownerUserId) || null;
  }
  if ('country' in body && admin) data.country = cleanString(body.country).toUpperCase().slice(0, 2) || 'ZA';
  if ('currency' in body && admin) data.currency = cleanString(body.currency).toUpperCase().slice(0, 3) || 'ZAR';
  if ('canManageStaff' in body && admin) {
    data.canManageStaff = cleanBoolean(body.canManageStaff, true);
  }
  if ('canPublishResults' in body && admin) {
    data.canPublishResults = cleanBoolean(body.canPublishResults, true);
  }
  if ('monthlyAccessFeeCents' in body && admin) {
    data.monthlyAccessFeeCents = cleanMoneyCents(body.monthlyAccessFeeCents, 0);
  }
  if ('commissionKind' in body && admin) {
    data.commissionKind = cleanString(body.commissionKind).toUpperCase() as any;
  }
  if ('commissionValue' in body && admin) {
    data.commissionValue = cleanDecimalNumber(body.commissionValue, 0);
  }
  if ('payoutAccountMasked' in body) {
    data.payoutAccountMasked = cleanString(body.payoutAccountMasked) || null;
  }

  if ('approveNow' in body && admin && cleanBoolean(body.approveNow, false)) {
    data.status = 'ACTIVE' as any;
    data.active = true;
    data.approvedAt = new Date();
    data.approvedByUserId = who.uid;
    data.rejectedAt = null;
    data.rejectedByUserId = null;
    data.rejectionReason = null;
  }

  if ('rejectionReason' in body && admin) {
    const reason = cleanString(body.rejectionReason);
    if (reason) {
      data.status = 'REJECTED' as any;
      data.active = false;
      data.rejectedAt = new Date();
      data.rejectedByUserId = who.uid;
      data.rejectionReason = reason;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_changes' }, { status: 400 });
  }

  if ('name' in data && !data.name) {
    return NextResponse.json({ ok: false, error: 'missing_name' }, { status: 400 });
  }

  const lab = await prisma.labPartner.update({
    where: { id: labId },
    data,
    include: {
      _count: {
        select: {
          offeredTests: true,
          panels: true,
          staffMembers: true,
          eligibleOrders: true,
          specimenBundles: true,
        },
      },
    },
  });

  await prisma.auditEvent.create({
    data: {
      kind: 'medreach_lab_updated',
      actorId: who.uid,
      actorRole: who.role,
      subjectId: labId,
      meta: {
        labId,
        changedFields: Object.keys(data),
      },
    },
  });

  const evt = {
    kind: 'medreach_lab_updated',
    labId,
    changedFields: Object.keys(data),
    at: new Date().toISOString(),
  };

  emitEvent({
    kind: 'medreach_lab_updated',
    payload: evt,
    targets: { admin: true },
  });

  await push(sseKeys.lab(labId), evt);

  return NextResponse.json({
    ok: true,
    data: projectLab(lab, {
      includeVerifiedIdentity: ['admin', 'system', 'lab', 'lab_staff'].includes(role),
    }),
  });
}
