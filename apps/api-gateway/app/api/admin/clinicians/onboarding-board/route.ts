import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { verifyAdminRequest } from '../../utils/auth';
import {
  calculateOnboardingPaymentState,
  getClinicianOnboardingSettings,
  publicClinicianOnboardingSettings,
} from '@/src/clinicians/onboarding/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type UiStage =
  | 'applied'
  | 'screened'
  | 'approved'
  | 'rejected'
  | 'training_scheduled'
  | 'training_completed';

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

function outwardStage(status: unknown): UiStage {
  const s = String(status ?? '').trim().toLowerCase();

  if (s === 'screened') return 'screened';
  if (s === 'approved') return 'approved';
  if (s === 'rejected') return 'rejected';
  if (s === 'training_scheduled') return 'training_scheduled';
  if (s === 'training_completed') return 'training_completed';

  // schema default/status seed is "pending"; admin UI expects "applied"
  return 'applied';
}

function outwardTrainingStatus(status: unknown): 'scheduled' | 'completed' | 'canceled' {
  const s = String(status ?? '').trim().toLowerCase();
  if (s === 'completed') return 'completed';
  if (s === 'canceled' || s === 'cancelled') return 'canceled';
  return 'scheduled';
}

function outwardDispatchStatus(
  status: unknown,
): 'pending' | 'packed' | 'shipped' | 'delivered' | 'canceled' {
  const s = String(status ?? '').trim().toLowerCase();

  if (s === 'packed') return 'packed';
  if (s === 'shipped') return 'shipped';
  if (s === 'delivered') return 'delivered';
  if (s === 'canceled' || s === 'cancelled') return 'canceled';

  // schema/create-dispatch path may still use "prepared"; UI expects "pending"
  return 'pending';
}

