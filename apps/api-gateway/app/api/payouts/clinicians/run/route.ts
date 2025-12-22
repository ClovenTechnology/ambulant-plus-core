import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeRefundCents } from '@/src/payments/refunds';

/**
 * Creates a Payout (status: pending) per completed appointment that
 * hasn't been processed before.
 *
 * Idempotency:
 *  - We store meta = { appointmentId } on Payout and skip if a payout already
 *    exists with the same meta.
 */
export async function POST(_req: NextRequest) {
  try {
    const now = new Date();

    // Find candidate appointments:
    //  - status 'completed'
    //  - endsAt <= now (already finished)
    //  - have not been turned into payouts yet (no payout with meta.appointmentId)
    const candidates = await prisma.appointment.findMany({
      where: {
        status: 'completed',
        endsAt: { lte: now },
      },
      select: {
        id: true,
        clinicianId: true,
        patientId: true,
        startsAt: true,
        endsAt: true,
        priceCents: true,
        currency: true,
        platformFeeCents: true,
        clinicianTakeCents: true,
        paymentRef: true,
        meta: true, // may contain useful extra context
      },
      orderBy: { endsAt: 'asc' },
      take: 500, // guard rail for a single pass
    });

    let created = 0;

    for (const a of candidates) {
      // Idempotency: check if a payout already exists with this appointmentId meta
      const existing = await prisma.payout.findFirst({
        where: { meta: { equals: { appointmentId: a.id } } }, // exact JSON equality
        select: { id: true },
      });
      if (existing) continue;

      // Refund logic (uses your helper)
      const scheduledMs = Math.max(0, new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime());
      const refundCents = computeRefundCents({
        priceCents: a.priceCents,
        startsAt: new Date(a.startsAt),
        endsAt: new Date(a.endsAt),
        cancelAt: null,
        cancelBy: null,
        joinedAtMs: 0,
        scheduledMs,
      });

      const net = Math.max(0, a.priceCents - refundCents);
      const proportion = a.priceCents > 0 ? net / a.priceCents : 0;
      const clinicianTake = Math.round(
        (a.clinicianTakeCents ?? Math.round(a.priceCents * 0.7)) * proportion
      );

      await prisma.payout.create({
        data: {
          role: 'clinician',
          entityId: a.clinicianId,
          periodStart: a.startsAt,
          periodEnd: a.endsAt,
          amountCents: clinicianTake,
          currency: a.currency || 'ZAR',
          status: 'pending',
          meta: {
            appointmentId: a.id,
            paymentRef: a.paymentRef ?? null,
            platformFeeCents: a.platformFeeCents ?? null,
            refundCents,
            originalPriceCents: a.priceCents,
          },
        },
      });

      created += 1;
    }

    return NextResponse.json({ ok: true, processed: candidates.length, created });
  } catch (err: any) {
    console.error('payouts/clinicians/run error', err);
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
