//apps/api-gateway/app/api/careport/pharmacies/me/orders/[orderId]/route.ts
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
  if (who.role === 'pharmacy_staff' && who.uid) return await pharmacyIdForStaff(orgId, who.uid);
  return null;
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'access-control-allow-origin': '*' },
  });
}

export async function GET(req: NextRequest, { params }: { params: { orderId: string } }) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ['admin', 'pharmacy', 'pharmacy_staff']);

    const orderId = clean(params.orderId, 120);
    if (!orderId) return json({ ok: false, error: 'orderId_required' }, 400);

    const pharmacyId = await resolvePharmacyId(req, who);
    if (!pharmacyId) return json({ ok: false, error: 'pharmacyId_unresolved' }, 409);

    const order = await (prisma as any).carePortOrder.findFirst({
      where: { id: orderId, orgId, chosenPharmacyId: pharmacyId },
      include: {
        chosenPharmacy: true,
        items: true,
        offers: {
          where: { pharmacyId },
          include: { lines: { include: { options: true } } },
          take: 1,
        },
        selections: true,
        payments: { orderBy: { createdAt: 'desc' }, take: 10 },
        assignment: true,
      },
    });

    if (!order) return json({ ok: false, error: 'order_not_found' }, 404);

    return json({ ok: true, order });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'pharmacy_order_load_failed' }, error?.status || 500);
  }
}
