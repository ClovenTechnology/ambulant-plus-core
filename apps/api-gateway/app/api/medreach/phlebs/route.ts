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


function agreementText(value: unknown, max = 512) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.slice(0, max);
}

function agreementBool(value: unknown) {
  if (value === true || value === 1) return true;
  const text = agreementText(value, 32).toLowerCase();

  return ['true', '1', 'yes', 'y', 'accepted', 'agree', 'agreed', 'signed'].includes(text);
}

function agreementObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function partnerAgreementSnapshot(body: any, partnerType: string) {
  const now = new Date().toISOString();
  const raw = agreementObject(
    body?.agreementSnapshot ||
      body?.agreement ||
      body?.agreementAcceptance ||
      body?.terms ||
      body?.termsAcceptance ||
      body?.contractAcceptance,
  );

  const accepted = agreementBool(
    body?.termsAccepted ??
      body?.acceptedTerms ??
      body?.agreementAccepted ??
      body?.contractAccepted ??
      body?.attestationAccepted ??
      raw.accepted ??
      raw.termsAccepted ??
      raw.agreementAccepted ??
      raw.contractAccepted,
  );

  const termsVersion =
    agreementText(body?.termsVersion || body?.agreementVersion || body?.contractVersion || raw.termsVersion || raw.agreementVersion || raw.contractVersion || raw.version, 80) ||
    'A5-PARTNER-TERMS-v1';

  const acceptedAt =
    agreementText(body?.termsAcceptedAt || body?.agreementAcceptedAt || body?.contractAcceptedAt || body?.acceptedAt || raw.acceptedAt, 80) ||
    (accepted ? now : null);

  const signedAt =
    agreementText(body?.signedAt || raw.signedAt, 80) ||
    (accepted ? now : null);

  return {
    source: 'partner_onboarding_application',
    partnerType,
    accepted,
    termsAccepted: accepted,
    agreementAccepted: accepted,
    contractAccepted: accepted,
    attestationAccepted: accepted,
    acceptedAt,
    termsAcceptedAt: acceptedAt,
    agreementAcceptedAt: acceptedAt,
    contractAcceptedAt: acceptedAt,
    termsVersion,
    agreementVersion: agreementText(body?.agreementVersion || raw.agreementVersion || termsVersion, 80) || termsVersion,
    contractVersion: agreementText(body?.contractVersion || raw.contractVersion || termsVersion, 80) || termsVersion,
    signedAt,
    signedBy:
      agreementText(body?.signedBy || body?.applicantName || body?.contactName || body?.ownerName || raw.signedBy || raw.name, 180) ||
      null,
    signature: agreementText(body?.signature || body?.signatureText || raw.signature, 240) || null,
    signatureHash: agreementText(body?.signatureHash || raw.signatureHash, 180) || null,
    consentIp: agreementText(body?.consentIp || raw.consentIp, 80) || null,
    userAgent: agreementText(body?.userAgent || raw.userAgent, 300) || null,
    capturedAt: now,
  };
}

function attachAgreementSnapshot(target: any, agreementSnapshot: Record<string, any>) {
  if (!target || typeof target !== 'object' || Array.isArray(target)) return target;

  target.agreementSnapshot = agreementSnapshot;
  target.termsAccepted = agreementSnapshot.accepted;
  target.termsAcceptedAt = agreementSnapshot.termsAcceptedAt;
  target.termsVersion = agreementSnapshot.termsVersion;
  target.agreementAccepted = agreementSnapshot.agreementAccepted;
  target.agreementAcceptedAt = agreementSnapshot.agreementAcceptedAt;
  target.agreementVersion = agreementSnapshot.agreementVersion;
  target.contractAccepted = agreementSnapshot.contractAccepted;
  target.contractAcceptedAt = agreementSnapshot.contractAcceptedAt;
  target.contractVersion = agreementSnapshot.contractVersion;

  return target;
}

function withAgreementSnapshot(value: unknown, agreementSnapshot: Record<string, any>) {
  const base = agreementObject(value);

  return attachAgreementSnapshot({ ...base }, agreementSnapshot);
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

  const agreementSnapshot = partnerAgreementSnapshot(body, 'medreach_phleb');
  const phlebProfileMeta = withAgreementSnapshot(body.profileMeta, agreementSnapshot);

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
      displayName: cleanString(body.displayName) || null,
      avatarUrl: cleanString(body.avatarUrl) || null,
      phone: cleanString(body.phone || body.contactPhone) || null,
      vehicleType: cleanString(body.vehicleType) || null,
      serviceAreaMeta: Array.isArray((body as any).serviceAreas)
        ? { serviceAreas: (body as any).serviceAreas }
        : undefined,
      profileMeta: phlebProfileMeta,
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
      displayName: cleanString(body.displayName) || undefined,
      avatarUrl: cleanString(body.avatarUrl) || undefined,
      phone: cleanString(body.phone || body.contactPhone) || undefined,
      vehicleType: cleanString(body.vehicleType) || undefined,
      serviceAreaMeta: Array.isArray((body as any).serviceAreas)
        ? { serviceAreas: (body as any).serviceAreas }
        : undefined,
      profileMeta: phlebProfileMeta,
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