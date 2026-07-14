// apps/api-gateway/app/api/webhooks/paystack/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as nodeCrypto from 'node:crypto';
import { prisma } from '@/src/lib/db';
import { getProvider } from '@/src/payments';
import {
  resolvePaymentReference,
  syncVerifiedPaymentToAppointment,
} from '@/src/payments/payment-sync';
// A5_G_E_B_PAYSTACK_TRANSFER_WEBHOOK_IMPORTS
import { shapePaystackTransferWebhook } from '@/src/payments/paystack-transfers';

export const dynamic = 'force-dynamic';

/** ---- HMAC verification (Paystack: sha512 over raw body) ---- */
function verifySignature(raw: string, signatureHex: string | null, secret?: string) {
  if (!secret || !signatureHex) return false;
  if (signatureHex.length % 2 !== 0) return false;
  let sigBuf: Buffer;
  try { sigBuf = Buffer.from(signatureHex, 'hex'); } catch { return false; }
  const calc = nodeCrypto.createHmac('sha512', secret).update(raw, 'utf8').digest();
  if (sigBuf.length !== calc.length) return false;
  try { return nodeCrypto.timingSafeEqual(sigBuf, calc); } catch { return false; }
}

/** ---- Refund policy: Clinician-level (admin minutes are separate) ---- */
type RefundsCfg = {
  within24hPercent: number;     // cancel < 24h
  noShowPercent: number;
  clinicianMissPercent: number; // clinician misses
  networkProrate: boolean;      // prorate remaining time on interruption
};

async function readClinicianRefunds(clinicianId: string): Promise<RefundsCfg> {
  const base: RefundsCfg = {
    within24hPercent: 50,
    noShowPercent: 0,
    clinicianMissPercent: 100,
    networkProrate: true,
  };
  const row = await prisma.clinicianRefundPolicy.findFirst({ where: { userId: clinicianId } });
  if (!row) return base;
  return {
    within24hPercent: Number.isFinite(row.within24hPercent) ? row.within24hPercent : base.within24hPercent,
    noShowPercent: Number.isFinite(row.noShowPercent) ? row.noShowPercent : base.noShowPercent,
    clinicianMissPercent: Number.isFinite(row.clinicianMissPercent) ? row.clinicianMissPercent : base.clinicianMissPercent,
    networkProrate: typeof row.networkProrate === 'boolean' ? row.networkProrate : base.networkProrate,
  };
}

function pctClamp(n: number) { return Math.max(0, Math.min(100, Math.round(n))); }

function computeRefundCents(
  kind: 'cancel_lt24h'|'no_show'|'clinician_miss'|'network_interrupted',
  priceCents: number,
  cfg: RefundsCfg,
  { elapsedMs, plannedMs }: { elapsedMs?: number; plannedMs?: number } = {}
) {
  switch (kind) {
    case 'cancel_lt24h':
      return Math.round(priceCents * pctClamp(cfg.within24hPercent) / 100);
    case 'no_show':
      return Math.round(priceCents * pctClamp(cfg.noShowPercent) / 100);
    case 'clinician_miss':
      return Math.round(priceCents * pctClamp(cfg.clinicianMissPercent) / 100);
    case 'network_interrupted': {
      if (!cfg.networkProrate || !plannedMs || elapsedMs == null) return 0;
      const served = Math.max(0, Math.min(1, elapsedMs / plannedMs));
      const unserved = 1 - served;
      return Math.round(priceCents * unserved);
    }
  }
}

/** Create an idempotent negative payment row to record refunds. */
async function recordRefundPayment(appt: any, cents: number, key: string, reason: string) {
  if (cents <= 0) return;

  const hash = nodeCrypto.createHash('sha1').update(`${appt.id}:${reason}:${key}`).digest('hex').slice(0, 10);
  const id = `rf-${hash}`;

  const exists = await prisma.payment.findUnique({ where: { id } }).catch(() => null);
  if (exists) return;

  await prisma.payment.create({
    data: {
      id,
      encounterId: appt.encounterId,
      caseId: appt.caseId,
      amountCents: -Math.abs(cents),
      currency: appt.currency || 'ZAR',
      status: 'captured',
      meta: JSON.stringify({ appointmentId: appt.id, reason }),
    },
  });
}


