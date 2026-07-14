import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// A5_J_G_C_RIDER_PHLEB_CONTRACTOR_PAYOUT_RUNNER

/**
 * POST /api/payouts/run?kind=clinicians|phlebs|riders|labs|pharmacies|all
 *
 * Generates generic pending Payout rows.
 *
 * A5-J-G-C hardens rider and phleb rows with Ambulant+ Contractor
 * Payout Summary metadata while preserving existing role contracts:
 * - riders use role='rider'
 * - phlebotomists preserve the existing role='phleb'
 */

const DEFAULTS = {
  PHLEB_PAYOUT_CENTS: parseInt(process.env.PHLEB_PAYOUT_CENTS || '15000', 10),
  RIDER_PAYOUT_CENTS: parseInt(process.env.RIDER_PAYOUT_CENTS || '2500', 10),
  LAB_PAYOUT_CENTS: parseInt(process.env.LAB_PAYOUT_CENTS || '50000', 10),
  PHARM_PAYOUT_CENTS: parseInt(process.env.PHARM_PAYOUT_CENTS || '50000', 10),
  CURRENCY: process.env.DEFAULT_PAYOUT_CURRENCY || 'ZAR',
};

const CONTRACTOR_NOTICE =
  'This is a contractor payout summary, not an employment payslip. Tax, PAYE, UIF, pension, professional indemnity and other statutory or professional obligations may remain the contractor\'s responsibility unless Ambulant+ has explicitly enabled and applied a deduction line. Please retain this payout summary for your records and obtain independent tax advice where required.';

const CONTRACTOR_EMPTY_STATE = {
  title: 'No payout summary yet.',
  message: "You haven't completed any eligible jobs yet.",
};

function asCents(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
}

