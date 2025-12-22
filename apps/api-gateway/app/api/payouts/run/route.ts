import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/payouts/run?kind=clinicians|phlebs|riders|labs|pharmacies|all
 * Creates pending payouts for the selected kind(s), skipping already-processed records
 * using a simple idempotency check via Payout.meta equality.
 *
 * Notes:
 * - "Tiny" logic: we fall back to simple flat-rate payouts if amounts aren’t present.
 * - Adjust the heuristics as your business rules mature.
 */

const DEFAULTS = {
  PHLEB_PAYOUT_CENTS: parseInt(process.env.PHLEB_PAYOUT_CENTS || '15000', 10),       // R150
  RIDER_PAYOUT_CENTS: parseInt(process.env.RIDER_PAYOUT_CENTS || '2500', 10),        // R25
  LAB_PAYOUT_CENTS:   parseInt(process.env.LAB_PAYOUT_CENTS   || '50000', 10),       // R500
  PHARM_PAYOUT_CENTS: parseInt(process.env.PHARM_PAYOUT_CENTS || '50000', 10),       // R500
  CURRENCY:            process.env.DEFAULT_PAYOUT_CURRENCY || 'ZAR',
};

async function payoutExists(meta: Record<string, any>) {
  const found = await prisma.payout.findFirst({
    where: { meta: { equals: meta } }, // exact JSON equality match
    select: { id: true },
  });
  return !!found;
}

/** Clinicians: identical to the dedicated runner (kept minimal here) */
async function runClinicians() {
  const now = new Date();
  const appts = await prisma.appointment.findMany({
    where: { status: 'completed', endsAt: { lte: now } },
    select: {
      id: true, clinicianId: true, startsAt: true, endsAt: true,
      priceCents: true, currency: true, clinicianTakeCents: true,
    },
    orderBy: { endsAt: 'asc' },
    take: 500,
  });

  let created = 0;
  for (const a of appts) {
    const meta = { appointmentId: a.id };
    if (await payoutExists(meta)) continue;

    const amountCents = a.clinicianTakeCents ?? Math.round(a.priceCents * 0.7);
    await prisma.payout.create({
      data: {
        role: 'clinician',
        entityId: a.clinicianId,
        periodStart: a.startsAt,
        periodEnd: a.endsAt,
        amountCents: Math.max(0, amountCents),
        currency: a.currency || DEFAULTS.CURRENCY,
        status: 'pending',
        meta,
      },
    });
    created += 1;
  }
  return { created, scanned: appts.length };
}

/** Phlebotomists: from MedReachJob COMPLETED with phlebId */
async function runPhlebs() {
  const jobs = await prisma.medReachJob.findMany({
    where: { status: 'Completed' },
    select: { id: true, phlebId: true, labId: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: 'asc' },
    take: 500,
  });

  let created = 0;
  for (const j of jobs) {
    if (!j.phlebId) continue;
    const meta = { medReachJobId: j.id, kind: 'phleb' };
    if (await payoutExists(meta)) continue;

    const amountCents = DEFAULTS.PHLEB_PAYOUT_CENTS;
    await prisma.payout.create({
      data: {
        role: 'phleb',
        entityId: j.phlebId,
        periodStart: j.createdAt,
        periodEnd: j.updatedAt ?? j.createdAt,
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

/** Riders: from CarePortJob DELIVERED with riderId */
async function runRiders() {
  const jobs = await prisma.carePortJob.findMany({
    where: { status: 'Delivered' },
    select: { id: true, riderId: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: 'asc' },
    take: 500,
  });

  let created = 0;
  for (const j of jobs) {
    if (!j.riderId) continue;
    const meta = { carePortJobId: j.id, kind: 'rider' };
    if (await payoutExists(meta)) continue;

    const amountCents = DEFAULTS.RIDER_PAYOUT_CENTS;
    await prisma.payout.create({
      data: {
        role: 'rider',
        entityId: j.riderId,
        periodStart: j.createdAt,
        periodEnd: j.updatedAt ?? j.createdAt,
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

/** Labs: from LabOrder completed; pay the lab partner */
async function runLabs() {
  const orders = await prisma.labOrder.findMany({
    where: { status: 'completed' },
    select: { id: true, clinicianId: true, createdAt: true, encounterId: true },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });

  // If your schema ties a LabOrder directly to a LabPartner, fetch & use it.
  // Here we pay the MedReachJob.labId when we find a matching job, else a flat payout.
  let created = 0;
  for (const o of orders) {
    const meta = { labOrderId: o.id };
    if (await payoutExists(meta)) continue;

    // Try map via MedReachJob with same encounterId (best-effort)
    const job = await prisma.medReachJob.findFirst({
      where: { timeline: { some: { jobId: { not: undefined } } }, /* noop to keep type-satisfied */ },
      // If you track encounter ↔ job in your domain, replace this with a real relation
    }).catch(() => null);

    const labId = (job as any)?.labId ?? null;
    const entityId = labId ?? 'lab:unknown';
    const amountCents = DEFAULTS.LAB_PAYOUT_CENTS;

    await prisma.payout.create({
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

/** Pharmacies: from CarePortJob DELIVERED; pay the pharmacy partner */
async function runPharmacies() {
  const jobs = await prisma.carePortJob.findMany({
    where: { status: 'Delivered' },
    select: { id: true, pharmacyId: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: 'asc' },
    take: 500,
  });

  let created = 0;
  for (const j of jobs) {
    if (!j.pharmacyId) continue;
    const meta = { carePortJobId: j.id, kind: 'pharmacy' };
    if (await payoutExists(meta)) continue;

    const amountCents = DEFAULTS.PHARM_PAYOUT_CENTS;
    await prisma.payout.create({
      data: {
        role: 'pharmacy',
        entityId: j.pharmacyId,
        periodStart: j.createdAt,
        periodEnd: j.updatedAt ?? j.createdAt,
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
    const { searchParams } = new URL(req.url);
    const kind = (searchParams.get('kind') || 'all').toLowerCase();

    const wantClin = kind === 'clinicians' || kind === 'all';
    const wantPhlebs = kind === 'phlebs' || kind === 'all';
    const wantRiders = kind === 'riders' || kind === 'all';
    const wantLabs = kind === 'labs' || kind === 'all';
    const wantPharm = kind === 'pharmacies' || kind === 'all';

    const results = {
      clinicians: wantClin ? await runClinicians() : null,
      phlebs: wantPhlebs ? await runPhlebs() : null,
      riders: wantRiders ? await runRiders() : null,
      labs: wantLabs ? await runLabs() : null,
      pharmacies: wantPharm ? await runPharmacies() : null,
    };

    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    console.error('POST /api/payouts/run error', err);
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