export async function GET(req: NextRequest) {
  try {
    const isAdmin = await verifyAdminRequest(req);
    if (!isAdmin) {
      return NextResponse.json(
        { ok: false, error: 'admin_required' },
        { status: 403 },
      );
    }

    const db: any = prisma;

    const clinicians = await db.clinicianProfile.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        displayName: true,
        email: true,
        phone: true,
        specialty: true,
        createdAt: true,
        status: true,
        trainingCompleted: true,
        archived: true,
      },
    });

    const visibleClinicians = Array.isArray(clinicians)
      ? clinicians.filter((c: any) => !c?.archived)
      : [];

    const clinicianIds = visibleClinicians.map((c: any) => String(c.id));

    const onboardings = clinicianIds.length
      ? await db.clinicianOnboarding.findMany({
          where: { clinicianId: { in: clinicianIds } },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    const onboardingByClinicianId = new Map<string, any>();
    for (const o of onboardings || []) {
      const cid = String(o.clinicianId);
      if (!onboardingByClinicianId.has(cid)) onboardingByClinicianId.set(cid, o);
    }

    const trainingSlotIds = Array.from(
      new Set(
        (onboardings || [])
          .map((o: any) => cleanStr(o.trainingSlotId, 120))
          .filter(Boolean),
      ),
    ) as string[];

    const trainingSlots = trainingSlotIds.length
      ? await db.clinicianTrainingSlot.findMany({
          where: { id: { in: trainingSlotIds } },
        })
      : [];

    const trainingSlotById = new Map<string, any>();
    for (const t of trainingSlots || []) {
      trainingSlotById.set(String(t.id), t);
    }

    const dispatches = clinicianIds.length
      ? await db.clinicianDispatch.findMany({
          where: { clinicianId: { in: clinicianIds } },
          orderBy: [{ createdAt: 'desc' }],
        })
      : [];

    const payments = clinicianIds.length
      ? await db.clinicianOnboardingPayment.findMany({
          where: {
            clinicianId: { in: clinicianIds },
            status: { in: ['confirmed', 'paid', 'captured'] },
          },
          orderBy: [{ confirmedAt: 'desc' }, { createdAt: 'desc' }],
        })
      : [];

    const paymentsByClinicianId = new Map<string, any[]>();
    for (const payment of payments || []) {
      const cid = String(payment.clinicianId);
      const existing = paymentsByClinicianId.get(cid) || [];
      existing.push(payment);
      paymentsByClinicianId.set(cid, existing);
    }

    const settings = await getClinicianOnboardingSettings();
    const publicSettings = publicClinicianOnboardingSettings(settings);

    const latestDispatchByClinicianId = new Map<string, any>();
    for (const d of dispatches || []) {
      const cid = String(d.clinicianId);
      if (!latestDispatchByClinicianId.has(cid)) latestDispatchByClinicianId.set(cid, d);
    }

    const rows = visibleClinicians.map((clinician: any) => {
      const onboarding = onboardingByClinicianId.get(String(clinician.id)) || null;
      const training =
        onboarding?.trainingSlotId
          ? trainingSlotById.get(String(onboarding.trainingSlotId)) || null
          : null;
      const dispatch = latestDispatchByClinicianId.get(String(clinician.id)) || null;
      const confirmedPayments = paymentsByClinicianId.get(String(clinician.id)) || [];
      const amountPaidCents = confirmedPayments.reduce((sum: number, payment: any) => {
        const provider = String(payment?.provider || '').toLowerCase();
        if (provider === 'waiver' || provider === 'deferred') return sum;
        return sum + Math.max(0, Math.round(Number(payment?.amountCents || 0)));
      }, 0);
      const paymentState = calculateOnboardingPaymentState({
        trainingFeeCents: settings.trainingFeeCents,
        minimumInitialPaymentCents: settings.minimumInitialPaymentCents,
        amountPaidCents,
      });
      const paymentPlan = cleanStr(onboarding?.paymentPlan, 120);
      const waiverActive =
        paymentPlan === 'WAIVER_TRAIN_NOW_PAY_LATER' ||
        confirmedPayments.some((payment: any) =>
          ['waiver', 'deferred'].includes(String(payment?.provider || '').toLowerCase()),
        );
      const latestPayment = confirmedPayments[0] || null;

      return {
        clinicianId: String(clinician.id),
        displayName: cleanStr(clinician.displayName, 240) || 'Clinician',
        email: cleanStr(clinician.email, 320),
        phone: cleanStr(clinician.phone, 80),
        specialty: cleanStr(clinician.specialty, 240),
        createdAt: asIso(clinician.createdAt) || new Date().toISOString(),

        onboarding: {
          id: onboarding?.id
            ? String(onboarding.id)
            : `virtual-onboarding-${String(clinician.id)}`,
          stage: outwardStage(onboarding?.status),
          notes: cleanStr(onboarding?.trainingNotes, 2000),
          depositPaid: onboarding?.depositPaid === true,
          paymentPlan,
          nextPaymentAt: asIso(onboarding?.nextPaymentAt),
          waiverActive,
        },

        payment: {
          amountPaidCents: paymentState.amountPaidCents,
          outstandingCents: paymentState.outstandingCents,
          initialRequirementMet: paymentState.initialRequirementMet,
          fullyPaid: paymentState.fullyPaid,
          paymentStatus: waiverActive ? 'waiver' : paymentState.paymentStatus,
          waiverActive,
          latestConfirmedPayment: latestPayment
            ? {
                id: String(latestPayment.id),
                provider: cleanStr(latestPayment.provider, 80),
                status: cleanStr(latestPayment.status, 80),
                amountCents: Math.max(0, Math.round(Number(latestPayment.amountCents || 0))),
                currency: cleanStr(latestPayment.currency, 8),
                paymentReference: cleanStr(latestPayment.paymentReference, 180),
                proofOfPaymentUrl: cleanStr(latestPayment.proofOfPaymentUrl, 1000),
                authorisationCodeHint: cleanStr(latestPayment.authorisationCodeHint, 20),
                authorisationExpiresAt: asIso(latestPayment.authorisationExpiresAt),
                confirmedAt: asIso(latestPayment.confirmedAt),
              }
            : null,
        },

        trainingSlot: training
          ? {
              id: String(training.id),
              startAt: asIso(training.startsAt),
              endAt: asIso(training.endsAt),
              mode:
                String(training.mode || '').trim().toLowerCase() === 'in_person'
                  ? 'in_person'
                  : 'virtual',
              status: outwardTrainingStatus(training.status),
              joinUrl: cleanStr(training.meetingUrl, 1000),
            }
          : null,

        dispatch: dispatch
          ? {
              id: String(dispatch.id),
              status: outwardDispatchStatus(dispatch.status),
              courierName: cleanStr(dispatch.courier, 240),
              trackingCode: cleanStr(dispatch.trackingCode, 240),
              shippedAt: asIso(dispatch.shippedAt),
              deliveredAt: asIso(dispatch.deliveredAt),
            }
          : null,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        rows,
        settings: {
          publicSettings,
        },
      },
      {
        headers: {
          'cache-control': 'no-store',
          'access-control-allow-origin': '*',
        },
      },
    );
  } catch (err: any) {
    console.error('[api-gateway][admin][clinicians][onboarding-board] error', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message || 'onboarding_board_failed') },
      { status: 500 },
    );
  }
}