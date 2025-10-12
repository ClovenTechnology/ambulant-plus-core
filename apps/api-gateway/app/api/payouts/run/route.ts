//apps/api-gateway/app/api/payouts/run/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { computeRiderPayout, computePhlebPayout } from '@/src/lib/payouts';
import { readIdentity } from '@/src/lib/identity';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  if (who.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { start, end } = await req.json();
  const periodStart = new Date(start);
  const periodEnd = new Date(end);

  const rider = await computeRiderPayout(periodStart, periodEnd);
  const phleb = await computePhlebPayout(periodStart, periodEnd);

  const r = await prisma.payout.create({
    data: { role: 'rider', entityId: 'all', periodStart, periodEnd, amountCents: rider.amountCents }
  });
  const p = await prisma.payout.create({
    data: { role: 'phleb', entityId: 'all', periodStart, periodEnd, amountCents: phleb.amountCents }
  });

  // AUDIT (one per payout row)
  await prisma.auditEvent.create({
    data: {
      kind: 'payout_created',
      actorId: who.uid,
      actorRole: who.role,
      subjectId: r.id,
      meta: { role: 'rider', amountCents: r.amountCents, periodStart, periodEnd },
    },
  });
  await prisma.auditEvent.create({
    data: {
      kind: 'payout_created',
      actorId: who.uid,
      actorRole: who.role,
      subjectId: p.id,
      meta: { role: 'phleb', amountCents: p.amountCents, periodStart, periodEnd },
    },
  });

  return NextResponse.json({ rider: r, phleb: p }, { headers: { 'access-control-allow-origin': '*' } });
}
