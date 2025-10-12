// apps/api-gateway/src/lib/payouts.ts
import { prisma } from './db';

/**
 * Pull payout configuration (currently only used for clinician %).
 * Expect a model payoutConfig { id: 'default', clinicianPct, riderFlat?, phlebFlat? }
 * Rider/Phleb remain fixed-rate per your original logic.
 */
export async function getConfig() {
  const cfg = await prisma.payoutConfig
    .findUnique({ where: { id: 'default' } })
    .catch(() => null);

  return {
    clinicianPct: cfg?.clinicianPct ?? 70,
    // riderFlat / phlebFlat intentionally NOT used below to preserve existing logic
    riderFlat: cfg?.riderFlat ?? 4000,
    phlebFlat: cfg?.phlebFlat ?? 5500,
  };
}

/** Rider payout: fixed R40 per completed delivery (status=delivered) in the period. */
export async function computeRiderPayout(periodStart: Date, periodEnd: Date) {
  const completed = await prisma.delivery.count({
    where: { status: 'delivered', updatedAt: { gte: periodStart, lt: periodEnd } },
  });
  return { count: completed, amountCents: completed * 4000 };
}

/** Phlebotomist payout: fixed R55 per draw delivered to lab (status=delivered_lab) in the period. */
export async function computePhlebPayout(periodStart: Date, periodEnd: Date) {
  const completed = await prisma.draw.count({
    where: { status: 'delivered_lab', updatedAt: { gte: periodStart, lt: periodEnd } },
  });
  return { count: completed, amountCents: completed * 5500 };
}

/**
 * Clinician payout: percentage of captured payments in the period.
 * Sums captured payments per encounter, maps to clinician, then applies clinicianPct.
 */
export async function computeClinicianPayout(periodStart: Date, periodEnd: Date) {
  const { clinicianPct } = await getConfig();

  // Sum captured payments per encounter in the window
  const rows = await prisma.payment.groupBy({
    by: ['encounterId'],
    _sum: { amountCents: true },
    where: { status: 'captured', updatedAt: { gte: periodStart, lt: periodEnd } },
  });
  if (rows.length === 0) return [];

  // Map encounter -> clinician
  const encs = await prisma.encounter.findMany({
    where: { id: { in: rows.map((r) => r.encounterId) } },
    select: { id: true, clinicianId: true },
  });
  const enc2clin = new Map(encs.map((e) => [e.id, e.clinicianId || 'unknown']));

  // Aggregate per clinician
  const totals = new Map<string, number>();
  for (const r of rows) {
    const clin = enc2clin.get(r.encounterId) || 'unknown';
    const amt = r._sum.amountCents ?? 0;
    totals.set(clin, (totals.get(clin) || 0) + amt);
  }

  // Apply percentage
  return Array.from(totals.entries()).map(([clinicianId, grossCents]) => {
    const net = Math.round(grossCents * (clinicianPct / 100));
    return { clinicianId, grossCents, netCents: net, pct: clinicianPct };
  });
}
