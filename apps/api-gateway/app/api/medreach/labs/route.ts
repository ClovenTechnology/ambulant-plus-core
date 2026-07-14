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
      { displayName: { contains: q, mode: 'insensitive' } },
      { contact: { contains: q, mode: 'insensitive' } },
      { website: { contains: q, mode: 'insensitive' } },
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
  const agreementSnapshot = partnerAgreementSnapshot(body, 'medreach_lab');
  const labProfileMeta = withAgreementSnapshot(body.profileMeta, agreementSnapshot);

  if (!name) {
    return NextResponse.json({ ok: false, error: 'missing_name' }, { status: 400 });
  }

  const lab = await prisma.labPartner.create({
    data: {
      name,
      displayName: cleanString(body.displayName) || name,
      contact: contact || null,
      logoUrl: cleanString(body.logoUrl) || null,
      website: cleanString(body.website) || null,
      operationalPhone: cleanString(body.operationalPhone) || null,
      operationalEmail: cleanString(body.operationalEmail) || null,
      addressLine1: cleanString(body.addressLine1) || null,
      addressLine2: cleanString(body.addressLine2) || null,
      city: cleanString(body.city) || null,
      province: cleanString(body.province) || null,
      postalCode: cleanString(body.postalCode) || null,
      profileMeta: labProfileMeta,
      verifiedIdentityMeta:
        body.verifiedIdentityMeta &&
        typeof body.verifiedIdentityMeta === 'object' &&
        !Array.isArray(body.verifiedIdentityMeta)
          ? (body.verifiedIdentityMeta as any)
          : undefined,
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