async function emitCarePortRuntimeEvent(args: {
  orgId: string;
  kind: string;
  orderId: string;
  patientId?: string | null;
  clinicianId?: string | null;
  encounterId?: string | null;
  payload?: Record<string, unknown>;
}) {
  try {
    await (prisma as any).runtimeEvent?.create?.({
      data: {
        ts: BigInt(Date.now()),
        kind: args.kind,
        encounterId: args.encounterId ?? null,
        patientId: args.patientId ?? null,
        clinicianId: args.clinicianId ?? null,
        payload: JSON.parse(JSON.stringify(args.payload ?? {})),
        targetPatientId: args.patientId ?? null,
        targetClinicianId: args.clinicianId ?? null,
        targetAdmin: true,
        orgId: args.orgId,
      },
    });
  } catch {
    // best-effort
  }
}

async function clinicianIdForCarePortOrder(order: any) {
  const orderAny = order as any;
  if (orderAny.clinicianId) return String(orderAny.clinicianId);

  if (orderAny.erxOrderId) {
    const erx = await (prisma as any).erxOrder?.findUnique?.({
      where: { id: String(orderAny.erxOrderId) },
      select: { clinicianId: true },
    });
    if (erx?.clinicianId) return String(erx.clinicianId);
  }

  if (order?.encounterId) {
    const encounter = await (prisma as any).encounter?.findUnique?.({
      where: { id: String(order.encounterId) },
      select: { clinicianId: true },
    });
    if (encounter?.clinicianId) return String(encounter.clinicianId);
  }

  return null;
}

/** ----- CarePort: reconcile provider payment intent + order state ----- */
async function handleCarePortChargeSuccess(reference: string, data: any, rawEvent: any) {
  if (!reference) return false;

  const intent = await (prisma as any).carePortPaymentIntent?.findFirst?.({
    where: {
      OR: [
        { providerRef: reference },
        { idempotencyKey: reference },
        { id: reference },
      ],
    },
    include: {
      order: true,
    },
  });

  if (!intent?.order) return false;

  const paidAt = data?.paid_at ? new Date(String(data.paid_at)) : new Date();
  const amountCents = typeof data?.amount === 'number' ? Math.round(data.amount) : Number(data?.amount || intent.amountCents || 0);
  const currency = String(data?.currency || intent.currency || 'ZAR').toUpperCase();

  if (intent.amountCents != null && amountCents > 0 && Number(intent.amountCents) !== amountCents) {
    throw new Error(`CarePort amount mismatch (paid ${amountCents} vs expected ${intent.amountCents})`);
  }

  if (currency && String(intent.currency || 'ZAR').toUpperCase() !== currency) {
    throw new Error(`CarePort currency mismatch (paid ${currency} vs expected ${intent.currency})`);
  }

  await prisma.$transaction(async (tx) => {
    await (tx as any).carePortPaymentIntent.update({
      where: { id: intent.id },
      data: {
        status: 'SUCCEEDED',
        providerStatus: 'SUCCEEDED',
        providerRef: reference,
        providerPayload: rawEvent,
        paidAt,
      },
    });

    if (intent.order.status !== 'PAID') {
      await tx.carePortOrder.update({
        where: { id: intent.order.id },
        data: {
          status: 'PAID',
          settlementStatus: (intent.order as any).settlementStatus || 'UNSETTLED',
        } as any,
      });
    }

    await tx.auditEvent.create({
      data: {
        kind: 'careport_payment_reconciled',
        actorId: null,
        actorRole: 'system',
        subjectId: intent.order.id,
        meta: {
          provider: 'paystack',
          reference,
          paymentIntentId: intent.id,
          amountCents,
          currency,
        },
        at: new Date(),
      },
    }).catch(() => {});
  });

  const refreshed = await prisma.carePortOrder.findUnique({
    where: { id: intent.order.id },
    include: { chosenPharmacy: true, items: true },
  });

  const clinicianId = refreshed ? await clinicianIdForCarePortOrder(refreshed) : null;
  if (refreshed && clinicianId) {
    await emitCarePortRuntimeEvent({
      orgId: refreshed.orgId || 'org-default',
      kind: 'careport_erx_purchased',
      orderId: refreshed.id,
      patientId: refreshed.patientId ?? null,
      clinicianId,
      encounterId: refreshed.encounterId ?? null,
      payload: {
        orderId: refreshed.id,
        paymentIntentId: intent.id,
        provider: 'paystack',
        reference,
        status: refreshed.status,
        fulfillment: refreshed.fulfillment,
        pharmacyId: refreshed.chosenPharmacyId ?? null,
        pharmacyName: refreshed.chosenPharmacy?.name ?? null,
        totalCents: refreshed.totalCents ?? 0,
        currency: refreshed.currency ?? 'ZAR',
        purchasedAt: paidAt.toISOString(),
        source: 'paystack.webhook',
      },
    });
  }

  return true;
}


