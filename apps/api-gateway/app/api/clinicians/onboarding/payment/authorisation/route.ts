// apps/api-gateway/app/api/clinicians/onboarding/payment/authorisation/route.ts
import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { finaliseClinicianTrainingPayment } from '@/src/clinicians/onboarding/finalise-training-payment';
import { getClinicianOnboardingSettings } from '@/src/clinicians/onboarding/settings';
import {
  resolveAuthenticatedClinician,
} from '@/src/clinicians/onboarding/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanStr(value: unknown, max = 500): string | null {
  const s = String(value ?? '').trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function isProductionRuntime() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

function authCodeSalt() {
  const salt = String(
    process.env.CLINICIAN_PAYMENT_AUTH_CODE_SALT ||
      process.env.NEXTAUTH_SECRET ||
      '',
  ).trim();

  if (!salt && isProductionRuntime()) {
    throw new Error('clinician_payment_auth_code_salt_not_configured');
  }

  return salt || 'ambulant-local-dev-salt';
}

function hashCode(code: string) {
  const salt = authCodeSalt();
  return crypto.createHash('sha256').update(`${salt}:${code.trim().toUpperCase()}`).digest('hex');
}

function readMeta(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const clinicianId = cleanStr(body.clinicianId, 120);
    const slotId = cleanStr(body.slotId || body.trainingSlotId, 120);
    const code = cleanStr(body.code || body.authorisationCode || body.authorizationCode, 120);

    if (!clinicianId) return NextResponse.json({ ok: false, error: 'clinicianId_required' }, { status: 400 });
    if (!slotId) return NextResponse.json({ ok: false, error: 'slotId_required' }, { status: 400 });
    if (!code) return NextResponse.json({ ok: false, error: 'authorisation_code_required' }, { status: 400 });

    const identity =
      await resolveAuthenticatedClinician(
        req,
        clinicianId,
      );

    if (!identity.ok) {
      return identity.response;
    }

    const settings = await getClinicianOnboardingSettings();
    if (!settings.manualPaymentEnabled) {
      return NextResponse.json({ ok: false, error: 'manual_payment_disabled' }, { status: 409 });
    }

    const codeHash = hashCode(code);
    const payment = await prisma.clinicianOnboardingPayment.findUnique({
      where: { authorisationCodeHash: codeHash },
    });

    if (!payment) return NextResponse.json({ ok: false, error: 'invalid_authorisation_code' }, { status: 404 });
    if (String(payment.clinicianId) !== clinicianId) {
      return NextResponse.json({ ok: false, error: 'authorisation_code_clinician_mismatch' }, { status: 409 });
    }
    if (payment.authorisationUsedAt) {
      return NextResponse.json({ ok: false, error: 'authorisation_code_already_used' }, { status: 409 });
    }
    if (payment.authorisationExpiresAt && payment.authorisationExpiresAt.getTime() < Date.now()) {
      return NextResponse.json({ ok: false, error: 'authorisation_code_expired' }, { status: 410 });
    }
    if (!['confirmed', 'captured'].includes(String(payment.status))) {
      return NextResponse.json({ ok: false, error: 'payment_not_confirmed_by_admin' }, { status: 409 });
    }

    const meta = readMeta(payment.meta);
    const expectedSlotId = cleanStr(meta.slotId || meta.selectedSlotId, 120);
    if (expectedSlotId && expectedSlotId !== slotId) {
      return NextResponse.json({ ok: false, error: 'authorisation_slot_mismatch' }, { status: 409 });
    }

    const redeemed = await prisma.clinicianOnboardingPayment.update({
      where: { id: payment.id },
      data: {
        status: 'redeemed',
        authorisationUsedAt: new Date(),
      },
    });

    const finalised = await finaliseClinicianTrainingPayment({
      clinicianId,
      onboardingId: redeemed.onboardingId,
      slotId,
      paymentId: redeemed.id,
      method: redeemed.provider === 'eft' ? 'eft' : 'manual',
      notes: 'Admin-issued authorisation code redeemed by clinician.',
    });

    return NextResponse.json(
      {
        ...finalised.body,
        payment: {
          id: redeemed.id,
          status: 'redeemed',
          provider: redeemed.provider,
          paymentReference: redeemed.paymentReference,
        },
      },
      { status: finalised.status },
    );
  } catch (err: any) {
    console.error('[clinician-training-payment-authorisation] error', err);
    return NextResponse.json({ ok: false, error: err?.message || 'authorisation_failed' }, { status: 500 });
  }
}
