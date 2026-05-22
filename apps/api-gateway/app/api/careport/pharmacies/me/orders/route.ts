//apps/api-gateway/app/api/careport/pharmacies/me/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { orgIdFromHeaders, pharmacyIdForStaff, requireRole } from '@/src/lib/careport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

async function resolvePharmacyId(req: NextRequest, who: ReturnType<typeof readIdentity>) {
  const orgId = orgIdFromHeaders(req.headers);
  const explicit = clean(req.nextUrl.searchParams.get('pharmacyId'), 120);

  if (who.role === 'admin' && explicit) return explicit;
  if (who.role === 'pharmacy' && who.uid) return String(who.uid);

  if (who.role === 'pharmacy_staff' && who.uid) {
    const mapped = await pharmacyIdForStaff(orgId, who.uid);
    return mapped ? String(mapped) : null;
  }

  return null;
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}

function normalizeStatusFilter(value: unknown) {
  const raw = clean(value, 40).toUpperCase();
  const allowed = new Set([
    'PAYMENT_PENDING',
    'PAID',
    'PREPARING',
    'READY_FOR_PICKUP',
    'DISPATCHING',
    'RIDER_ASSIGNED',
    'EN_ROUTE_TO_PICKUP',
    'AT_PHARMACY',
    'PICKED_UP',
    'EN_ROUTE_TO_CUSTOMER',
    'DELIVERED',
    'COMPLETED',
    'CANCELLED',
    'EXPIRED',
  ]);
  return allowed.has(raw) ? raw : '';
}

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ['admin', 'pharmacy', 'pharmacy_staff']);

    const pharmacyId = await resolvePharmacyId(req, who);
    if (!pharmacyId) return json({ ok: false, error: 'pharmacyId_unresolved', orders: [] }, 409);

    const url = req.nextUrl;
    const status = normalizeStatusFilter(url.searchParams.get('status'));
    const q = clean(url.searchParams.get('q'), 120).toLowerCase();
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 50)));

    const where: any = {
      orgId,
      chosenPharmacyId: pharmacyId,
    };

    if (status) {
      where.status = status;
    } else {
      where.status = {
        in: [
          'PAID',
          'PREPARING',
          'READY_FOR_PICKUP',
          'DISPATCHING',
          'RIDER_ASSIGNED',
          'EN_ROUTE_TO_PICKUP',
          'AT_PHARMACY',
          'PICKED_UP',
          'EN_ROUTE_TO_CUSTOMER',
          'DELIVERED',
          'COMPLETED',
        ],
      };
    }

    if (q) {
      where.OR = [
        { id: { contains: q, mode: 'insensitive' } },
        { encounterId: { contains: q, mode: 'insensitive' } },
        { erxOrderId: { contains: q, mode: 'insensitive' } },
        { destinationAddr: { contains: q, mode: 'insensitive' } },
      ];
    }

    const orders = await (prisma as any).carePortOrder.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      include: {
        chosenPharmacy: true,
        items: true,
        selections: true,
        payments: { orderBy: { createdAt: 'desc' }, take: 3 },
        assignment: true,
      },
    });

    const metrics = {
      paid: orders.filter((o: any) => o.status === 'PAID').length,
      preparing: orders.filter((o: any) => o.status === 'PREPARING').length,
      readyForPickup: orders.filter((o: any) => o.status === 'READY_FOR_PICKUP').length,
      dispatching: orders.filter((o: any) => ['DISPATCHING', 'RIDER_ASSIGNED', 'EN_ROUTE_TO_PICKUP', 'AT_PHARMACY'].includes(o.status)).length,
      completed: orders.filter((o: any) => ['DELIVERED', 'COMPLETED'].includes(o.status)).length,
    };

    return json({ ok: true, orgId, pharmacyId, orders, metrics });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'pharmacy_orders_load_failed', orders: [] }, error?.status || 500);
  }
}