/** ----- Shop: mark order paid + decrement stock (idempotent) ----- */
async function handleShopChargeSuccess(reference: string, data: any) {
  await prisma.$transaction(async (tx) => {
    // Order reference could be stored in sessionId OR be equal to id (depending on your init)
    let order = await tx.shopOrder.findFirst({
      where: { sessionId: reference },
      include: { items: true },
    });

    if (!order) {
      order = await tx.shopOrder.findUnique({
        where: { id: reference },
        include: { items: true },
      }) as any;
    }

    if (!order) return; // not a shop payment

    // Idempotency: Paystack retries
    if (order.status === 'PAID') return;

    // Optional amount safety: Paystack amount is "kobo"/cents
    const paidAmountZar = typeof data?.amount === 'number' ? Math.round(data.amount / 100) : null;
    const paidCurrency = String(data?.currency || order.currency || 'ZAR');
    if (paidAmountZar !== null && paidAmountZar !== order.totalZar) {
      throw new Error(`Shop amount mismatch (paid ${paidAmountZar} vs expected ${order.totalZar})`);
    }
    if (paidCurrency && paidCurrency !== order.currency) {
      throw new Error(`Shop currency mismatch (paid ${paidCurrency} vs expected ${order.currency})`);
    }

    // Decrement inventory for tracked variants
    for (const it of order.items) {
      if (!it.variantId) continue;

      const variant = await tx.shopVariant.findUnique({
        where: { id: it.variantId },
        include: { product: true },
      });

      if (!variant) continue;

      // If stock is untracked, skip
      if (variant.stockQty == null) continue;

      const allowBackorder = variant.allowBackorder ?? variant.product.allowBackorder;
      const nextQty = (variant.stockQty ?? 0) - it.quantity;

      if (!allowBackorder && nextQty < 0) {
        throw new Error(`Insufficient stock for SKU ${variant.sku}`);
      }

      await tx.shopVariant.update({
        where: { id: variant.id },
        data: { stockQty: nextQty },
      });

      await tx.shopInventoryMovement.create({
        data: {
          variantId: variant.id,
          delta: -it.quantity,
          reason: 'sale',
          note: `Order ${order.id}`,
        },
      });
    }

    const paidAt = data?.paid_at ? new Date(String(data.paid_at)) : new Date();

    await tx.shopOrder.update({
      where: { id: order.id },
      data: {
        status: 'PAID',
        paidAt,
        // Paystack doesn't always give a receipt URL; keep meta for receipts page aggregation
        providerMeta: {
          ...(order.providerMeta as any),
          paystack: {
            id: data?.id ?? null,
            reference: data?.reference ?? null,
            channel: data?.channel ?? null,
            paid_at: data?.paid_at ?? null,
            gateway_response: data?.gateway_response ?? null,
            authorization: data?.authorization ?? null,
            customer: data?.customer ?? null,
          },
        },
      },
    });

    await tx.auditEvent.create({
      data: {
        kind: 'shop_order_paid',
        actorId: null,
        actorRole: 'system',
        subjectId: order.id,
        meta: { reference },
        at: new Date(),
      },
    }).catch(() => {});
  });
}


