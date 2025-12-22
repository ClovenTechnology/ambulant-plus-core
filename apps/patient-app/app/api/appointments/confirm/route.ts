// apps/patient-app/app/api/appointments/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '../../../../lib/prisma';
import { captureHold, holdWallet } from '../../../../lib/wallet.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLATFORM_PCT = Number(process.env.APPT_PLATFORM_PCT ?? '0.30');

function feeSplit(priceCents: number) {
  const platformFee = Math.max(0, Math.round(priceCents * PLATFORM_PCT));
  const clinicianTake = Math.max(0, priceCents - platformFee);
  return { platformFee, clinicianTake };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const tx = String(body?.tx || '').trim();
  const clinicianId = String(body?.clinicianId || '').trim();
  const patientId = String(body?.patientId || 'demo-patient').trim();
  const encounterId = String(body?.encounterId || '').trim();
  const caseId = String(body?.caseId || '').trim();

  const startsAt = new Date(body?.startsAt || '');
  const endsAt = new Date(body?.endsAt || '');

  if (!tx || !clinicianId || !encounterId || !caseId) {
    return NextResponse.json({ ok: false, error: 'Missing tx/clinicianId/encounterId/caseId.' }, { status: 400 });
  }
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
    return NextResponse.json({ ok: false, error: 'Invalid time range.' }, { status: 400 });
  }

  const pay = await prisma.payment.findUnique({ where: { id: tx } });
  if (!pay) return NextResponse.json({ ok: false, error: 'Payment not found.' }, { status: 404 });
  if (pay.status === 'captured') {
    return NextResponse.json({ ok: true, already: true, tx, status: 'captured' });
  }

  const meta = (pay.meta || {}) as any;
  const method = String(meta?.method || '').toLowerCase();

  const priceCents = pay.amountCents;
  const { platformFee, clinicianTake } = feeSplit(priceCents);

  let finalClinicianTake = clinicianTake;
  let finalPlatformFee = platformFee;

  if (method === 'wallet') {
    const holdId = String(meta?.holdId || '');
    if (!holdId) return NextResponse.json({ ok: false, error: 'Missing wallet hold.' }, { status: 400 });
    await captureHold(holdId, { reason: 'appt_confirm', tx, encounterId });
  }

  if (method === 'voucher') {
    const voucherId = String(meta?.voucherId || '');
    if (!voucherId) return NextResponse.json({ ok: false, error: 'Missing voucherId.' }, { status: 400 });

    const v = await prisma.voucherCode.findUnique({ where: { id: voucherId } });
    if (!v || !v.active) return NextResponse.json({ ok: false, error: 'Voucher invalid.' }, { status: 400 });
    if (v.usedCount >= v.maxUses) return NextResponse.json({ ok: false, error: 'Voucher already used.' }, { status: 400 });

    // payout rule:
    // PLATFORM-sponsored: normal split
    // CLINICIAN-sponsored: clinician payout = 0; clinician pays platform fee (debited/held)
    if (v.sponsorType === 'CLINICIAN') {
      finalClinicianTake = 0;

      // capture sponsor hold if present, otherwise try to hold+capture the platform fee on sponsor wallet
      const sponsorId = String(v.sponsorId || '').trim();
      if (!sponsorId) return NextResponse.json({ ok: false, error: 'Voucher missing sponsor clinician.' }, { status: 400 });

      if (v.sponsorHoldId) {
        await captureHold(v.sponsorHoldId, { reason: 'clinician_voucher_fee', tx, encounterId });
      } else {
        const h = await holdWallet({
          userId: sponsorId,
          amountZar: Math.round(finalPlatformFee / 100), // convert cents -> zar approx
          scope: 'APPOINTMENT',
          txRef: `clinfee:${tx}`,
          refType: 'voucher',
          refId: v.id,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        }).catch(() => null);

        if (!h) return NextResponse.json({ ok: false, error: 'Clinician promo budget insufficient.' }, { status: 400 });
        await captureHold(h.id, { reason: 'clinician_voucher_fee', tx, voucherId: v.id });
      }
    }

    // mark voucher used + redemption record
    await prisma.voucherCode.update({ where: { id: v.id }, data: { usedCount: { increment: 1 } } });
    await prisma.voucherRedemption.create({
      data: {
        voucherId: v.id,
        userId: patientId,
        creditedZar: 0,
        meta: { tx, encounterId, caseId },
        orgId: v.orgId,
      },
    });
  }

  // create appointment
  const apptId = crypto.randomUUID();

  await prisma.appointment.create({
    data: {
      id: apptId,
      encounterId,
      sessionId: tx,
      caseId,
      clinicianId,
      patientId,
      startsAt,
      endsAt,
      status: 'confirmed',
      priceCents: priceCents,
      currency: pay.currency,
      platformFeeCents: finalPlatformFee,
      clinicianTakeCents: finalClinicianTake,
      paymentProvider: method === 'wallet' ? 'wallet' : method === 'voucher' ? 'voucher' : 'manual',
      paymentRef: tx,
      meta: JSON.stringify({ method, tx }),
      orgId: 'org-default',
    },
  });

  await prisma.payment.update({
    where: { id: tx },
    data: { status: 'captured', updatedAt: new Date(), meta: { ...(pay.meta as any), capturedAt: new Date().toISOString() } },
  });

  return NextResponse.json({
    ok: true,
    appointmentId: apptId,
    tx,
    payout: { platformFeeCents: finalPlatformFee, clinicianTakeCents: finalClinicianTake },
  });
}
