// apps/patient-app/app/api/appointments/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { hashCode, normalizeCode, holdWallet } from '../../../../lib/wallet.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function uidFromReq(req: NextRequest) {
  const h = String(req.headers.get('x-uid') || '').trim();
  if (h) return h;
  if (process.env.NODE_ENV !== 'production') return 'demo-patient';
  return '';
}

function randTx() {
  return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
}

function clampInt(n: any, def = 0) {
  const x = Math.trunc(Number(n));
  return Number.isFinite(x) ? x : def;
}

export async function POST(req: NextRequest) {
  const uid = uidFromReq(req);
  if (!uid) return NextResponse.json({ ok: false, error: 'Missing x-uid.' }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));

  const encounterId = String(body?.encounterId || '').trim();
  const caseId = String(body?.caseId || '').trim();
  const clinicianId = String(body?.clinicianId || '').trim();
  if (!encounterId || !caseId || !clinicianId) {
    return NextResponse.json({ ok: false, error: 'Missing encounterId/caseId/clinicianId.' }, { status: 400 });
  }

  const startsAt = new Date(body?.startsAt || '');
  const endsAt = new Date(body?.endsAt || '');
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
    return NextResponse.json({ ok: false, error: 'Invalid time range.' }, { status: 400 });
  }

  const priceZar = Math.max(0, clampInt(body?.priceZar, 0));
  if (!priceZar) return NextResponse.json({ ok: false, error: 'Missing priceZar.' }, { status: 400 });

  const paymentMethod = String(body?.paymentMethod || 'wallet').toLowerCase();
  const voucherCodeRaw = normalizeCode(body?.voucherCode || '');
  const tx = randTx();

  // Voucher path: only FREE_CONSULT / appointment-only vouchers are allowed here
  if (voucherCodeRaw) {
    const v = await prisma.voucherCode.findUnique({ where: { codeHash: hashCode(voucherCodeRaw) } });
    if (!v || !v.active) return NextResponse.json({ ok: false, error: 'Invalid voucher.' }, { status: 404 });

    const now = new Date();
    if (v.expiresAt && now > v.expiresAt) return NextResponse.json({ ok: false, error: 'Voucher expired.' }, { status: 400 });
    if (v.usedCount >= v.maxUses) return NextResponse.json({ ok: false, error: 'Voucher already used.' }, { status: 400 });

    const c = (v.constraints || {}) as any;
    const scopes: string[] = Array.isArray(c?.scopes) ? c.scopes : [];
    const appointmentAllowed = v.kind === 'FREE_CONSULT' || scopes.includes('APPOINTMENT');

    if (!appointmentAllowed) {
      return NextResponse.json({ ok: false, error: 'This voucher is not valid for appointments.' }, { status: 400 });
    }

    // optional anti-farming: 1 clinician voucher per patient per 90 days
    if (v.sponsorType === 'CLINICIAN') {
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const recent = await prisma.voucherRedemption.findFirst({
        where: { userId: uid, redeemedAt: { gte: since } },
        orderBy: { redeemedAt: 'desc' },
      });
      if (recent) {
        return NextResponse.json(
          { ok: false, error: 'You recently used a promo. Please try again later.' },
          { status: 400 }
        );
      }
    }

    // We do not “credit wallet” here; this is an appointment-only voucher checkout.
    await prisma.payment.create({
      data: {
        id: tx,
        encounterId,
        caseId,
        amountCents: priceZar * 100,
        currency: 'ZAR',
        status: 'initiated',
        meta: {
          method: 'voucher',
          voucherId: v.id,
          sponsorType: v.sponsorType,
          sponsorId: v.sponsorId,
          voucherLast4: v.codeLast4,
        },
        orgId: 'org-default',
      },
    });

    return NextResponse.json({
      ok: true,
      tx,
      mode: 'voucher',
      totalZar: 0,
      note: 'Voucher applied. Confirm to finalize booking.',
    });
  }

  // Wallet path
  if (paymentMethod !== 'wallet') {
    return NextResponse.json({ ok: false, error: 'Only wallet checkout is wired in this demo path.' }, { status: 400 });
  }

  const hold = await holdWallet({
    userId: uid,
    amountZar: priceZar,
    scope: 'APPOINTMENT',
    txRef: `appt:${tx}`,
    refType: 'appointment',
    refId: encounterId,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  }).catch(() => null);

  if (!hold) return NextResponse.json({ ok: false, error: 'Insufficient wallet credit.' }, { status: 400 });

  await prisma.payment.create({
    data: {
      id: tx,
      encounterId,
      caseId,
      amountCents: priceZar * 100,
      currency: 'ZAR',
      status: 'initiated',
      meta: { method: 'wallet', holdId: hold.id, clinicianId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() },
      orgId: 'org-default',
    },
  });

  return NextResponse.json({ ok: true, tx, mode: 'wallet', totalZar: priceZar });
}