// A5_G_E_B_PAYSTACK_TRANSFER_WEBHOOK_RECONCILIATION
function a5geJsonObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function a5geText(value: unknown, max = 512) {
  const raw = value === undefined || value === null ? '' : String(value);
  return raw.trim().slice(0, max);
}

function a5geMedReachPayoutStatusFromTransfer(event: string, transferStatus: string) {
  const normalizedEvent = a5geText(event, 120).toLowerCase();
  const normalizedStatus = a5geText(transferStatus, 80).toLowerCase();

  if (normalizedEvent === 'transfer.success' || normalizedStatus === 'success') return 'PAID';

  if (
    normalizedEvent === 'transfer.failed' ||
    normalizedEvent === 'transfer.reversed' ||
    normalizedEvent === 'transfer.abandoned' ||
    normalizedStatus === 'failed' ||
    normalizedStatus === 'reversed' ||
    normalizedStatus === 'abandoned'
  ) {
    return 'FAILED';
  }

  return 'PENDING';
}

function a5geTransferFailureReason(rawEvent: any) {
  const data = a5geJsonObject(rawEvent?.data);

  return (
    a5geText(data.reason, 1000) ||
    a5geText(data.failure_reason, 1000) ||
    a5geText(data.message, 1000) ||
    a5geText(rawEvent?.message, 1000) ||
    null
  );
}

