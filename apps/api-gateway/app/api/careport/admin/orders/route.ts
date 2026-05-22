import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { orgIdFromHeaders, requireRole } from '@/src/lib/careport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'access-control-allow-origin': '*' },
  });
}

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);

  try {
    requireRole(who, ['admin']);

    const orgId = orgIdFromHeaders(req.headers);
    const url = new URL(req.url);
    const status = clean(url.searchParams.get('status') || '', 80).toUpperCase();
    const q = clean(url.searchParams.get('q') || '', 120);
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 100)));

    const where: any = { orgId };
    if (status && status !== 'ALL') where.status = status;
    if (q) {
      where.OR = [
        { id: { contains: q, mode: 'insensitive' } },
        { erxOrderId: { contains: q, mode: 'insensitive' } },
        { patientId: { contains: q, mode: 'insensitive' } },
        { destinationAddr: { contains: q, mode: 'insensitive' } },
      ];
    }

    const orders = await (prisma as any).carePortOrder.findMany({
      where,
      include: {
        items: true,
        chosenPharmacy: true,
        chosenOffer: true,
        payments: true,
        assignment: true,
      } as any,
      orderBy: [{ updatedAt: 'desc' }],
      take: limit,
    });

    const summary = {
      total: orders.length,
      paymentPending: orders.filter((o: any) => o.status === 'PAYMENT_PENDING').length,
      paid: orders.filter((o: any) => o.status === 'PAID').length,
      preparing: orders.filter((o: any) => o.status === 'PREPARING').length,
      dispatching: orders.filter((o: any) => ['DISPATCHING', 'RIDER_ASSIGNED', 'EN_ROUTE_TO_PICKUP', 'AT_PHARMACY'].includes(o.status)).length,
      completed: orders.filter((o: any) => ['COMPLETED', 'DELIVERED'].includes(o.status)).length,
    };

    return json({ ok: true, orgId, orders, summary });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'careport_admin_orders_failed', orders: [] }, error?.status || 500);
  }
}
