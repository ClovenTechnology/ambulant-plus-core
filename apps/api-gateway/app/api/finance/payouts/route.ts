//apps/api-gateway/app/api/finance/payouts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/finance/payouts?status=pending
 * Returns a lightweight list for the "Payouts Due" tile.
 *
 * Optional query params:
 * - status: pending | paid | cancelled | failed | refunded (case-insensitive)
 * - limit: number (default 25) – keeps response tiny for tiles
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statusRaw = (searchParams.get('status') || '').toLowerCase();
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10) || 25, 200);

    const allowed = new Set(['pending', 'paid', 'cancelled', 'failed', 'refunded']);
    const where = allowed.has(statusRaw) ? { status: statusRaw } : {};

    const items = await prisma.payout.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        role: true,
        entityId: true,
        periodStart: true,
        periodEnd: true,
        amountCents: true,
        currency: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ items });
  } catch (err: any) {
    console.error('GET /api/finance/payouts error', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
