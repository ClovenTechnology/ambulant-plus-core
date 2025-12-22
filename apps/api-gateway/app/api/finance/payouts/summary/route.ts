//apps/api-gateway/app/api/finance/payouts/summary/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await prisma.payout.groupBy({
      by: ['role', 'status'],
      _count: { _all: true },
      _sum: { amountCents: true },
    });

    const summary = rows.map(r => ({
      role: r.role,
      status: r.status,
      count: r._count._all,
      amountCents: r._sum.amountCents ?? 0,
    }));

    return NextResponse.json({ ok: true, summary });
  } catch (err: any) {
    console.error('GET /api/finance/payouts/summary', err);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}
