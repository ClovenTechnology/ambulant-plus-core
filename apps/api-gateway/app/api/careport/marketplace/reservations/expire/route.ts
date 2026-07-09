import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { orgIdFromHeaders, requireRole } from '@/src/lib/careport';
import { applyMarketplaceReservationTransition } from '@/src/careport/marketplaceReservation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function intParam(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
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

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ['admin']);

    const url = new URL(req.url);
    const maxAgeMinutes = intParam(url.searchParams.get('maxAgeMinutes'), 45, 5, 24 * 60);
    const limit = intParam(url.searchParams.get('limit'), 50, 1, 250);
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60_000);

    const body = await req.json().catch(() => ({}));
    const explicitOrderId = clean(body?.orderId, 120);

    const orders = await (prisma as any).carePortOrder.findMany({
      where: {
        orgId,
        status: 'PAYMENT_PENDING',
        erxOrderId: { startsWith: 'otc-marketplace-' },
        ...(explicitOrderId ? { id: explicitOrderId } : { updatedAt: { lt: cutoff } }),
      },
      orderBy: { updatedAt: 'asc' },
      take: limit,
      select: {
        id: true,
        erxOrderId: true,
        status: true,
        updatedAt: true,
      },
    });

    const results: any[] = [];

    for (const order of orders) {
      const result = await (prisma as any).$transaction(async (tx: any) => {
        const reservation = await applyMarketplaceReservationTransition(tx, {
          orderId: order.id,
          action: 'release',
          reason: explicitOrderId ? 'manual_expiry' : 'payment_pending_expired',
          actorId: who.uid ?? null,
          actorRole: who.role ?? null,
        });

        const updated = await tx.carePortOrder.update({
          where: { id: order.id },
          data: {
            status: 'EXPIRED',
          },
          select: {
            id: true,
            status: true,
            updatedAt: true,
          },
        });

        await tx.auditEvent.create({
          data: {
            kind: 'careport_marketplace_reservation_expired',
            actorId: who.uid ?? null,
            actorRole: who.role ?? null,
            subjectId: order.id,
            meta: {
              orgId,
              maxAgeMinutes,
              cutoff: cutoff.toISOString(),
              reservation,
            },
          },
        }).catch(() => null);

        return { order: updated, reservation };
      });

      results.push(result);
    }

    return json({
      ok: true,
      maxAgeMinutes,
      cutoff: cutoff.toISOString(),
      expired: results.length,
      results,
    });
  } catch (error: any) {
    return json(
      {
        ok: false,
        error: error?.message || 'careport_marketplace_reservation_expiry_failed',
      },
      error?.status || 500,
    );
  }
}