function asText(value: unknown, max = 180) {
  return String(value || '').trim().slice(0, max);
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function buildPayoutRef(parts: unknown[]) {
  return parts
    .map((part) =>
      String(part || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    )
    .filter(Boolean)
    .join('-')
    .slice(0, 140);
}

function contractorTaxAdvisory(currency: string) {
  return {
    currency,
    estimateOnly: true,
    taxWithholdingEnabled: false,
    taxEstimateCents: 0,
    taxWithholdingCents: 0,
    message:
      'Tax, PAYE, UIF, pension, professional indemnity and other statutory or professional obligations may remain the contractor\'s responsibility unless Ambulant+ explicitly enables and applies a deduction line. This payout summary should be retained for records and independent tax advice where required.',
  };
}

type ContractorSummaryInput = {
  role: 'rider' | 'phleb' | 'lab' | 'pharmacy' | 'clinician';
  contractorType: 'rider' | 'phlebotomist' | 'lab' | 'pharmacy' | 'clinician';
  entityId: string;
  sourceKind: string;
  sourceId: string;
  grossEarningsCents: number;
  netPayableCents: number;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  sourceMeta?: Record<string, any>;
};

function buildContractorPayoutMetadata(input: ContractorSummaryInput) {
  const grossEarningsCents = asCents(input.grossEarningsCents);
  const netPayableCents = asCents(input.netPayableCents);
  const currency = input.currency || DEFAULTS.CURRENCY;
  const taxAdvisory = contractorTaxAdvisory(currency);
  const payoutRef = buildPayoutRef([
    'ambulant',
    input.contractorType,
    input.sourceKind,
    input.sourceId,
  ]);

  const contractorPayoutSummary = {
    label: 'Ambulant+ Contractor Payout Summary',
    contractorType: input.contractorType,
    role: input.role,
    entityId: input.entityId,
    periodMonth: monthKey(input.periodEnd),
    periodStart: input.periodStart.toISOString(),
    periodEnd: input.periodEnd.toISOString(),
    currency,
    grossEarningsCents,
    refundCents: 0,
    platformFeeCents: 0,
    baseContractorTakeCents: netPayableCents,
    baseClinicianTakeCents: 0,
    onboardingInstalmentCents: 0,
    planFeeCents: 0,
    customDeductionCents: 0,
    taxWithholdingCents: 0,
    taxEstimateCents: 0,
    totalChargedDeductionsCents: 0,
    netPayableCents,
    deductionLines: [],
    customDeductions: [],
    taxAdvisory,
    contractorNotice: CONTRACTOR_NOTICE,
    payoutReference: payoutRef,
    amountSource: 'configured_default_or_source_payable',
    source: {
      kind: input.sourceKind,
      id: input.sourceId,
      ...asObject(input.sourceMeta),
    },
  };

  return {
    source: contractorPayoutSummary.source,
    sourceKind: input.sourceKind,
    sourceId: input.sourceId,
    contractorType: input.contractorType,
    payoutRef,
    payoutSummaryLabel: 'Ambulant+ Contractor Payout Summary',
    payoutSummaryEmptyState: CONTRACTOR_EMPTY_STATE,
    contractorPayoutSummary,
    taxAdvisory,
    generatedAt: new Date().toISOString(),
    generatedBy: 'A5_J_G_C_RIDER_PHLEB_CONTRACTOR_PAYOUT_RUNNER',
  };
}

async function existingSourceSet(roles: string[], sourceKeys: string[]) {
  const rows = await (prisma as any).payout.findMany({
    where: {
      role: { in: roles },
    },
    select: {
      meta: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10000,
  });

  const set = new Set<string>();

  for (const row of rows) {
    const meta = asObject(row.meta);
    const source = asObject(meta.source);

    for (const key of sourceKeys) {
      const direct = asText(meta[key]);
      if (direct) set.add(direct);
    }

    const sourceId = asText(source.id || meta.sourceId);
    if (sourceId) set.add(sourceId);
  }

  return set;
}

async function payoutExists(meta: Record<string, any>) {
  const found = await (prisma as any).payout.findFirst({
    where: { meta: { equals: meta } },
    select: { id: true },
  });

  return Boolean(found);
}

/** Clinicians: retained for compatibility; dedicated clinician runner is the hardened path. */
async function runClinicians() {
  const now = new Date();

  const appts = await (prisma as any).appointment.findMany({
    where: { status: 'completed', endsAt: { lte: now } },
    select: {
      id: true,
      clinicianId: true,
      startsAt: true,
      endsAt: true,
      priceCents: true,
      currency: true,
      clinicianTakeCents: true,
    },
    orderBy: { endsAt: 'asc' },
    take: 500,
  });

  let created = 0;

  for (const a of appts) {
    const meta = { appointmentId: a.id };

    if (await payoutExists(meta)) continue;

    const amountCents = a.clinicianTakeCents ?? Math.round((a.priceCents || 0) * 0.7);

    await (prisma as any).payout.create({
      data: {
        role: 'clinician',
        entityId: a.clinicianId,
        periodStart: a.startsAt,
        periodEnd: a.endsAt,
        amountCents: Math.max(0, asCents(amountCents)),
        currency: a.currency || DEFAULTS.CURRENCY,
        status: 'pending',
        meta,
      },
    });

    created += 1;
  }

  return { created, scanned: appts.length };
}

/** Phlebotomists: from MedReachJob Completed with phlebId. */
async function runPhlebs() {
  const jobs = await (prisma as any).medReachJob.findMany({
    where: { status: 'Completed' },
    select: {
      id: true,
      phlebId: true,
      labId: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'asc' },
    take: 500,
  });

  const existing = await existingSourceSet(
    ['phleb', 'phlebotomist'],
    ['medReachJobId', 'sourceId'],
  );

  let created = 0;
  let skipped = 0;

  for (const j of jobs) {
    if (!j.phlebId) {
      skipped += 1;
      continue;
    }

    if (existing.has(j.id)) {
      skipped += 1;
      continue;
    }

    const legacyMeta = { medReachJobId: j.id, kind: 'phleb' };
    if (await payoutExists(legacyMeta)) {
      existing.add(j.id);
      skipped += 1;
      continue;
    }

    const periodStart = j.createdAt || new Date();
    const periodEnd = j.updatedAt || periodStart;
    const amountCents = DEFAULTS.PHLEB_PAYOUT_CENTS;

    const meta = {
      ...legacyMeta,
      ...buildContractorPayoutMetadata({
        role: 'phleb',
        contractorType: 'phlebotomist',
        entityId: j.phlebId,
        sourceKind: 'medreach_job',
        sourceId: j.id,
        grossEarningsCents: amountCents,
        netPayableCents: amountCents,
        currency: DEFAULTS.CURRENCY,
        periodStart,
        periodEnd,
        sourceMeta: {
          labId: j.labId || null,
          legacyKind: 'phleb',
        },
      }),
    };

    await (prisma as any).payout.create({
      data: {
        role: 'phleb',
        entityId: j.phlebId,
        periodStart,
        periodEnd,
        amountCents,
        currency: DEFAULTS.CURRENCY,
        status: 'pending',
        meta,
      },
    });

    existing.add(j.id);
    created += 1;
  }

  return { created, skipped, scanned: jobs.length };
}

/** Riders: from CarePortJob Delivered with riderId. */
async function runRiders() {
  const jobs = await (prisma as any).carePortJob.findMany({
    where: { status: 'Delivered' },
    select: {
      id: true,
      riderId: true,
      pharmacyId: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'asc' },
    take: 500,
  });

  const existing = await existingSourceSet(['rider'], ['carePortJobId', 'sourceId']);

  let created = 0;
  let skipped = 0;

  for (const j of jobs) {
    if (!j.riderId) {
      skipped += 1;
      continue;
    }

    if (existing.has(j.id)) {
      skipped += 1;
      continue;
    }

    const legacyMeta = { carePortJobId: j.id, kind: 'rider' };
    if (await payoutExists(legacyMeta)) {
      existing.add(j.id);
      skipped += 1;
      continue;
    }

    const periodStart = j.createdAt || new Date();
    const periodEnd = j.updatedAt || periodStart;
    const amountCents = DEFAULTS.RIDER_PAYOUT_CENTS;

    const meta = {
      ...legacyMeta,
      ...buildContractorPayoutMetadata({
        role: 'rider',
        contractorType: 'rider',
        entityId: j.riderId,
        sourceKind: 'careport_job',
        sourceId: j.id,
        grossEarningsCents: amountCents,
        netPayableCents: amountCents,
        currency: DEFAULTS.CURRENCY,
        periodStart,
        periodEnd,
        sourceMeta: {
          pharmacyId: j.pharmacyId || null,
          legacyKind: 'rider',
        },
      }),
    };

    await (prisma as any).payout.create({
      data: {
        role: 'rider',
        entityId: j.riderId,
        periodStart,
        periodEnd,
        amountCents,
        currency: DEFAULTS.CURRENCY,
        status: 'pending',
        meta,
      },
    });

    existing.add(j.id);
    created += 1;
  }

  return { created, skipped, scanned: jobs.length };
}

/** Labs: from LabOrder completed; pay the lab partner. */
async function runLabs() {
  const orders = await (prisma as any).labOrder.findMany({
    where: { status: 'completed' },
    select: { id: true, clinicianId: true, createdAt: true, encounterId: true },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });

  let created = 0;

  for (const o of orders) {
    const meta = { labOrderId: o.id };

    if (await payoutExists(meta)) continue;

    const job = await (prisma as any).medReachJob.findFirst({
      where: { encounterId: o.encounterId },
      select: { labId: true },
    });

    const labId = job?.labId;
    const entityId = labId || 'lab:unknown';
    const amountCents = DEFAULTS.LAB_PAYOUT_CENTS;

    await (prisma as any).payout.create({
      data: {
        role: 'lab',
        entityId,
        periodStart: o.createdAt,
        periodEnd: o.createdAt,
        amountCents,
        currency: DEFAULTS.CURRENCY,
        status: 'pending',
        meta,
      },
    });

    created += 1;
  }

  return { created, scanned: orders.length };
}

/** Pharmacies: from CarePortJob Delivered; pay the pharmacy partner. */
async function runPharmacies() {
  const jobs = await (prisma as any).carePortJob.findMany({
    where: { status: 'Delivered' },
    select: {
      id: true,
      pharmacyId: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'asc' },
    take: 500,
  });

  let created = 0;

  for (const j of jobs) {
    if (!j.pharmacyId) continue;

    const meta = { carePortJobId: j.id, kind: 'pharmacy' };

    if (await payoutExists(meta)) continue;

    const amountCents = DEFAULTS.PHARM_PAYOUT_CENTS;

    await (prisma as any).payout.create({
      data: {
        role: 'pharmacy',
        entityId: j.pharmacyId,
        periodStart: j.createdAt,
        periodEnd: j.updatedAt || j.createdAt,
        amountCents,
        currency: DEFAULTS.CURRENCY,
        status: 'pending',
        meta,
      },
    });

    created += 1;
  }

  return { created, scanned: jobs.length };
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const kind = String(url.searchParams.get('kind') || body?.kind || 'all').toLowerCase();

    const wantClinicians = kind === 'clinicians' || kind === 'all';
    const wantPhlebs = kind === 'phlebs' || kind === 'phleb' || kind === 'phlebotomists' || kind === 'all';
    const wantRiders = kind === 'riders' || kind === 'rider' || kind === 'all';
    const wantLabs = kind === 'labs' || kind === 'lab' || kind === 'all';
    const wantPharmacies = kind === 'pharmacies' || kind === 'pharmacy' || kind === 'all';

    const result = {
      ok: true,
      kind,
      clinicians: wantClinicians ? await runClinicians() : null,
      phlebs: wantPhlebs ? await runPhlebs() : null,
      riders: wantRiders ? await runRiders() : null,
      labs: wantLabs ? await runLabs() : null,
      pharmacies: wantPharmacies ? await runPharmacies() : null,
      contractorSummaryMetadata: {
        rider: wantRiders,
        phleb: wantPhlebs,
        label: 'Ambulant+ Contractor Payout Summary',
      },
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error('POST /api/payouts/run error', err);
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
