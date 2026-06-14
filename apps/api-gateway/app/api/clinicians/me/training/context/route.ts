import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { readIdentity } from '@/src/lib/identity';

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
    const who = readIdentity(req.headers);
    if (!who?.uid) {
      return NextResponse.json(
        { ok: false, error: 'unauthorized' },
        { status: 401 },
      );
    }

    const db: any = prisma;
    const clinician = await db.clinicianProfile.findFirst({
      where: {
        OR: [{ userId: who.uid }, { id: who.uid }],
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

    const starterKitItems =
      Array.isArray(rawProfile?.starterKitItems)
        ? rawProfile.starterKitItems.map(String)
        : [
            '6-in-1 Health Monitor (IoMT)',
            'NexRing (IoMT)',
            'Digital Stethoscope (IoMT)',
            'HD Otoscope (IoMT)',
            'Clinician Handbook',
            'Consumables pack',
            'Ambulant+ formal shirt (Black)',
            'Ambulant+ formal shirt (White)',
            'Ambulant+ Mug',
            'Ambulant+ Thermo Bottle',
            'Smart ID + card holder + lanyard',
          ];

    const trainingFeeCents =
      typeof rawProfile?.pricing?.trainingFeeCents === 'number'
        ? rawProfile.pricing.trainingFeeCents
        : 0;

    const currency =
      cleanStr(rawProfile?.pricing?.currency, 8) ||
      cleanStr(rawProfile?.currency, 8) ||
      'ZAR';

    const paymentProvider =
      cleanStr(rawProfile?.pricing?.paymentProvider, 40) ||
      'unknown';

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
              paid: !!onboarding?.depositPaid,
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
              paid: !!onboarding?.depositPaid,
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
          currency,
          trainingFeeCents,
          paymentProvider:
            paymentProvider === 'stripe' ||
            paymentProvider === 'paystack' ||
            paymentProvider === 'ozow' ||
            paymentProvider === 'mock'
              ? paymentProvider
              : 'unknown',
        },
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