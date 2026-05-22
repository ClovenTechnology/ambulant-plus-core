import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { orgIdFromHeaders, requireRole } from '@/src/lib/careport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'access-control-allow-origin': '*' },
  });
}

function normalizeStatus(status: unknown) {
  return clean(status, 80).toUpperCase();
}

function money(cents: unknown, currency = 'ZAR') {
  const n = Number(cents || 0);
  return { cents: Number.isFinite(n) ? Math.trunc(n) : 0, currency };
}

async function getRiderProfile(userId: string) {
  if (!userId) return null;
  return (prisma as any).carePortRiderProfile.findUnique({ where: { userId } }).catch(() => null);
}

function shapeOrder(order: any, rider: any = null) {
  const assignment =
    order?.assignment ||
    order?.riderAssignment ||
    order?.delivery ||
    null;

  const currency = order?.currency || order?.chosenPharmacy?.currency || 'ZAR';
  const total = money(order?.totalCents, currency);

  return {
    id: order?.id,
    status: normalizeStatus(order?.status || assignment?.status || 'UNKNOWN'),
    fulfillment: order?.fulfillment || 'DELIVERY',
    destinationAddr: order?.destinationAddr || null,
    destinationLat: order?.destinationLat ?? null,
    destinationLng: order?.destinationLng ?? null,
    pharmacy: order?.chosenPharmacy || null,
    items: Array.isArray(order?.items) ? order.items : [],
    subtotalCents: Number(order?.subtotalCents || 0),
    deliveryFeeCents: Number(order?.deliveryFeeCents || 0),
    totalCents: total.cents,
    currency: total.currency,
    createdAt: order?.createdAt || null,
    updatedAt: order?.updatedAt || null,
    assignment: assignment
      ? {
          id: assignment.id || null,
          status: assignment.status || null,
          riderUserId: assignment.riderUserId || rider?.userId || null,
          assignedAt: assignment.assignedAt || assignment.createdAt || null,
          pickedUpAt: assignment.pickedUpAt || null,
          deliveredAt: assignment.deliveredAt || null,
        }
      : null,
  };
}

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ['admin', 'rider']);

    const userId = clean(who.uid, 120);
    if (!userId && who.role !== 'admin') return json({ ok: false, error: 'missing_uid', jobs: [] }, 409);

    const rider = userId ? await getRiderProfile(userId) : null;
    if (who.role === 'rider' && !rider) {
      return json({ ok: true, rider: null, jobs: [], kyiRequired: true }, 200);
    }

    const url = new URL(req.url);
    const requestedStatus = normalizeStatus(url.searchParams.get('status'));
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 100)));

    const assignmentDelegate = (prisma as any).carePortRiderAssignment;
    const deliveryDelegate = (prisma as any).delivery;
    const orderDelegate = (prisma as any).carePortOrder;

    let orderIds: string[] = [];

    if (assignmentDelegate) {
      const rows = await assignmentDelegate.findMany({
        where: {
          orgId,
          ...(who.role === 'rider' ? { riderUserId: userId } : {}),
          ...(requestedStatus ? { status: requestedStatus } : {}),
        },
        orderBy: [{ updatedAt: 'desc' }],
        take: limit,
      }).catch(() => []);
      orderIds = rows.map((row: any) => row.orderId).filter(Boolean);
    }

    if (!orderIds.length && deliveryDelegate) {
      const rows = await deliveryDelegate.findMany({
        where: {
          ...(who.role === 'rider' ? { riderId: userId } : {}),
          ...(requestedStatus ? { status: requestedStatus } : {}),
        },
        orderBy: [{ updatedAt: 'desc' }],
        take: limit,
      }).catch(() => []);
      orderIds = rows.map((row: any) => row.orderId).filter(Boolean);
    }

    let orders: any[] = [];

    if (orderIds.length) {
      orders = await orderDelegate.findMany({
        where: { id: { in: orderIds } },
        include: {
          items: true,
          chosenPharmacy: true,
          assignment: true,
          delivery: true,
        } as any,
        orderBy: [{ updatedAt: 'desc' }],
        take: limit,
      }).catch(async () => {
        return orderDelegate.findMany({
          where: { id: { in: orderIds } },
          include: { items: true, chosenPharmacy: true } as any,
          orderBy: [{ updatedAt: 'desc' }],
          take: limit,
        });
      });
    } else {
      orders = await orderDelegate.findMany({
        where: {
          orgId,
          fulfillment: 'DELIVERY',
          status: { in: ['DISPATCHING', 'RIDER_ASSIGNED', 'EN_ROUTE_TO_PICKUP', 'AT_PHARMACY', 'PICKED_UP', 'OUT_FOR_DELIVERY'] },
        },
        include: { items: true, chosenPharmacy: true } as any,
        orderBy: [{ updatedAt: 'desc' }],
        take: limit,
      }).catch(() => []);
    }

    const jobs = orders.map((order) => shapeOrder(order, rider));

    return json({ ok: true, rider, jobs });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'rider_jobs_load_failed', jobs: [] }, error?.status || 500);
  }
}
