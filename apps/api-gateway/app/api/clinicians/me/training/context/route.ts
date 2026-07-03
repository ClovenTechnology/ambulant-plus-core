import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { readIdentity } from '@/src/lib/identity';
import {
  calculateOnboardingPaymentState,
  getClinicianOnboardingSettings,
  publicClinicianOnboardingSettings,
} from '@/src/clinicians/onboarding/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanStr(v: unknown, max = 240): string | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function asIso(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function outwardStage(status: unknown) {
  const s = String(status ?? '').trim().toLowerCase();
  if (s === 'screened') return 'screened';
  if (s === 'approved') return 'approved';
  if (s === 'rejected') return 'rejected';
  if (s === 'training_scheduled') return 'training_scheduled';
  if (s === 'training_completed') return 'training_completed';
  return 'applied';
}

function outwardTrainingStatus(status: unknown) {
  const s = String(status ?? '').trim().toLowerCase();
  if (s === 'completed') return 'completed';
  if (s === 'canceled' || s === 'cancelled') return 'canceled';
  return 'scheduled';
}

function outwardDispatchStatus(status: unknown) {
  const s = String(status ?? '').trim().toLowerCase();
  if (s === 'packed') return 'packed';
  if (s === 'shipped') return 'shipped';
  if (s === 'delivered') return 'delivered';
  if (s === 'canceled' || s === 'cancelled') return 'canceled';
  return 'pending';
}

function safeParseJson(v: unknown): any {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(String(v));
  } catch {
    return {};
  }
}

function extractTrainingCertificate(profileJson: any) {
  const training = profileJson?.training || {};
  const additionalQualifications = Array.isArray(profileJson?.additionalQualifications)
    ? profileJson.additionalQualifications
    : [];

  const trainingQualification =
    additionalQualifications.find(
      (q: any) =>
        String(q?.degree || '').trim() === 'Ambulant+ Mandatory Clinician Training',
    ) || null;

  return {
    certificateNumber:
      cleanStr(training?.certificateNumber, 120) ||
      cleanStr(trainingQualification?.certificateNumber, 120) ||
      null,
    completedAt:
      cleanStr(training?.completedAt, 80) ||
      cleanStr(trainingQualification?.completedAt, 80) ||
      null,
    institution:
      cleanStr(trainingQualification?.institution, 120) ||
      'Ambulant+ / Cloven Technology',
  };
}

