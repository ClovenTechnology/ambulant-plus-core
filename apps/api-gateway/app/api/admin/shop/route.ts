// apps/api-gateway/app/api/admin/shop/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { assertAdmin } from '@/src/lib/adminAuth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    assertAdmin(req);

    const now = new Date();
    const since = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30); // 30d

    const [orders30d, paid30d, totalsPaid30d, topItems] = await Promise.all([
      prisma.shopOrder.count({ where: { createdAt: { gte: since } } }),
      prisma.shopOrder.count({ where: { status: 'PAID', createdAt: { gte: since } } }),
      prisma.shopOrder.aggregate({
        where: { status: 'PAID', createdAt: { gte: since } },
        _sum: { totalZar: true },
      }),
      prisma.shopOrderItem.groupBy({
        by: ['sku', 'name'],
        where: { order: { status: 'PAID', createdAt: { gte: since } } },
        _sum: { quantity: true, unitAmountZar: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
    ]);

    const revenueZar = totalsPaid30d._sum.totalZar || 0;

    return NextResponse.json({
      ok: true,
      windowDays: 30,
      kpis: {
        orders30d,
        paid30d,
        revenueZar,
      },
      topItems: topItems.map((x) => ({
        sku: x.sku,
        name: x.name,
        qty: x._sum.quantity || 0,
      })),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to load shop stats' },
      { status: err?.status || 500 }
    );
  }
}
