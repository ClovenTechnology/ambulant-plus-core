// apps/clinician-app/app/api/training/context/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type JsonObj = Record<string, any>;

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function trimSlash(s: string) {
  return String(s || '').replace(/\/+$/, '');
}

function gatewayBase() {
  return trimSlash(
    process.env.API_GATEWAY_URL ||
      process.env.API_GATEWAY_BASE_URL ||
      process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
      process.env.APIGW_BASE ||
      process.env.GATEWAY_URL ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      process.env.NEXT_PUBLIC_GATEWAY_BASE ||
      process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
      '',
  );
}

function forwardHeaders(req: NextRequest) {
  const h = new Headers();

  [
    'cookie',
    'authorization',
    'x-role',
    'x-uid',
    'x-user-id',
    'x-org-id',
    'x-ambulant-identity',
    'user-agent',
  ].forEach((k) => {
    const v = req.headers.get(k);
    if (v) h.set(k, v);
  });

  h.set('accept', 'application/json');
  return h;
}

function safeMeta(value: unknown): JsonObj {
  if (!value || typeof value !== 'object') return {};
  return value as JsonObj;
}

function safeParseJsonObject(value: unknown): JsonObj {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as JsonObj;

  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function firstObject(...values: unknown[]): JsonObj {
  for (const value of values) {
    const parsed = safeParseJsonObject(value);
    if (Object.keys(parsed).length) return parsed;
  }
  return {};
}

function extractTrainingCertificate(rawProfile: JsonObj, meta: JsonObj, clinician: any) {
  const training = safeMeta(rawProfile?.training);
  const trainingCertificate = safeMeta(rawProfile?.trainingCertificate ?? meta?.trainingCertificate);
  const additionalQualifications = Array.isArray(rawProfile?.additionalQualifications)
    ? rawProfile.additionalQualifications
    : [];

  const qualification =
    additionalQualifications.find(
      (q: any) =>
        String(q?.degree || '').trim() === 'Ambulant+ Mandatory Clinician Training',
    ) || {};

  const certificateNumber =
    training?.certificateNumber ||
    trainingCertificate?.certificateNumber ||
    qualification?.certificateNumber ||
    clinician?.boardCertificateNumber ||
    null;

  const completedAt =
    training?.completedAt ||
    trainingCertificate?.completedAt ||
    trainingCertificate?.issuedAt ||
    qualification?.completedAt ||
    null;

  const institution =
    trainingCertificate?.institution ||
    qualification?.institution ||
    'Ambulant+ / Cloven Technology';

  return {
    certificateNumber,
    completedAt,
    institution,
    certificateUrl: certificateNumber && completedAt ? '/api/training/certificate' : null,
  };
}

function humanTrainingError(value: unknown, fallback = 'Unable to load your training details right now. Please try again or contact Ambulant+ support.') {
  if (!value) return fallback;

  if (typeof value === 'string') {
    const v = value.trim();
    if (!v) return fallback;
    if (v === 'clinicianId_required') return 'We could not identify your clinician profile. Please use the training link from your signup email or sign in again.';
    if (v === 'clinician_not_found') return 'We could not find this clinician application. Please check your training link or contact Ambulant+ support.';
    if (v.includes('DATABASE_URL') || v.toLowerCase().includes('prisma')) {
      return 'Training details are temporarily unavailable while the database connection is being restored. Please try again shortly.';
    }
    if (v.length > 180) return fallback;
    return v.replace(/_/g, ' ');
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, any>;
    return humanTrainingError(obj.error || obj.message || obj.reason, fallback);
  }

  return fallback;
}

function jsonFromText(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}


function normaliseProvider(value: unknown): 'mock' | 'stripe' | 'paystack' | 'ozow' | 'unknown' {
  const p = String(value || process.env.CARD_PAYMENT_PROVIDER || process.env.PAYMENT_PROVIDER || 'paystack').toLowerCase();
  if (['mock', 'stripe', 'paystack', 'ozow'].includes(p)) return p as any;
  return 'unknown';
}

const DEFAULT_STARTER_KIT_ITEMS = [
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

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return DEFAULT_STARTER_KIT_ITEMS;
  const out = value.map((x) => String(typeof x === 'string' ? x : x?.label || '').trim()).filter(Boolean);
  return out.length > 0 ? out : DEFAULT_STARTER_KIT_ITEMS;
}

async function localOnboardingSettings() {
  const row = await prisma.clinicianOnboardingSetting
    .findUnique({ where: { id: 'default' } })
    .catch(() => null);

  return {
    trainingFeeCents: Math.max(0, Math.round(Number(row?.trainingFeeCents || 0))),
    currency: String(row?.currency || 'ZAR').toUpperCase(),
    paymentProvider: normaliseProvider(row?.paymentProvider),
    cardPaymentEnabled: row?.cardPaymentEnabled !== false,
    manualPaymentEnabled: row?.manualPaymentEnabled !== false,
    starterKitItems: stringArray(row?.starterKitItems),
    bankInstructions: row?.bankInstructions && typeof row.bankInstructions === 'object' ? row.bankInstructions : null,
    configured: Math.max(0, Math.round(Number(row?.trainingFeeCents || 0))) > 0,
  };
}

async function localTrainingContext(clinicianId: string) {
  const clinician = await prisma.clinicianProfile.findUnique({
    where: { id: clinicianId },
  });

  if (!clinician) {
    return json({ ok: false, error: 'clinician_not_found' }, 404);
  }

  const onboarding = await prisma.clinicianOnboarding.findUnique({
    where: { clinicianId: clinician.id },
  });

  const trainingSlot = onboarding?.trainingSlotId
    ? await prisma.clinicianTrainingSlot.findUnique({
        where: { id: onboarding.trainingSlotId },
      })
    : null;

  const dispatch = await prisma.clinicianDispatch.findFirst({
    where: { clinicianId: clinician.id },
    orderBy: { updatedAt: 'desc' },
  });

  const meta = safeMeta((clinician as any).meta ?? (clinician as any).metadata);
  const rawProfile = firstObject(meta.rawProfile, meta.rawProfileJson);
  const certificate = extractTrainingCertificate(rawProfile, meta, clinician);

  const onboardingStage = String(onboarding?.status || rawProfile?.onboarding?.stage || '').toLowerCase();
  const trainingStatus = String(rawProfile?.training?.status || '').toLowerCase();

  const completed =
    clinician.trainingCompleted === true ||
    onboardingStage === 'training_completed' ||
    trainingStatus === 'completed' ||
    Boolean(certificate.certificateNumber && certificate.completedAt);
  const scheduled = !!trainingSlot;
  const settings = await localOnboardingSettings();

  return json({
    ok: true,
    clinician: {
      id: clinician.id,
      name: clinician.displayName ?? null,
      email: clinician.email ?? null,
      phone: clinician.phone ?? null,
      specialty: clinician.specialty ?? null,
      status: clinician.status ?? null,
    },
    onboarding: onboarding
      ? {
          stage: completed ? 'training_completed' : (onboarding.status ?? null),
          notes: onboarding.trainingNotes ?? null,
        }
      : {
          stage: completed ? 'training_completed' : (clinician.status ?? 'pending'),
          notes: null,
        },
    training: {
      status: completed ? 'completed' : scheduled ? 'scheduled' : 'pending',
      startAt: trainingSlot?.startsAt?.toISOString?.() ?? null,
      endAt: trainingSlot?.endsAt?.toISOString?.() ?? null,
      mode: trainingSlot?.mode ?? null,
      joinUrl: trainingSlot?.meetingUrl ?? null,
      paid: onboarding?.depositPaid === true,
      currency: settings.currency,
      feeCents: settings.trainingFeeCents,
      certificateNumber: certificate.certificateNumber ?? null,
      certificateCompletedAt: certificate.completedAt ?? null,
      certificateInstitution: certificate.institution ?? 'Ambulant+ / Cloven Technology',
      certificateAvailable: Boolean(certificate.certificateNumber && certificate.completedAt),
      certificateUrl: certificate.certificateUrl ?? null,
    },
    dispatch: dispatch
      ? {
          status: dispatch.status ?? null,
          courierName: dispatch.courier ?? null,
          trackingCode: dispatch.trackingCode ?? null,
          trackingUrl: dispatch.trackingUrl ?? null,
          shippedAt: dispatch.shippedAt?.toISOString?.() ?? null,
          deliveredAt: dispatch.deliveredAt?.toISOString?.() ?? null,
        }
      : null,
    pricing: {
      currency: settings.currency,
      trainingFeeCents: settings.trainingFeeCents,
      paymentProvider: settings.paymentProvider,
      cardPaymentEnabled: settings.cardPaymentEnabled,
      manualPaymentEnabled: settings.manualPaymentEnabled,
      configured: settings.configured,
    },
    bankInstructions: settings.bankInstructions,
    starterKitItems: settings.starterKitItems,
  });
}

export async function GET(req: NextRequest) {
  const incoming = new URL(req.url);
  const clinicianId = String(incoming.searchParams.get('clinicianId') || '').trim();

  const fallbackLocal = async () => {
    if (!clinicianId) {
      return json(
        {
          ok: false,
          error: 'We could not identify your clinician profile. Please use the training link from your signup email or sign in again.',
        },
        400,
      );
    }

    // Signup-success onboarding flow: allow limited training context by clinicianId
    // without granting access to the rest of the clinician console.
    return localTrainingContext(clinicianId);
  };

  try {
    const gw = gatewayBase();

    if (gw) {
      try {
        const gwUrl = new URL(`${gw}/api/clinicians/me/training/context`);

        for (const [k, v] of incoming.searchParams.entries()) {
          gwUrl.searchParams.set(k, v);
        }

        const upstream = await fetch(gwUrl.toString(), {
          method: 'GET',
          headers: forwardHeaders(req),
          cache: 'no-store',
        });

        const text = await upstream.text();

        if (upstream.ok) {
          return new NextResponse(text, {
            status: upstream.status,
            headers: {
              'content-type': upstream.headers.get('content-type') || 'application/json',
              'cache-control': 'no-store',
            },
          });
        }

        // Launch-safe behaviour: if the gateway is unavailable/misconfigured but
        // we have clinicianId, fall back to the clinician app DB context.
        if (clinicianId) {
          console.warn('[clinician-app][training/context] gateway failed; falling back locally', {
            status: upstream.status,
            error: humanTrainingError(jsonFromText(text) || text),
          });
          return fallbackLocal();
        }

        const body = jsonFromText(text);
        return json({ ok: false, error: humanTrainingError(body || text) }, upstream.status || 502);
      } catch (gatewayErr: any) {
        if (clinicianId) {
          console.warn('[clinician-app][training/context] gateway unreachable; falling back locally', gatewayErr);
          return fallbackLocal();
        }

        return json({ ok: false, error: humanTrainingError(gatewayErr) }, 502);
      }
    }

    return fallbackLocal();
  } catch (err: any) {
    console.error('[clinician-app][training/context][GET] error', err);
    return json({ ok: false, error: humanTrainingError(err) }, 502);
  }
}