export async function GET(req: NextRequest) {
  try {
    const requestedClinicianId = cleanStr(req.nextUrl.searchParams.get('clinicianId'), 120);
    const who = readIdentity(req.headers);

    if (!who?.uid && !requestedClinicianId) {
      return NextResponse.json(
        { ok: false, error: 'unauthorized' },
        { status: 401 },
      );
    }

    const db: any = prisma;
    const clinician = requestedClinicianId
      ? await db.clinicianProfile.findUnique({
          where: { id: requestedClinicianId },
        })
      : await db.clinicianProfile.findFirst({
          where: {
            OR: [{ userId: who!.uid }, { id: who!.uid }],
          },
          orderBy: { createdAt: 'desc' },
        });

    if (!clinician) {
      return NextResponse.json(
        { ok: false, error: 'clinician_not_found' },
        { status: 404 },
      );
    }

    const onboarding = await db.clinicianOnboarding.findFirst({
      where: { clinicianId: clinician.id },
      orderBy: { createdAt: 'desc' },
    });

    const trainingSlot =
      onboarding?.trainingSlotId
        ? await db.clinicianTrainingSlot.findUnique({
            where: { id: onboarding.trainingSlotId },
          })
        : null;

    const dispatch = await db.clinicianDispatch.findFirst({
      where: { clinicianId: clinician.id },
      orderBy: { createdAt: 'desc' },
    });

    const rawProfile =
      safeParseJson((clinician as any)?.meta?.rawProfile) ||
      safeParseJson((clinician as any)?.meta?.rawProfileJson) ||
      safeParseJson((clinician as any)?.metadata?.rawProfile) ||
      safeParseJson((clinician as any)?.metadata?.rawProfileJson);

    const trainingCert = extractTrainingCertificate(rawProfile);

    const trainingCompleted =
      clinician?.trainingCompleted === true ||
      String(onboarding?.status || '').toLowerCase() === 'training_completed' ||
      String(rawProfile?.onboarding?.stage || '').toLowerCase() === 'training_completed' ||
      String(rawProfile?.training?.status || '').toLowerCase() === 'completed' ||
      Boolean(trainingCert.certificateNumber && trainingCert.completedAt);

    const certificateAvailable = Boolean(trainingCert.certificateNumber && trainingCert.completedAt);
    const certificateUrl = certificateAvailable ? '/api/clinicians/me/training/certificate' : null;

    const settings = await getClinicianOnboardingSettings();
    const publicSettings = publicClinicianOnboardingSettings(settings);

    const confirmedPayments = await prisma.clinicianOnboardingPayment
      .findMany({
        where: {
          clinicianId: String(clinician.id),
          status: { in: ['confirmed', 'paid', 'captured'] as any },
        } as any,
        orderBy: { createdAt: 'desc' },
      })
      .catch(() => []);

    const amountPaidCents = (confirmedPayments || []).reduce((sum: number, payment: any) => {
      const provider = String(payment?.provider || '').toLowerCase();
      if (provider === 'waiver' || provider === 'deferred') return sum;
      return sum + Math.max(0, Math.round(Number(payment?.amountCents || 0)));
    }, 0);

    const paymentState = calculateOnboardingPaymentState({
      trainingFeeCents: settings.trainingFeeCents,
      minimumInitialPaymentCents: settings.minimumInitialPaymentCents,
      amountPaidCents,
    });

    const paymentPlan = cleanStr((onboarding as any)?.paymentPlan, 120);
    const waiverActive =
      paymentPlan === 'WAIVER_TRAIN_NOW_PAY_LATER' ||
      (confirmedPayments || []).some((payment: any) =>
        ['waiver', 'deferred'].includes(String(payment?.provider || '').toLowerCase()),
      );

    const trainingAccessGranted =
      onboarding?.depositPaid === true ||
      paymentState.initialRequirementMet ||
      waiverActive;

    const starterKitItems = publicSettings.starterKitItems;
    const currency = publicSettings.currency;
    const trainingFeeCents = publicSettings.trainingFeeCents;
    const paymentProvider = publicSettings.paymentProvider;

    return NextResponse.json(
      {
        ok: true,
        clinician: {
          id: String(clinician.id),
          name: cleanStr(clinician.displayName, 240),
          email: cleanStr(clinician.email, 320),
          phone: cleanStr(clinician.phone, 80),
          specialty: cleanStr(clinician.specialty, 240),
          status: cleanStr(clinician.status, 80),
        },
        onboarding: onboarding
          ? {
              stage: trainingCompleted ? 'training_completed' : outwardStage(onboarding.status),
              notes: cleanStr(onboarding.trainingNotes, 2000),
              depositPaid: onboarding.depositPaid,
              paymentPlan: paymentPlan,
              paymentStatus: paymentState.paymentStatus,
              amountPaidCents: paymentState.amountPaidCents,
              outstandingCents: paymentState.outstandingCents,
              initialRequirementMet: paymentState.initialRequirementMet,
              nextPaymentAt: asIso((onboarding as any).nextPaymentAt),
              waiverActive,
            }
          : null,
        training: trainingSlot
          ? {
              status: trainingCompleted ? 'completed' : outwardTrainingStatus(trainingSlot.status),
              startAt: asIso(trainingSlot.startsAt),
              endAt: asIso(trainingSlot.endsAt),
              mode:
                String(trainingSlot.mode || '').trim().toLowerCase() === 'in_person'
                  ? 'in_person'
                  : 'virtual',
              joinUrl: cleanStr(trainingSlot.meetingUrl, 1000),
              paid: trainingAccessGranted,
              currency,
              feeCents: trainingFeeCents,
              certificateNumber: trainingCert.certificateNumber,
              certificateCompletedAt: trainingCert.completedAt,
              certificateInstitution: trainingCert.institution,
              certificateAvailable,
              certificateUrl,
            }
          : {
              status: trainingCompleted ? 'completed' : null,
              startAt: null,
              endAt: null,
              mode: null,
              joinUrl: null,
              paid: trainingAccessGranted,
              currency,
              feeCents: trainingFeeCents,
              certificateNumber: trainingCert.certificateNumber,
              certificateCompletedAt: trainingCert.completedAt,
              certificateInstitution: trainingCert.institution,
              certificateAvailable,
              certificateUrl,
            },
        dispatch: dispatch
          ? {
              status: outwardDispatchStatus(dispatch.status),
              courierName: cleanStr(dispatch.courier, 240),
              trackingCode: cleanStr(dispatch.trackingCode, 240),
              trackingUrl: null,
              shippedAt: asIso(dispatch.shippedAt),
              deliveredAt: asIso(dispatch.deliveredAt),
            }
          : null,
        pricing: {
          ...publicSettings,
          currency,
          trainingFeeCents,
          paymentProvider:
            paymentProvider === 'paystack' ||
            paymentProvider === 'payfast' ||
            paymentProvider === 'mock'
              ? paymentProvider
              : 'unknown',
          amountPaidCents: paymentState.amountPaidCents,
          outstandingCents: paymentState.outstandingCents,
          initialPaymentDueCents: publicSettings.minimumInitialPaymentCents,
          paymentStatus: paymentState.paymentStatus,
          initialRequirementMet: paymentState.initialRequirementMet,
          fullyPaid: paymentState.fullyPaid,
          paymentPlan,
          waiverActive,
          temporaryTrainingDevicesAllowed: waiverActive,
          permanentStarterKitRequiresDepositOrFullPayment: true,
        },
        bankInstructions: publicSettings.bankInstructions,
        starterKitItems,
      },
      {
        headers: {
          'cache-control': 'no-store',
          'access-control-allow-origin': '*',
        },
      },
    );
  } catch (err: any) {
    console.error('[api-gateway][clinicians/me/training/context] error', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message || 'training_context_failed') },
      { status: 500 },
    );
  }
}