async function handleMedReachPaystackTransferWebhook(rawEvent: any) {
  const event = a5geText(rawEvent?.event || rawEvent?.type, 120);
  const shaped = shapePaystackTransferWebhook(rawEvent);

  const reference =
    a5geText(shaped.reference, 180) ||
    a5geText(rawEvent?.data?.reference, 180) ||
    a5geText(rawEvent?.reference, 180);

  const transferCode =
    a5geText(shaped.transferCode, 180) ||
    a5geText(rawEvent?.data?.transfer_code || rawEvent?.data?.transferCode, 180);

  const delegate = (prisma as any).medReachPayout;

  if (!delegate?.findFirst || !delegate?.findMany || !delegate?.update) {
    return {
      handled: false,
      reason: 'medreach_payout_delegate_unavailable',
      event,
      reference,
      transferCode,
    };
  }

  if (!reference && !transferCode) {
    return {
      handled: false,
      reason: 'missing_transfer_reference',
      event,
      status: shaped.status,
    };
  }

  let payout: any = reference
    ? await delegate.findFirst({
        where: {
          payoutRef: reference,
        },
      })
    : null;

  if (!payout && transferCode) {
    const candidates = await delegate.findMany({
      take: 200,
      orderBy: { createdAt: 'desc' },
    }).catch(() => []);

    payout = candidates.find((row: any) => {
      const meta = a5geJsonObject(row?.meta);
      const transfer = a5geJsonObject(meta.paystackTransfer);

      return (
        a5geText(transfer.transferCode, 180) === transferCode ||
        (!!reference && a5geText(transfer.reference, 180) === reference)
      );
    });
  }

  if (!payout) {
    return {
      handled: false,
      reason: 'medreach_payout_not_found',
      event,
      reference,
      transferCode,
      status: shaped.status,
    };
  }

  const currentMeta = a5geJsonObject(payout.meta);
  const currentTransfer = a5geJsonObject(currentMeta.paystackTransfer);
  const nextStatus = a5geMedReachPayoutStatusFromTransfer(event, shaped.status);
  const receivedAt = new Date().toISOString();
  const failureReason = nextStatus === 'FAILED' ? a5geTransferFailureReason(rawEvent) || 'paystack_transfer_failed' : null;

  const nextMeta: any = {
    ...currentMeta,
    paystackTransfer: {
      ...currentTransfer,
      provider: 'paystack',
      reference: reference || a5geText(currentTransfer.reference, 180) || payout.payoutRef || null,
      transferCode: transferCode || a5geText(currentTransfer.transferCode, 180) || null,
      recipientCode: shaped.recipientCode || a5geText(currentTransfer.recipientCode, 180) || null,
      status: shaped.status || a5geText(currentTransfer.status, 80) || null,
      amountCents: shaped.amountCents ?? currentTransfer.amountCents ?? null,
      currency: shaped.currency || currentTransfer.currency || payout.currency || 'ZAR',
      lastWebhookAt: receivedAt,
      webhook: {
        event,
        reference: reference || null,
        transferCode: transferCode || null,
        recipientCode: shaped.recipientCode || null,
        status: shaped.status,
        amountCents: shaped.amountCents ?? null,
        currency: shaped.currency || null,
        receivedAt,
        raw: rawEvent,
      },
    },
    paystackTransferWebhook: {
      event,
      reference: reference || null,
      transferCode: transferCode || null,
      status: shaped.status,
      receivedAt,
    },
  };

  if (failureReason) {
    nextMeta.failureReason = failureReason;
    nextMeta.paystackTransfer.failureReason = failureReason;
  }

  if (nextStatus === 'PAID') {
    nextMeta.paidAt = receivedAt;
    nextMeta.paystackTransfer.paidAt = receivedAt;
  }

  if (nextStatus === 'FAILED') {
    nextMeta.failedAt = receivedAt;
    nextMeta.paystackTransfer.failedAt = receivedAt;
  }

  const updateData: any = {
    status: nextStatus as any,
    meta: nextMeta,
  };

  if (reference && !payout.payoutRef) {
    updateData.payoutRef = reference;
  }

  const updated = await delegate.update({
    where: { id: payout.id },
    data: updateData,
  });

  await (prisma as any).auditEvent?.create?.({
    data: {
      kind: 'medreach_paystack_transfer_webhook_reconciled',
      actorId: null,
      actorRole: 'system',
      subjectId: payout.id,
      meta: {
        event,
        reference: reference || null,
        transferCode: transferCode || null,
        status: shaped.status,
        payoutStatus: nextStatus,
      },
      at: new Date(),
    },
  }).catch(() => null);

  return {
    handled: true,
    event,
    payoutId: payout.id,
    reference: reference || payout.payoutRef || null,
    transferCode: transferCode || null,
    paystackStatus: shaped.status,
    payoutStatus: nextStatus,
    updatedId: updated?.id || payout.id,
  };
}

