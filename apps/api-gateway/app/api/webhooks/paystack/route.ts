// apps/api-gateway/app/api/webhooks/paystack/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as nodeCrypto from 'node:crypto';
import { prisma } from '@/src/lib/db';
import { getProvider } from '@/src/payments';

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

  // === Appointment mapping by paymentRef ===
  const appt = reference
    ? await prisma.appointment.findFirst({ where: { paymentRef: reference } })
    : null;

  // === Provider capture ===
  if (event === 'charge.success') {
    // 1) Appointment payment success
    if (appt) {
      if (appt.status !== 'confirmed') {
        await prisma.appointment.update({ where: { id: appt.id }, data: { status: 'confirmed' } });
      }

      await prisma.auditEvent.create({
        data: {
          kind: 'payment_captured',
          actorId: null,
          actorRole: 'system',
          subjectId: appt.id,
          meta: JSON.stringify({ provider: 'paystack', reference }),
        },
      }).catch(() => {});

      return NextResponse.json({ ok: true, kind: 'appointment' });
    }

    // 2) Shop order payment success (NEW)
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
