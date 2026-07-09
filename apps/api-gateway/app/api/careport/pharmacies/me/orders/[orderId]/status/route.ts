// apps/api-gateway/app/api/careport/pharmacies/me/orders/[orderId]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { correlationIdFromHeaders, orgIdFromHeaders, pharmacyIdForStaff, requireRole } from '@/src/lib/careport';
import { applyMarketplaceReservationTransition } from '@/src/careport/marketplaceReservation';

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

type WorkflowAction = 'start_preparing' | 'ready' | 'mark_collected' | 'cancel';

function normalizeAction(value: unknown): WorkflowAction | '' {
  const raw = clean(value, 50).toLowerCase();
  if (['start_preparing', 'preparing', 'start'].includes(raw)) return 'start_preparing';
  if (['ready', 'ready_for_pickup', 'ready_for_rider', 'ready_for_collection'].includes(raw)) return 'ready';
  if (['mark_collected', 'collected', 'complete_pickup', 'completed'].includes(raw)) return 'mark_collected';
  if (['cancel', 'cancelled'].includes(raw)) return 'cancel';
  return '';
}

function nextStatusFor(action: WorkflowAction, currentStatus: string, fulfillment: string) {
  if (action === 'start_preparing') {
    if (!['PAID', 'READY_FOR_PICKUP', 'DISPATCHING'].includes(currentStatus)) return null;
    return 'PREPARING';
  }

  if (action === 'ready') {
    if (!['PAID', 'PREPARING'].includes(currentStatus)) return null;
    return fulfillment === 'PICKUP' ? 'READY_FOR_PICKUP' : 'DISPATCHING';
  }

  if (action === 'mark_collected') {
    if (fulfillment !== 'PICKUP') return null;
    if (!['READY_FOR_PICKUP'].includes(currentStatus)) return null;
    return 'COMPLETED';
  }

  if (action === 'cancel') {
    if (['DELIVERED', 'COMPLETED', 'CANCELLED', 'EXPIRED'].includes(currentStatus)) return null;
    return 'CANCELLED';
  }

  return null;
}

function eventKindForStatus(status: string, fulfillment: string) {
  if (status === 'PREPARING') return 'careport_order_preparing';
  if (status === 'READY_FOR_PICKUP') return 'careport_order_ready_for_pickup';
  if (status === 'DISPATCHING') return 'careport_order_ready_for_dispatch';
  if (status === 'COMPLETED' && fulfillment === 'PICKUP') return 'careport_order_collected';
  if (status === 'CANCELLED') return 'careport_order_cancelled';
  return '';
}

function jsonPayload(value: unknown) {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch {
    return String(value ?? '');
  }
}

async function clinicianIdForOrder(order: any) {
  const direct = clean(order?.clinicianId, 120);
  if (direct) return direct;

  const erxOrderId = clean(order?.erxOrderId, 120);
  if (!erxOrderId) return null;

  const erx = await (prisma as any).erxOrder
    ?.findUnique?.({ where: { id: erxOrderId }, select: { clinicianId: true } })
    .catch(() => null);

  return clean(erx?.clinicianId, 120) || null;
}

async function emitWorkflowEvent(args: {
  orgId: string;
  kind: string;
  order: any;
  pharmacyId: string;
  pharmacyName?: string | null;
  action: WorkflowAction;
  from: string;
  to: string;
  note?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
  correlationId: string;
}) {
  if (!args.kind) return;

  try {
    const clinicianId = await clinicianIdForOrder(args.order);
    const patientId = clean(args.order?.patientId, 120) || null;
    const encounterId = clean(args.order?.encounterId, 120) || null;
    const erxOrderId = clean(args.order?.erxOrderId, 120) || null;

    await (prisma as any).runtimeEvent.create({
      data: {
        ts: BigInt(Date.now()),
        kind: args.kind,
        encounterId,
        patientId,
        clinicianId,
        targetPatientId: patientId,
        targetClinicianId: clinicianId,
        targetAdmin: false,
        orgId: args.orgId,
        payload: jsonPayload({
          orderId: args.order.id,
          erxOrderId,
          encounterId,
          fulfillment: args.order.fulfillment,
          status: args.to,
          previousStatus: args.from,
          action: args.action,
          pharmacyId: args.pharmacyId,
          pharmacyName: args.pharmacyName || null,
          subtotalCents: args.order.subtotalCents ?? 0,
          deliveryFeeCents: args.order.deliveryFeeCents ?? 0,
          totalCents: args.order.totalCents ?? 0,
          itemCount: Array.isArray(args.order.items) ? args.order.items.length : undefined,
          note: args.note || null,
          actorId: args.actorId ?? null,
          actorRole: args.actorRole ?? null,
          correlationId: args.correlationId,
          generatedAt: new Date().toISOString(),
        }),
      },
    });
  } catch {
    // Notification delivery is best-effort; pharmacy workflow state must remain authoritative.
  }
}

