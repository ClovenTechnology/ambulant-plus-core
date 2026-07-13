import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const POLICY_KEY = 'medreach.commercial_policy';

type FeeStatus = 'INHERIT_DEFAULT' | 'PENDING_ADMIN_APPROVAL' | 'ACTIVE' | 'REJECTED';

type MedReachCommercialPolicy = {
  currency: string;
  phlebCalloutFeeCents: number;
  phlebPerKmFeeCents: number;
  phlebUrgentDrawSurchargeCents: number;
  allowPhlebSelfSetCalloutFee: boolean;
  requireAdminApprovalForFeeChanges: boolean;
};

const DEFAULT_POLICY: MedReachCommercialPolicy = {
  currency: 'ZAR',
  phlebCalloutFeeCents: 0,
  phlebPerKmFeeCents: 0,
  phlebUrgentDrawSurchargeCents: 0,
  allowPhlebSelfSetCalloutFee: false,
  requireAdminApprovalForFeeChanges: true,
};

function cleanString(value: unknown, max = 256) {
  return String(value || '').trim().slice(0, max);
}

function cleanStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanString(item, 120)).filter(Boolean);
}

function asObject(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, any>;
}

function asInt(value: unknown, fallback = 0, min = 0, max = 100_000_000) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function asBool(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value;

  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(v)) return true;
    if (['false', '0', 'no', 'off'].includes(v)) return false;
  }

  return fallback;
}

function roleOf(req: NextRequest) {
  return cleanString(req.headers.get('x-user-role') || req.headers.get('x-role') || 'phleb', 64).toLowerCase();
}

function whoFromRequest(req: NextRequest) {
  return {
    role: roleOf(req),
    uid: cleanString(req.headers.get('x-user-id') || req.headers.get('x-uid') || '', 128) || null,
  };
}

function orgIdFromHeaders(headers: Headers) {
  return (
    cleanString(headers.get('x-org-id') || headers.get('x-tenant-id') || headers.get('x-organization-id') || 'org-default', 128) ||
    'org-default'
  );
}

function isAdminRole(role: string) {
  return ['admin', 'admin_staff', 'system'].includes(role);
}

function settingsDelegate() {
  const db: any = prisma;

  return (
    db.medReachOperationalSetting ||
    db.medReachSetting ||
    db.medreachSetting ||
    db.carePortOperationalSetting ||
    db.carePortSetting ||
    db.careportSetting ||
    null
  );
}

function normalizePolicy(input: any): MedReachCommercialPolicy {
  const raw = input || {};

  return {
    currency: cleanString(raw.currency, 3).toUpperCase() || DEFAULT_POLICY.currency,
    phlebCalloutFeeCents: asInt(raw.phlebCalloutFeeCents, DEFAULT_POLICY.phlebCalloutFeeCents),
    phlebPerKmFeeCents: asInt(raw.phlebPerKmFeeCents, DEFAULT_POLICY.phlebPerKmFeeCents),
    phlebUrgentDrawSurchargeCents: asInt(
      raw.phlebUrgentDrawSurchargeCents,
      DEFAULT_POLICY.phlebUrgentDrawSurchargeCents,
    ),
    allowPhlebSelfSetCalloutFee: asBool(
      raw.allowPhlebSelfSetCalloutFee,
      DEFAULT_POLICY.allowPhlebSelfSetCalloutFee,
    ),
    requireAdminApprovalForFeeChanges: asBool(
      raw.requireAdminApprovalForFeeChanges,
      DEFAULT_POLICY.requireAdminApprovalForFeeChanges,
    ),
  };
}

