import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { orgIdFromHeaders, requireRole } from '@/src/lib/careport';
import { applyMarketplaceReservationTransition } from '@/src/careport/marketplaceReservation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RiderAction =
  | 'accept'
  | 'at_pharmacy'
  | 'picked_up'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed_delivery'
  | 'return_to_pharmacy';

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'access-control-allow-origin': '*' },
  });
}

function normalizeAction(value: unknown): RiderAction | '' {
  const action = clean(value, 80).toLowerCase();
  if (
    action === 'accept' ||
    action === 'at_pharmacy' ||
    action === 'picked_up' ||
    action === 'out_for_delivery' ||
    action === 'delivered' ||
    action === 'failed_delivery' ||
    action === 'return_to_pharmacy'
  ) {
    return action;
  }
  return '';
}

function nextStatusFor(action: RiderAction) {
  if (action === 'accept') return 'RIDER_ASSIGNED';
  if (action === 'at_pharmacy') return 'AT_PHARMACY';
  if (action === 'picked_up') return 'PICKED_UP';
  if (action === 'out_for_delivery') return 'OUT_FOR_DELIVERY';
  if (action === 'delivered') return 'DELIVERED';
  if (action === 'failed_delivery') return 'DELIVERY_FAILED';
  if (action === 'return_to_pharmacy') return 'RETURNING_TO_PHARMACY';
  return 'DISPATCHING';
}

async function ensureAssignment(orderId: string, userId: string, orgId: string) {
  const delegate = (prisma as any).carePortRiderAssignment;
  if (!delegate) return null;

  const existing = await delegate.findFirst({ where: { orgId, orderId, riderUserId: userId } }).catch(() => null);
  if (existing) return existing;

  return delegate.create({
    data: {
      orgId,
      orderId,
      riderUserId: userId,
      status: 'RIDER_ASSIGNED',
      assignedAt: new Date(),
    },
  }).catch(() => null);
}

export async function POST(req: NextRequest, { params }: { params: { orderId: string } }) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ['admin', 'rider']);

    const orderId = clean(params.orderId, 120);
    if (!orderId) return json({ ok: false, error: 'orderId_required' }, 400);

    const userId = clean(who.uid, 120);
    if (!userId && who.role !== 'admin') return json({ ok: false, error: 'missing_uid' }, 409);

    const body = await req.json().catch(() => ({}));
    const action = normalizeAction(body?.action);
    const note = clean(body?.note, 1000) || null;
    const proof = body?.proof ?? null;

    if (!action) return json({ ok: false, error: 'invalid_rider_action' }, 400);

    const order = await (prisma as any).carePortOrder.findFirst({
      where: { id: orderId, orgId, fulfillment: 'DELIVERY' },
    });
    if (!order) return json({ ok: false, error: 'delivery_order_not_found' }, 404);

    const nextStatus = nextStatusFor(action);
    const now = new Date();

    const updated = await (prisma as any).$transaction(async (tx: any) => {
      const assignment = await ensureAssignment(orderId, userId || clean(body?.riderUserId), orgId);

      if ((prisma as any).carePortRiderAssignment && assignment?.id) {
        const assignmentData: any = { status: nextStatus };
        if (action === 'picked_up') assignmentData.pickedUpAt = now;
        if (action === 'delivered') assignmentData.deliveredAt = now;
        await tx.carePortRiderAssignment.update({ where: { id: assignment.id }, data: assignmentData }).catch(() => null);
      }

      if ((prisma as any).delivery) {
        const delivery = await tx.delivery.findFirst({ where: { orderId } }).catch(() => null);
        if (delivery) {
          const deliveryData: any = { status: nextStatus };
          if (action === 'picked_up') deliveryData.pickedUpAt = now;
          if (action === 'delivered') deliveryData.deliveredAt = now;
          await tx.delivery.update({ where: { id: delivery.id }, data: deliveryData }).catch(() => null);
        }
      }

      const prevSnapshot =
        order.sponsorPricingSnapshot && typeof order.sponsorPricingSnapshot === 'object'
          ? order.sponsorPricingSnapshot
          : {};

      const workflow = Array.isArray((prevSnapshot as any).riderWorkflow?.history)
        ? (prevSnapshot as any).riderWorkflow.history
        : [];

      const updatedOrder = await tx.carePortOrder.update({
        where: { id: orderId },
        data: {
          status: nextStatus === 'DELIVERED' ? 'DELIVERED' : nextStatus,
          sponsorPricingSnapshot: {
            ...prevSnapshot,
            riderWorkflow: {
              history: [
                ...workflow,
                {
                  action,
                  to: nextStatus,
                  at: now.toISOString(),
                  actorId: userId || null,
                  note,
                  proof: proof || null,
                },
              ],
            },
          } as any,
        },
      });

      let reservationTransition: any = null;

      if (nextStatus === 'DELIVERED') {
        reservationTransition = await applyMarketplaceReservationTransition(tx, {
          orderId,
          action: 'capture',
          reason: 'delivery_completed',
          actorId: userId || null,
          actorRole: who.role ?? null,
        });
      }

      await tx.auditEvent.create({
        data: {
          kind: 'careport_rider_status_updated',
          actorId: userId || null,
          actorRole: who.role ?? null,
          subjectId: orderId,
          meta: { orgId, action, status: nextStatus, note, proof },
        },
      }).catch(() => null);

      return updatedOrder;
    });

    return json({ ok: true, order: updated.order, status: nextStatus, marketplaceReservation: updated.marketplaceReservation });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'rider_status_update_failed' }, error?.status || 500);
  }
}