export async function POST(req: NextRequest, { params }: { params: { orderId: string } }) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);
  const correlationId = correlationIdFromHeaders(req.headers);

  try {
    requireRole(who, ['admin', 'pharmacy', 'pharmacy_staff']);

    const orderId = clean(params.orderId, 120);
    if (!orderId) return json({ ok: false, error: 'orderId_required', correlationId }, 400);

    const pharmacyId = await resolvePharmacyId(req, who);
    if (!pharmacyId) return json({ ok: false, error: 'pharmacyId_unresolved', correlationId }, 409);

    const body = await req.json().catch(() => ({}));
    const action = normalizeAction(body?.action);
    const note = clean(body?.note, 1000) || null;
    const pickupCode = clean(body?.pickupCode, 80) || null;

    if (!action) return json({ ok: false, error: 'invalid_action', correlationId }, 400);

    const order = await (prisma as any).carePortOrder.findFirst({
      where: { id: orderId, orgId, chosenPharmacyId: pharmacyId },
      include: { assignment: true, chosenPharmacy: true, items: true },
    });

    if (!order) return json({ ok: false, error: 'order_not_found', correlationId }, 404);

    const nextStatus = nextStatusFor(action, String(order.status), String(order.fulfillment));
    if (!nextStatus) {
      return json(
        {
          ok: false,
          error: 'invalid_status_transition',
          currentStatus: order.status,
          fulfillment: order.fulfillment,
          action,
          correlationId,
        },
        409,
      );
    }

    const orderAny = order as any;
    const existingSnapshot =
      orderAny.sponsorPricingSnapshot && typeof orderAny.sponsorPricingSnapshot === 'object'
        ? orderAny.sponsorPricingSnapshot
        : {};

    const workflowEntry = {
      action,
      from: order.status,
      to: nextStatus,
      note,
      pickupCode: pickupCode ? 'provided' : null,
      actorId: who.uid ?? null,
      actorRole: who.role ?? null,
      at: new Date().toISOString(),
    };

    const updated = await (prisma as any).$transaction(async (tx: any) => {
      const o = await tx.carePortOrder.update({
        where: { id: orderId },
        data: {
          status: nextStatus,
          sponsorPricingSnapshot: {
            ...existingSnapshot,
            pharmacyWorkflow: {
              ...(existingSnapshot as any).pharmacyWorkflow,
              lastAction: workflowEntry,
              history: [
                ...(((existingSnapshot as any).pharmacyWorkflow?.history || []) as any[]).slice(-40),
                workflowEntry,
              ],
            },
          },
        } as any,
      });

      if (nextStatus === 'DISPATCHING' && order.fulfillment === 'DELIVERY') {
        await tx.carePortRiderAssignment.upsert({
          where: { orderId },
          update: {
            pharmacyId,
            status: order.assignment?.status || 'SEARCHING',
            dispatchStartedAt: order.assignment?.dispatchStartedAt || new Date(),
          },
          create: {
            orgId,
            orderId,
            pharmacyId,
            status: 'SEARCHING',
            dispatchStartedAt: new Date(),
          },
        });
      }

      let reservationTransition: any = null;

      if (nextStatus === 'COMPLETED' && order.fulfillment === 'PICKUP') {
        reservationTransition = await applyMarketplaceReservationTransition(tx, {
          orderId,
          action: 'capture',
          reason: 'pickup_completed',
          actorId: who.uid ?? null,
          actorRole: who.role ?? null,
        });
      }

      await tx.auditEvent.create({
        data: {
          kind: 'careport_pharmacy_order_status_updated',
          actorId: who.uid ?? null,
          actorRole: who.role ?? null,
          subjectId: orderId,
          meta: {
            orgId,
            pharmacyId,
            correlationId,
            action,
            from: order.status,
            to: nextStatus,
            fulfillment: order.fulfillment,
            hasNote: Boolean(note),
            hasPickupCode: Boolean(pickupCode),
          },
        },
      }).catch(() => null);

      return o;
    });

    const notificationKind = eventKindForStatus(nextStatus, String(order.fulfillment));
    await emitWorkflowEvent({
      orgId,
      kind: notificationKind,
      order: { ...order, status: nextStatus },
      pharmacyId,
      pharmacyName: order.chosenPharmacy?.name ?? null,
      action,
      from: String(order.status),
      to: nextStatus,
      note,
      actorId: who.uid ?? null,
      actorRole: who.role ?? null,
      correlationId,
    });

    return json({ ok: true, order: updated.order, action, status: nextStatus, notificationKind, marketplaceReservation: updated.marketplaceReservation, correlationId });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'pharmacy_order_status_update_failed', correlationId }, error?.status || 500);
  }
}