async function loadCommercialPolicy(req: NextRequest) {
  const orgId = orgIdFromHeaders(req.headers);
  const delegate = settingsDelegate();

  if (!delegate?.findUnique && !delegate?.findFirst) {
    return {
      orgId,
      policy: DEFAULT_POLICY,
      source: 'defaults',
      persistence: 'missing_model',
    };
  }

  const row = delegate.findUnique
    ? await delegate.findUnique({ where: { orgId_key: { orgId, key: POLICY_KEY } } }).catch(() => null)
    : await delegate.findFirst({ where: { orgId, key: POLICY_KEY }, orderBy: { updatedAt: 'desc' } }).catch(() => null);

  return {
    orgId,
    policy: normalizePolicy(row?.value || DEFAULT_POLICY),
    source: row?.value ? 'database' : 'defaults',
    persistence: 'available',
  };
}

async function findPhleb(phlebId: string) {
  return prisma.medReachPhlebProfile.findFirst({
    where: {
      OR: [{ id: phlebId }, { userId: phlebId }],
    },
  });
}

async function canAccessPreferences(req: NextRequest, phleb: any, who: { role: string; uid: string | null }) {
  if (isAdminRole(who.role)) return true;

  if (who.role === 'phleb') {
    return Boolean(who.uid && phleb.userId === who.uid);
  }

  const labId = cleanString(req.headers.get('x-lab-id') || req.headers.get('x-staff-lab-id'), 128);

  if (who.role === 'lab') {
    if (!labId || phleb.defaultLabId !== labId) return false;

    const lab = await prisma.labPartner.findUnique({
      where: { id: labId },
      select: { active: true, status: true, ownerUserId: true },
    });

    return Boolean(lab?.active && lab.status === 'ACTIVE');
  }

  if (who.role === 'lab_staff') {
    if (!labId || !who.uid || phleb.defaultLabId !== labId) return false;

    const staff = await prisma.medReachLabStaff.findFirst({
      where: {
        labId,
        userId: who.uid,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    return Boolean(staff?.id);
  }

  return false;
}

function normalizeVehicleMeta(input: unknown, existing: Record<string, any>, admin: boolean) {
  const body = asObject(input);

  if (!Object.keys(body).length) return existing;

  return {
    ...existing,
    vehicleType: cleanString(body.vehicleType ?? body.type ?? existing.vehicleType, 80) || null,
    registration: cleanString(body.registration ?? body.registrationNumber ?? existing.registration, 80) || null,
    make: cleanString(body.make ?? existing.make, 80) || null,
    model: cleanString(body.model ?? existing.model, 80) || null,
    coldChainCapable:
      body.coldChainCapable == null ? Boolean(existing.coldChainCapable) : asBool(body.coldChainCapable, false),
    changePending: admin ? false : true,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeFeeStatus(value: unknown): FeeStatus | null {
  const status = cleanString(value, 80).toUpperCase();

  if (
    status === 'INHERIT_DEFAULT' ||
    status === 'PENDING_ADMIN_APPROVAL' ||
    status === 'ACTIVE' ||
    status === 'REJECTED'
  ) {
    return status;
  }

  return null;
}

function extractFeeInput(body: Record<string, any>) {
  const nested = asObject(body.feeProposal || body.feeSchedule || body.feeGovernance);

  const hasFeeInput =
    'phlebCalloutFeeCents' in body ||
    'calloutFeeCents' in body ||
    'phlebPerKmFeeCents' in body ||
    'perKmFeeCents' in body ||
    'phlebUrgentDrawSurchargeCents' in body ||
    'urgentDrawSurchargeCents' in body ||
    'feeProposal' in body ||
    'feeSchedule' in body ||
    'feeGovernance' in body ||
    'feeStatus' in body ||
    'status' in nested;

  if (!hasFeeInput) return null;

  return {
    phlebCalloutFeeCents: asInt(
      body.phlebCalloutFeeCents ?? body.calloutFeeCents ?? nested.phlebCalloutFeeCents ?? nested.calloutFeeCents,
      0,
    ),
    phlebPerKmFeeCents: asInt(
      body.phlebPerKmFeeCents ?? body.perKmFeeCents ?? nested.phlebPerKmFeeCents ?? nested.perKmFeeCents,
      0,
    ),
    phlebUrgentDrawSurchargeCents: asInt(
      body.phlebUrgentDrawSurchargeCents ??
        body.urgentDrawSurchargeCents ??
        nested.phlebUrgentDrawSurchargeCents ??
        nested.urgentDrawSurchargeCents,
      0,
    ),
    currency: cleanString(body.currency ?? nested.currency ?? '', 3).toUpperCase() || undefined,
    note: cleanString(body.feeNote ?? body.note ?? nested.note ?? nested.reason ?? '', 500) || null,
    requestedStatus: normalizeFeeStatus(body.feeStatus ?? nested.status),
  };
}

function buildFeeGovernance(args: {
  existing: Record<string, any>;
  feeInput: ReturnType<typeof extractFeeInput>;
  policy: MedReachCommercialPolicy;
  admin: boolean;
  who: { role: string; uid: string | null };
}) {
  const { existing, feeInput, policy, admin, who } = args;

  if (!feeInput) return existing;

  const now = new Date().toISOString();

  const requestedStatus =
    feeInput.requestedStatus ||
    (admin || !policy.requireAdminApprovalForFeeChanges ? 'ACTIVE' : 'PENDING_ADMIN_APPROVAL');

  const status: FeeStatus =
    requestedStatus === 'REJECTED'
      ? 'REJECTED'
      : requestedStatus === 'INHERIT_DEFAULT'
        ? 'INHERIT_DEFAULT'
        : requestedStatus === 'ACTIVE' && (admin || !policy.requireAdminApprovalForFeeChanges)
          ? 'ACTIVE'
          : 'PENDING_ADMIN_APPROVAL';

  const base = {
    ...existing,
    currency: feeInput.currency || existing.currency || policy.currency || DEFAULT_POLICY.currency,
    phlebCalloutFeeCents: feeInput.phlebCalloutFeeCents,
    phlebPerKmFeeCents: feeInput.phlebPerKmFeeCents,
    phlebUrgentDrawSurchargeCents: feeInput.phlebUrgentDrawSurchargeCents,
    note: feeInput.note,
    status,
    source: admin ? 'admin_override' : 'phleb_proposal',
    proposedByUserId: existing.proposedByUserId || who.uid || null,
    proposedByRole: existing.proposedByRole || who.role,
    proposedAt: existing.proposedAt || now,
    updatedByUserId: who.uid || null,
    updatedByRole: who.role,
    updatedAt: now,
    policySnapshot: {
      allowPhlebSelfSetCalloutFee: policy.allowPhlebSelfSetCalloutFee,
      requireAdminApprovalForFeeChanges: policy.requireAdminApprovalForFeeChanges,
      defaultPhlebCalloutFeeCents: policy.phlebCalloutFeeCents,
      defaultPhlebPerKmFeeCents: policy.phlebPerKmFeeCents,
      defaultPhlebUrgentDrawSurchargeCents: policy.phlebUrgentDrawSurchargeCents,
      currency: policy.currency,
    },
  };

  if (status === 'ACTIVE') {
    return {
      ...base,
      approvedByUserId: who.uid || existing.approvedByUserId || null,
      approvedByRole: who.role,
      approvedAt: now,
      rejectedByUserId: null,
      rejectedAt: null,
    };
  }

  if (status === 'REJECTED') {
    return {
      ...base,
      rejectedByUserId: who.uid || null,
      rejectedByRole: who.role,
      rejectedAt: now,
    };
  }

  return base;
}

function projectPreferences(row: any, labs: any[], commercial: Awaited<ReturnType<typeof loadCommercialPolicy>>) {
  const serviceAreaMeta = asObject(row.serviceAreaMeta);
  const vehicleMeta = asObject(row.vehicleMeta);
  const feeGovernance = asObject(serviceAreaMeta.feeGovernance);

  return {
    phlebId: row.id,
    userId: row.userId,
    defaultLabId: row.defaultLabId ?? null,
    approvalStatus: row.approvalStatus,
    active: row.active,
    serviceAreas: Array.isArray(serviceAreaMeta.serviceAreas) ? serviceAreaMeta.serviceAreas : [],
    serviceAreaMeta,
    vehicle: {
      vehicleType: vehicleMeta.vehicleType ?? null,
      registration: vehicleMeta.registration ?? null,
      make: vehicleMeta.make ?? null,
      model: vehicleMeta.model ?? null,
      coldChainCapable: Boolean(vehicleMeta.coldChainCapable),
      changePending: Boolean(vehicleMeta.changePending),
      updatedAt: vehicleMeta.updatedAt ?? null,
    },
    feeGovernance: {
      status: feeGovernance.status || 'INHERIT_DEFAULT',
      currency: feeGovernance.currency || commercial.policy.currency,
      phlebCalloutFeeCents:
        feeGovernance.phlebCalloutFeeCents ?? commercial.policy.phlebCalloutFeeCents,
      phlebPerKmFeeCents:
        feeGovernance.phlebPerKmFeeCents ?? commercial.policy.phlebPerKmFeeCents,
      phlebUrgentDrawSurchargeCents:
        feeGovernance.phlebUrgentDrawSurchargeCents ?? commercial.policy.phlebUrgentDrawSurchargeCents,
      source: feeGovernance.source || 'commercial_policy_default',
      proposedAt: feeGovernance.proposedAt ?? null,
      approvedAt: feeGovernance.approvedAt ?? null,
      rejectedAt: feeGovernance.rejectedAt ?? null,
      note: feeGovernance.note ?? null,
    },
    commercialPolicy: {
      source: commercial.source,
      persistence: commercial.persistence,
      allowPhlebSelfSetCalloutFee: commercial.policy.allowPhlebSelfSetCalloutFee,
      requireAdminApprovalForFeeChanges: commercial.policy.requireAdminApprovalForFeeChanges,
      defaultPhlebCalloutFeeCents: commercial.policy.phlebCalloutFeeCents,
      defaultPhlebPerKmFeeCents: commercial.policy.phlebPerKmFeeCents,
      defaultPhlebUrgentDrawSurchargeCents: commercial.policy.phlebUrgentDrawSurchargeCents,
      currency: commercial.policy.currency,
    },
    labs,
  };
}

async function activeLabs() {
  return prisma.labPartner.findMany({
    where: {
      active: true,
      status: 'ACTIVE',
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      status: true,
      active: true,
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: { phlebId: string } }) {
  try {
    const who = whoFromRequest(req);
    const phlebId = cleanString(params.phlebId, 128);

    if (!phlebId) {
      return NextResponse.json({ ok: false, error: 'missing_phlebId' }, { status: 400 });
    }

    const existing = await findPhleb(phlebId);

    if (!existing) {
      return NextResponse.json({ ok: false, error: 'phleb_not_found' }, { status: 404 });
    }

    const allowed = await canAccessPreferences(req, existing, who);

    if (!allowed) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const [labs, commercial] = await Promise.all([activeLabs(), loadCommercialPolicy(req)]);

    return NextResponse.json({
      ok: true,
      data: projectPreferences(existing, labs, commercial),
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'medreach_phleb_preferences_load_failed' },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { phlebId: string } }) {
  try {
    const who = whoFromRequest(req);
    const role = who.role;
    const admin = isAdminRole(role);
    const phlebId = cleanString(params.phlebId, 128);

    if (!phlebId) {
      return NextResponse.json({ ok: false, error: 'missing_phlebId' }, { status: 400 });
    }

    let body: Record<string, any>;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
    }

    const existing = await findPhleb(phlebId);

    if (!existing) {
      return NextResponse.json({ ok: false, error: 'phleb_not_found' }, { status: 404 });
    }

    const allowed = await canAccessPreferences(req, existing, who);

    if (!allowed) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const commercial = await loadCommercialPolicy(req);
    const feeInput = extractFeeInput(body);

    if (feeInput && !admin && !commercial.policy.allowPhlebSelfSetCalloutFee) {
      return NextResponse.json(
        {
          ok: false,
          error: 'phleb_fee_self_set_disabled',
          message: 'Admin commercial policy does not currently allow phlebotomists to propose their own call-out fees.',
          commercialPolicy: {
            allowPhlebSelfSetCalloutFee: commercial.policy.allowPhlebSelfSetCalloutFee,
            requireAdminApprovalForFeeChanges: commercial.policy.requireAdminApprovalForFeeChanges,
          },
        },
        { status: 403 },
      );
    }

    const existingServiceAreaMeta = asObject(existing.serviceAreaMeta);
    const existingVehicleMeta = asObject((existing as any).vehicleMeta);
    const data: Record<string, any> = {};
    let nextServiceAreaMeta = { ...existingServiceAreaMeta };
    let nextVehicleMeta = { ...existingVehicleMeta };

    if ('serviceAreas' in body) {
      nextServiceAreaMeta = {
        ...nextServiceAreaMeta,
        serviceAreas: cleanStringArray(body.serviceAreas),
      };
    }

    if ('availability' in body) {
      nextServiceAreaMeta = {
        ...nextServiceAreaMeta,
        availability: asObject(body.availability),
        availabilityUpdatedAt: new Date().toISOString(),
      };
    }

    if ('vehicle' in body || 'vehicleMeta' in body) {
      nextVehicleMeta = normalizeVehicleMeta(body.vehicle ?? body.vehicleMeta, existingVehicleMeta, admin);
      data.vehicleMeta = nextVehicleMeta;
    }

    if ('defaultLabId' in body || 'preferredLabId' in body) {
      const labId = cleanString(body.defaultLabId || body.preferredLabId, 128) || null;

      if (labId) {
        const lab = await prisma.labPartner.findUnique({
          where: { id: labId },
          select: { id: true, active: true, status: true },
        });

        if (!lab || !lab.active || lab.status !== 'ACTIVE') {
          return NextResponse.json({ ok: false, error: 'invalid_default_lab' }, { status: 400 });
        }
      }

      data.defaultLabId = labId;
    }

    if (feeInput) {
      nextServiceAreaMeta = {
        ...nextServiceAreaMeta,
        feeGovernance: buildFeeGovernance({
          existing: asObject(nextServiceAreaMeta.feeGovernance),
          feeInput,
          policy: commercial.policy,
          admin,
          who,
        }),
      };
    }

    if (JSON.stringify(nextServiceAreaMeta) !== JSON.stringify(existingServiceAreaMeta)) {
      data.serviceAreaMeta = nextServiceAreaMeta;
    }

    if (!Object.keys(data).length) {
      return NextResponse.json({ ok: false, error: 'no_changes' }, { status: 400 });
    }

    const row = await prisma.medReachPhlebProfile.update({
      where: { id: existing.id },
      data,
    });

    await prisma.auditEvent.create({
      data: {
        kind: feeInput ? 'medreach_phleb_fee_preferences_updated' : 'medreach_phleb_preferences_updated',
        actorId: who.uid,
        actorRole: role,
        subjectId: row.id,
        meta: {
          phlebProfileId: row.id,
          phlebUserId: row.userId,
          updatedFields: Object.keys(data),
          feeGovernance: asObject(asObject(row.serviceAreaMeta).feeGovernance),
          commercialPolicy: {
            source: commercial.source,
            persistence: commercial.persistence,
            allowPhlebSelfSetCalloutFee: commercial.policy.allowPhlebSelfSetCalloutFee,
            requireAdminApprovalForFeeChanges: commercial.policy.requireAdminApprovalForFeeChanges,
          },
        },
      },
    });

    const labs = await activeLabs();

    return NextResponse.json({
      ok: true,
      data: projectPreferences(row, labs, commercial),
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'medreach_phleb_preferences_update_failed' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest, ctx: { params: { phlebId: string } }) {
  return PATCH(req, ctx);
}

export async function OPTIONS() {
  return NextResponse.json({ ok: true });
}
