import { NextRequest, NextResponse } from 'next/server';
import { computeRefundCents } from '@/src/payments/refunds';

// You can swap these to Prisma calls in your store layer
async function listUnsettledAppointments(): Promise<Array<any>> {
  // expected fields:
  // id, clinicianId, patientId, startsAt, endsAt, priceCents, currency,
  // status ('confirmed'|'completed'|'canceled'), cancelAt?, cancelBy?, joinedMs?
  return [];
}
async function markSettled(apptId: string, payoutCents: number, refundCents: number) { /* ... */ }

export async function POST(_req: NextRequest) {
  const appts = await listUnsettledAppointments();

  for (const a of appts) {
    const scheduledMs = Math.max(0, new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime());
    const refund = computeRefundCents({
      priceCents: a.priceCents,
      startsAt: new Date(a.startsAt),
      endsAt: new Date(a.endsAt),
      cancelAt: a.cancelAt ? new Date(a.cancelAt) : null,
      cancelBy: a.cancelBy ?? null,
      joinedAtMs: a.joinedMs ?? 0,
      scheduledMs
    });

    const net = Math.max(0, a.priceCents - refund);
    // platform/clinician split already stored on appointment at booking time;
    // optionally recompute clinician take if refund applies proportionally.
    const proportion = net / a.priceCents;
    const clinicianTake = Math.round((a.clinicianTakeCents ?? Math.round(a.priceCents * 0.7)) * proportion);

    await markSettled(a.id, clinicianTake, refund);
  }

  return NextResponse.json({ ok: true, processed: appts.length });
}