/** ---- Main webhook ---- */
export async function POST(req: NextRequest) {
  const raw = await req.text();

  // Signature check (fail-close in production; allow bypass in dev).
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
  const okSig = verifySignature(raw, req.headers.get('x-paystack-signature'), secret);
  if (!okSig && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'bad_signature' }, { status: 401 });
  }

  // Parse JSON body
  let body: any = null;
  try { body = JSON.parse(raw); } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  const event = String(body?.event || body?.type || '');
  const data  = body?.data || {};
  const reference: string = String(data?.reference || body?.reference || '');

  if (event.startsWith('transfer.')) {
    try {
      const transferResult = await handleMedReachPaystackTransferWebhook(body);
      return NextResponse.json({
        ok: true,
        kind: 'medreach_transfer',
        ...transferResult,
      });
    } catch (e: any) {
      console.error('[paystack][medreach-transfer] error', e);
      return NextResponse.json({
        ok: true,
        kind: 'medreach_transfer_failed',
        error: e?.message || 'medreach_transfer_failed',
      });
    }
  }

  // === Appointment mapping by provider reference, payment row metadata, or embedded appointment ID ===
  const resolvedPayment = reference
    ? await resolvePaymentReference(reference)
    : { appointment: null };
  const appt = resolvedPayment.appointment;

  // === Provider capture ===
  if (event === 'charge.success') {
    // 1) CarePort payment success
    if (reference) {
      try {
        const handledCarePort = await handleCarePortChargeSuccess(reference, data, body);
        if (handledCarePort) return NextResponse.json({ ok: true, kind: 'careport' });
      } catch (e: any) {
        console.error('[paystack][careport] error', e);
        return NextResponse.json({ ok: true, kind: 'careport_failed', error: e?.message || 'careport_failed' });
      }
    }

    // 2) Appointment payment success
    if (reference && appt) {
      const amountCents =
        typeof data?.amount === 'number'
          ? Math.round(data.amount)
          : Number(data?.amount || appt.priceCents || 0);

      const currency = String(data?.currency || appt.currency || 'ZAR').toUpperCase();

      const synced = await syncVerifiedPaymentToAppointment({
        reference,
        provider: 'paystack',
        state: 'captured',
        amountCents,
        currency,
        raw: body,
      });

      return NextResponse.json({
        ok: true,
        kind: 'appointment',
        appointmentId: synced.appointment?.id ?? appt.id,
        paymentId: synced.payment.id,
      });
    }

    // 3) Shop order payment success
    if (reference) {
      try {
        await handleShopChargeSuccess(reference, data);
        return NextResponse.json({ ok: true, kind: 'shop' });
      } catch (e: any) {
        // still ack to avoid infinite retries; ops can reconcile
        console.error('[paystack][shop] error', e);
        return NextResponse.json({ ok: true, kind: 'shop_failed', error: e?.message || 'shop_failed' });
      }
    }

    return NextResponse.json({ ok: true, kind: 'unknown_reference' });
  }

  // If not appointment and not charge.success, we ignore shop and keep your appointment ops events:
  if (!appt) return NextResponse.json({ ok: true, info: 'no_appointment_for_reference' });

  // === Ops-driven events (your backend can POST these) ===
  const kind = String(body?.kind || '');
  const isOpsEvent = [
    'event.cancel',
    'event.no_show',
    'event.clinician_miss',
    'event.network_interrupted',
  ].includes(kind);

  if (isOpsEvent) {
    const refunds = await readClinicianRefunds(appt.clinicianId);

    let refundKind: 'cancel_lt24h'|'no_show'|'clinician_miss'|'network_interrupted' = 'cancel_lt24h';
    if (kind === 'event.no_show') refundKind = 'no_show';
    else if (kind === 'event.clinician_miss') refundKind = 'clinician_miss';
    else if (kind === 'event.network_interrupted') refundKind = 'network_interrupted';

    const now = Date.now();
    const startMs = new Date(appt.startsAt as any).getTime();
    const within24h = (startMs - now) <= 24 * 60 * 60 * 1000;
    if (refundKind === 'cancel_lt24h' && !within24h) {
      return NextResponse.json({ ok: true, info: 'cancel_ge24h_no_refund' });
    }

    const elapsedMin = Number(body?.minutes_used ?? body?.elapsed_minutes);
    const totalMin   = Number(body?.total_minutes ?? body?.planned_minutes);
    const plannedMs  = Number.isFinite(totalMin) ? totalMin * 60_000 : undefined;
    const elapsedMs  = Number.isFinite(elapsedMin) ? elapsedMin * 60_000 : undefined;

    const refundCents = computeRefundCents(refundKind, appt.priceCents, refunds, { elapsedMs, plannedMs });

    if (refundCents > 0 && reference) {
      try {
        const provider = getProvider();
        await provider.refund(reference, refundCents);
      } catch {
        // best-effort
      }
    }

    await recordRefundPayment(appt, refundCents, reference || kind, refundKind);

    if (kind === 'event.cancel' && appt.status !== 'canceled') {
      await prisma.appointment.update({ where: { id: appt.id }, data: { status: 'canceled' } }).catch(()=>{});
    }

    await prisma.auditEvent.create({
      data: {
        kind: 'payment_refunded',
        actorId: null,
        actorRole: 'system',
        subjectId: appt.id,
        meta: JSON.stringify({ provider: 'paystack', reference, refundCents, reason: refundKind }),
      },
    }).catch(() => {});

    return NextResponse.json({ ok: true, refund_cents: refundCents });
  }

  return NextResponse.json({ ok: true });
}
