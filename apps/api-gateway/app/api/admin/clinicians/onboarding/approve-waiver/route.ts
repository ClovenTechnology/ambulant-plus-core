// apps/api-gateway/app/api/admin/clinicians/onboarding/approve-waiver/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getClinicianOnboardingSettings } from '@/src/clinicians/onboarding/settings';
import { verifyAdminRequest } from '../../../utils/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanStr(value: unknown, max = 1000): string | null {
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

function appendNote(existing: unknown, next: string) {
  return [cleanStr(existing, 4000), next].filter(Boolean).join('\n');
}

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await verifyAdminRequest(req);
    if ((isAdmin as any)?.ok === false) return (isAdmin as any).response;

    const body = (await req.json().catch(() => ({}))) as any;

    const clinicianId = cleanStr(body.clinicianId, 120);
    const onboardingId = cleanStr(body.onboardingId, 120);
    const slotId = cleanStr(body.slotId || body.trainingSlotId, 120);
    const waiverReason = cleanStr(body.waiverReason || body.reason, 2000);
    const adminComment = cleanStr(body.adminComment || body.comment || body.notes, 2000);
    const accountantComment = cleanStr(body.accountantComment, 2000);
    const tncAcceptedByAdmin = body.tncAcceptedByAdmin === true || body.termsAccepted === true;
    const nextPaymentAt = parseDate(body.nextPaymentAt);
    const expiresInDays = Math.max(1, Math.min(90, Math.round(Number(body.expiresInDays || 30))));

    if (!clinicianId) {
      return NextResponse.json({ ok: false, error: 'clinicianId_required' }, { status: 400 });
    }

    if (!waiverReason) {
      return NextResponse.json({ ok: false, error: 'waiverReason_required' }, { status: 400 });
    }

    if (!tncAcceptedByAdmin) {
      return NextResponse.json(
        { ok: false, error: 'waiver_terms_must_be_confirmed_by_admin' },
        { status: 400 },
      );
    }

    const settings = await getClinicianOnboardingSettings();

    const clinician = await prisma.clinicianProfile.findUnique({
      where: { id: clinicianId },
    });

    if (!clinician) {
      return NextResponse.json({ ok: false, error: 'clinician_not_found' }, { status: 404 });
    }

    const existing = onboardingId
      ? await prisma.clinicianOnboarding.findUnique({ where: { id: onboardingId } })
      : await prisma.clinicianOnboarding.findUnique({ where: { clinicianId } });

    if (onboardingId && existing && String(existing.clinicianId) !== clinicianId) {
      return NextResponse.json(
        { ok: false, error: 'onboarding_clinician_mismatch' },
        { status: 409 },
      );
    }

    const actorId =
      cleanStr((isAdmin as any)?.uid || (isAdmin as any)?.userId || body.approvedByUserId, 120) ||
      'admin';

    const now = new Date();
    const reference =
      cleanStr(body.paymentReference || body.reference, 180) ||
      `WAIVER-${clinicianId}-${now.getTime()}`;

    const note = [
      `WAIVER/PAY-LATER APPROVED ${now.toISOString()}`,
      `Reason: ${waiverReason}`,
      adminComment ? `Admin comment: ${adminComment}` : null,
      accountantComment ? `Accountant comment: ${accountantComment}` : null,
      nextPaymentAt ? `Next payment review: ${nextPaymentAt.toISOString()}` : null,
      'Temporary training devices may be issued for training only and must be retrieved.',
      'Permanent starter kit/device release requires minimum deposit or full payment.',
    ]
      .filter(Boolean)
      .join(' | ');

    const onboarding = await prisma.clinicianOnboarding.upsert({
      where: { clinicianId },
      update: {
        status: existing?.status || 'approved',
        paymentPlan: 'WAIVER_TRAIN_NOW_PAY_LATER',
        depositPaid: false,
        nextPaymentAt,
        trainingNotes: appendNote(existing?.trainingNotes, note),
      },
      create: {
        clinicianId,
        status: 'approved',
        paymentPlan: 'WAIVER_TRAIN_NOW_PAY_LATER',
        depositPaid: false,
        nextPaymentAt,
        trainingNotes: note,
      },
    });

    const payment = await prisma.clinicianOnboardingPayment.create({
      data: {
        clinicianId,
        onboardingId: onboarding.id,
        amountCents: 0,
        currency: settings.currency,
        provider: 'waiver',
        status: 'confirmed',
        paymentReference: reference,
        payerName: cleanStr(clinician.displayName, 240) || cleanStr(clinician.email, 240) || 'Clinician',
        originBank: null,
        paymentDate: now,
        proofOfPaymentUrl: null,
        confirmedByUserId: actorId,
        confirmedAt: now,
        authorisationExpiresAt: new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000),
        meta: jsonSafe({
          source: 'admin_waiver_pay_later_approval',
          waiver: true,
          deferredPayment: true,
          paymentPlan: 'WAIVER_TRAIN_NOW_PAY_LATER',
          slotId,
          waiverReason,
          adminComment,
          accountantComment,
          tncAcceptedByAdmin,
          nextPaymentAt: nextPaymentAt?.toISOString() ?? null,
          devicePolicy: {
            temporaryTrainingDevicesAllowed: true,
            temporaryDevicesMustBeReturned: true,
            permanentStarterKitRequiresDepositOrFullPayment: true,
            minimumInitialPaymentCents: settings.minimumInitialPaymentCents,
            trainingFeeCents: settings.trainingFeeCents,
            starterKitItems: settings.starterKitItems,
          },
          raw: body,
        }),
      },
    });

    return NextResponse.json(
      {
        ok: true,
        clinicianId,
        onboarding: {
          id: onboarding.id,
          stage: onboarding.status,
          paymentPlan: onboarding.paymentPlan,
          depositPaid: onboarding.depositPaid,
          nextPaymentAt: onboarding.nextPaymentAt?.toISOString() ?? null,
        },
        payment: {
          id: payment.id,
          provider: payment.provider,
          status: payment.status,
          amountCents: payment.amountCents,
          currency: payment.currency,
          paymentReference: payment.paymentReference,
          authorisationExpiresAt: payment.authorisationExpiresAt?.toISOString() ?? null,
        },
        policy: {
          temporaryTrainingDevicesAllowed: true,
          permanentStarterKitRequiresDepositOrFullPayment: true,
        },
        next: {
          generateAuthorisation: true,
          endpoint: '/api/admin/clinicians/onboarding/generate-authorisation',
          body: { paymentId: payment.id, clinicianId, expiresInDays },
        },
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err: any) {
    console.error('[admin-approve-clinician-waiver] error', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'approve_waiver_failed' },
      { status: 500 },
    );
  }
}
