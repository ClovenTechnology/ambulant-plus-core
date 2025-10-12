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
  // Defaults if no explicit policy
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

  // make an idempotent id using appointment + reason + key
  const hash = nodeCrypto.createHash('sha1').update(`${appt.id}:${reason}:${key}`).digest('hex').slice(0, 10);
  const id = `rf-${hash}`;

  // If already exists, skip
  const exists = await prisma.payment.findUnique({ where: { id } }).catch(() => null);
  if (exists) return;

  await prisma.payment.create({
    data: {
      id,
      encounterId: appt.encounterId,
      caseId: appt.caseId,
      amountCents: -Math.abs(cents), // negative captured payment to offset payout sums
      currency: appt.currency || 'ZAR',  // ← fallback to ZAR
      status: 'captured',
      meta: JSON.stringify({ appointmentId: appt.id, reason }),
    },
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

  // Paystack canonical fields
  const event = String(body?.event || body?.type || ''); // e.g., 'charge.success'
  const data  = body?.data || {};
  const reference: string = String(data?.reference || body?.reference || '');

  // Find appointment mapped by paymentRef
  const appt = reference
    ? await prisma.appointment.findFirst({ where: { paymentRef: reference } })
    : null;

  // Not our payment? Acknowledge to avoid retries; ops can reconcile later.
  if (!appt) return NextResponse.json({ ok: true, info: 'no_appointment_for_reference' });

  // === Provider capture ===
  if (event === 'charge.success') {
    if (appt.status !== 'confirmed') {
      await prisma.appointment.update({ where: { id: appt.id }, data: { status: 'confirmed' } });
    }

    // Audit
    await prisma.auditEvent.create({
      data: {
        kind: 'payment_captured',
        actorId: null,
        actorRole: 'system',
        subjectId: appt.id,
        meta: JSON.stringify({ provider: 'paystack', reference }),
      },
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  }

  // === Ops-driven events (your backend can POST these) ===
  // Supported kinds: event.cancel, event.no_show, event.clinician_miss, event.network_interrupted
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

    // cancel <24h needs timing check
    const now = Date.now();
    const startMs = new Date(appt.startsAt as any).getTime();
    const within24h = (startMs - now) <= 24 * 60 * 60 * 1000;
    if (refundKind === 'cancel_lt24h' && !within24h) {
      // If not within 24h, treat as no refund (you can expand policy later).
      return NextResponse.json({ ok: true, info: 'cancel_ge24h_no_refund' });
    }

    // For network prorate, caller may send minutes used/total
    const elapsedMin = Number(body?.minutes_used ?? body?.elapsed_minutes);
    const totalMin   = Number(body?.total_minutes ?? body?.planned_minutes);
    const plannedMs  = Number.isFinite(totalMin) ? totalMin * 60_000 : undefined;
    const elapsedMs  = Number.isFinite(elapsedMin) ? elapsedMin * 60_000 : undefined;

    const refundCents = computeRefundCents(refundKind, appt.priceCents, refunds, { elapsedMs, plannedMs });

    // Attempt provider refund (best effort)
    if (refundCents > 0 && reference) {
      try {
        const provider = getProvider();
        await provider.refund(reference, refundCents);
      } catch {
        // swallow; we'll still write our internal record so ops can reconcile
      }
    }

    // Record internal negative payment so payout sums net correctly
    await recordRefundPayment(appt, refundCents, reference || kind, refundKind);

    // Optional appointment status tweak for cancel
    if (kind === 'event.cancel' && appt.status !== 'canceled') {
      await prisma.appointment.update({ where: { id: appt.id }, data: { status: 'canceled' } }).catch(()=>{});
    }

    // Audit
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

  // Ignore other events but ack
  return NextResponse.json({ ok: true });
}
