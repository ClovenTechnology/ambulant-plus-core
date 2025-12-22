//apps/api-gateway/app/api/analytics/summary/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

async function sumOrZero<T extends number>(p: Promise<T>) {
  try { return await p; } catch { return 0 as T; }
}
async function countOrZero(p: Promise<number>) { try { return await p; } catch { return 0; } }

export async function GET() {
  try {
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Top-line
    const revenueCapturedCents = await sumOrZero(
      prisma.payment.aggregate({
        _sum: { amountCents: true },
        where: { status: 'captured', updatedAt: { gte: monthAgo, lte: now } },
      }).then(r => (r._sum.amountCents ?? 0))
    );

    const refundsCents = await (async () => {
      // prefer a Refund table if you have one, otherwise infer from payments
      try {
        const r = await prisma.refund.aggregate({
          _sum: { amountCents: true },
          where: { createdAt: { gte: monthAgo, lte: now } },
        });
        return r._sum.amountCents ?? 0;
      } catch {
        const r = await prisma.payment.aggregate({
          _sum: { amountCents: true },
          where: { status: 'refunded', updatedAt: { gte: monthAgo, lte: now } },
        });
        return r._sum.amountCents ?? 0;
      }
    })();

    const payoutsDueCents = await sumOrZero(
      prisma.payout.aggregate({
        _sum: { amountCents: true },
        where: { status: 'pending' },
      }).then(r => (r._sum.amountCents ?? 0))
    );

    const riderPayoutsCount = await countOrZero(
      prisma.payout.count({ where: { role: 'rider', status: 'pending' } })
    );
    const phlebPayoutsCount = await countOrZero(
      prisma.payout.count({ where: { role: 'phleb', status: 'pending' } })
    );

    const patients = await countOrZero(prisma.patientProfile.count());
    const clinicians = await countOrZero(prisma.clinicianProfile.count());

    const devicesOnline = await (async () => {
      try {
        // If you track heartbeats in deviceHeartbeat(ts), use this:
        return await prisma.deviceHeartbeat.count({ where: { ts: { gte: fiveMinAgo } } });
      } catch {
        // Fallback: if you store lastSeen on device
        try { return await prisma.device.count({ where: { lastSeenAt: { gte: fiveMinAgo } } }); }
        catch { return 0; }
      }
    })();

    // Split revenue buckets if you track them (best-effort, safe if missing)
    const careportRevenueCents = 0; // TODO wire to your orders/rides revenue if/when available
    const medreachRevenueCents = 0; // TODO wire to your draws/visits revenue

    const netEarningsCents = Math.max(0, revenueCapturedCents - refundsCents - payoutsDueCents);

    const json = {
      ok: true,
      period: { from: monthAgo.toISOString(), to: now.toISOString() },
      kpis: {
        revenueCapturedCents,
        refundsCents,
        payoutsDueCents,
        netEarningsCents,
        patients,
        clinicians,
        devicesOnline,
        riderPayoutsCount,
        phlebPayoutsCount,
        careportRevenueCents,
        medreachRevenueCents,
      },
    };

    return NextResponse.json(json, { headers: { 'access-control-allow-origin': '*' } });
  } catch (err: any) {
    console.error('GET /api/analytics/summary', err);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}
