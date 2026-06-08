// apps/api-gateway/app/api/admin/clinicians/onboarding/confirm-payment/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getClinicianOnboardingSettings } from '@/src/clinicians/onboarding/settings';
import { verifyAdminRequest } from '../../../utils/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanStr(value: unknown, max = 500): string | null {
  const s = String(value ?? '').trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function parseDate(value: unknown): Date | null {
  const s = cleanStr(value, 80);
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

function amountFromBody(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n));
}

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await verifyAdminRequest(req);
    if (isAdmin.ok === false) return isAdmin.response;

    const body = (await req.json().catch(() => ({}))) as any;
    const clinicianId = cleanStr(body.clinicianId, 120);
    const slotId = cleanStr(body.slotId || body.trainingSlotId, 120);
    const paymentReference = cleanStr(body.paymentReference || body.reference, 180);
    const payerName = cleanStr(body.payerName, 240);
    const originBank = cleanStr(body.originBank, 240);
    const proofOfPaymentUrl = cleanStr(body.proofOfPaymentUrl, 1000);
    const paymentDate = parseDate(body.paymentDate) || new Date();
    const provider = cleanStr(body.provider || body.paymentMethod || 'eft', 40)?.toLowerCase() || 'eft';

    if (!clinicianId) return NextResponse.json({ ok: false, error: 'clinicianId_required' }, { status: 400 });
    if (!slotId) return NextResponse.json({ ok: false, error: 'slotId_required' }, { status: 400 });
    if (!paymentReference) return NextResponse.json({ ok: false, error: 'paymentReference_required' }, { status: 400 });
    if (!payerName) return NextResponse.json({ ok: false, error: 'payerName_required' }, { status: 400 });

    const settings = await getClinicianOnboardingSettings();
    if (!settings.manualPaymentEnabled) {
      return NextResponse.json({ ok: false, error: 'manual_payment_disabled' }, { status: 409 });
    }
    if (settings.trainingFeeCents <= 0) {
      return NextResponse.json({ ok: false, error: 'training_fee_not_configured' }, { status: 409 });
    }

    const amountCents = amountFromBody(body.amountCents) ?? settings.trainingFeeCents;
    const currency = cleanStr(body.currency || settings.currency, 8)?.toUpperCase() || settings.currency;

    const clinician = await prisma.clinicianProfile.findUnique({ where: { id: clinicianId } });
    if (!clinician) return NextResponse.json({ ok: false, error: 'clinician_not_found' }, { status: 404 });

    const slot = await prisma.clinicianTrainingSlot.findUnique({ where: { id: slotId } });
    if (!slot) return NextResponse.json({ ok: false, error: 'training_slot_not_found' }, { status: 404 });

    const onboarding = await prisma.clinicianOnboarding.upsert({
      where: { clinicianId },
      update: {},
      create: { clinicianId, status: 'pending', depositPaid: false },
    });

    const adminUid = cleanStr((isAdmin as any)?.uid || (isAdmin as any)?.userId || body.confirmedByUserId, 120);

    const payment = await prisma.clinicianOnboardingPayment.create({
      data: {
        clinicianId,
        onboardingId: onboarding.id,
        amountCents,
        currency,
        provider: provider === 'manual' || provider === 'manual_bank_transfer' ? 'manual' : 'eft',
        status: 'confirmed',
        paymentReference,
        payerName,
        originBank,
        paymentDate,
        proofOfPaymentUrl,
        confirmedByUserId: adminUid,
        confirmedAt: new Date(),
        meta: jsonSafe({
          source: 'admin_confirm_payment',
          slotId,
          notes: cleanStr(body.notes, 2000),
          settings: {
            trainingFeeCents: settings.trainingFeeCents,
            currency: settings.currency,
          },
          raw: body,
        }),
      },
    });

    return NextResponse.json(
      {
        ok: true,
        payment: {
          id: payment.id,
          status: payment.status,
          provider: payment.provider,
          amountCents: payment.amountCents,
          currency: payment.currency,
          paymentReference: payment.paymentReference,
          payerName: payment.payerName,
          originBank: payment.originBank,
          paymentDate: payment.paymentDate?.toISOString() ?? null,
        },
        next: {
          generateAuthorisation: true,
          endpoint: '/api/admin/clinicians/onboarding/generate-authorisation',
        },
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error('[admin-confirm-clinician-payment] error', err);
    return NextResponse.json({ ok: false, error: err?.message || 'confirm_payment_failed' }, { status: 500 });
  }
}
