// apps/clinician-app/app/api/training/context/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type JsonObj = Record<string, any>;

type OnboardingPathwayKey =
  | 'START_NOW_PAY_LATER'
  | 'QUALIFYING_DEPOSIT'
  | 'FULL_PAYMENT';

type CommercialPathway = {
  key: OnboardingPathwayKey;
  displayOrder: number;
  label: string;
  badge: string | null;
  description: string;
  ctaLabel: string;
  enabled: boolean;
  featured: boolean;
  conditions: string[];
};

const DEFAULT_COMMERCIAL_PATHWAYS: CommercialPathway[] = [
  {
    key: 'START_NOW_PAY_LATER',
    displayOrder: 1,
    label: 'Start Now — Pay Later',
    badge: 'Fastest start',
    description:
      'Begin training after Ambulant+ Admin approves your Pay Later request, without making an upfront onboarding payment.',
    ctaLabel: 'Request Pay Later approval',
    enabled: true,
    featured: true,
    conditions: [
      'Training access begins after Admin approval.',
      'No permanent C-Med Kit is dispatched until the qualifying initial payment is received.',
      'Platform-wide Professional Indemnity cover does not commence until a qualifying payment is received and all applicable policy conditions are satisfied.',
      'Any outstanding onboarding balance remains payable under the applicable agreement.',
    ],
  },
  {
    key: 'QUALIFYING_DEPOSIT',
    displayOrder: 2,
    label: 'Start with Initial Deposit',
    badge: 'Balanced option',
    description:
      'Pay the Admin-configured qualifying initial amount and proceed with training and partial C-Med Kit fulfilment.',
    ctaLabel: 'Pay initial deposit',
    enabled: true,
    featured: false,
    conditions: [
      'The qualifying initial amount is configured by Ambulant+ Admin.',
      'Initial C-Med Kit fulfilment excludes the HD Otoscope and complimentary merchandise until the outstanding balance is settled.',
      'Platform-wide Professional Indemnity cover becomes available subject to all applicable eligibility and policy conditions.',
      'The remaining onboarding balance remains payable under the applicable agreement.',
    ],
  },
  {
    key: 'FULL_PAYMENT',
    displayOrder: 3,
    label: 'Pay in Full',
    badge: 'Complete package',
    description:
      'Settle the complete onboarding fee and proceed with full C-Med Kit fulfilment.',
    ctaLabel: 'Pay full onboarding fee',
    enabled: true,
    featured: false,
    conditions: [
      'The full Admin-configured onboarding fee is payable.',
      'The complete C-Med Kit, including the HD Otoscope and eligible complimentary merchandise, can be dispatched.',
      'Platform-wide Professional Indemnity cover becomes available subject to all applicable eligibility and policy conditions.',
      'There is no outstanding onboarding-fee balance after confirmed full payment.',
    ],
  },
];

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


function normaliseProvider(value: unknown): 'stripe' | 'paystack' | 'payfast' | 'ozow' | 'unknown' {
  const p = String(value || process.env.CARD_PAYMENT_PROVIDER || process.env.PAYMENT_PROVIDER || 'paystack').toLowerCase();
  if (['stripe', 'paystack', 'payfast', 'ozow'].includes(p)) return p as any;
  return 'unknown';
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((x) => String(typeof x === 'string' ? x : x?.label || '').trim())
    .filter(Boolean);
}

function cloneDefaultCommercialPathways(): CommercialPathway[] {
  return DEFAULT_COMMERCIAL_PATHWAYS.map(
    (pathway) => ({
      ...pathway,
      conditions: [
        ...pathway.conditions,
      ],
    }),
  );
}

function normaliseCommercialPathways(
  value: unknown,
): CommercialPathway[] {
  const incoming =
    Array.isArray(value)
      ? value
      : [];

  const defaults =
    cloneDefaultCommercialPathways();

  const defaultByKey =
    new Map(
      defaults.map(
        (pathway) => [
          pathway.key,
          pathway,
        ],
      ),
    );

  const accepted =
    new Map<
      OnboardingPathwayKey,
      CommercialPathway
    >();

  for (const candidate of incoming) {
    if (
      !candidate ||
      typeof candidate !== 'object' ||
      Array.isArray(candidate)
    ) {
      continue;
    }

    const raw =
      candidate as Record<
        string,
        any
      >;

    const key =
      String(
        raw.key || '',
      )
        .trim()
        .toUpperCase() as
        OnboardingPathwayKey;

    const fallback =
      defaultByKey.get(key);

    if (
      !fallback ||
      accepted.has(key)
    ) {
      continue;
    }

    const requestedOrder =
      Number(
        raw.displayOrder,
      );

    const conditions =
      Array.isArray(
        raw.conditions,
      )
        ? raw.conditions
            .map(
              (condition: unknown) =>
                String(
                  condition || '',
                ).trim(),
            )
            .filter(Boolean)
            .slice(0, 12)
        : [
            ...fallback.conditions,
          ];

    const hasBadge =
      Object.prototype.hasOwnProperty.call(
        raw,
        'badge',
      );

    accepted.set(
      key,
      {
        key,
        displayOrder:
          Number.isFinite(
            requestedOrder,
          )
            ? Math.min(
                99,
                Math.max(
                  1,
                  Math.round(
                    requestedOrder,
                  ),
                ),
              )
            : fallback.displayOrder,
        label:
          String(
            raw.label || '',
          ).trim() ||
          fallback.label,
        badge: hasBadge
          ? String(
              raw.badge || '',
            ).trim() ||
            null
          : fallback.badge,
        description:
          String(
            raw.description || '',
          ).trim() ||
          fallback.description,
        ctaLabel:
          String(
            raw.ctaLabel || '',
          ).trim() ||
          fallback.ctaLabel,
        enabled:
          raw.enabled !== false,
        featured:
          raw.featured === true,
        conditions:
          conditions.length > 0
            ? conditions
            : [
                ...fallback.conditions,
              ],
      },
    );
  }

  return defaults
    .map(
      (fallback) =>
        accepted.get(
          fallback.key,
        ) ||
        fallback,
    )
    .sort(
      (left, right) =>
        left.displayOrder -
          right.displayOrder ||
        defaults.findIndex(
          (pathway) =>
            pathway.key ===
            left.key,
        ) -
          defaults.findIndex(
            (pathway) =>
              pathway.key ===
              right.key,
          ),
    );
}


async function localOnboardingSettings() {
  const row = await prisma.clinicianOnboardingSetting
    .findUnique({ where: { id: 'default' } })
    .catch(() => null);

  return {
    trainingFeeCents: Math.max(0, Math.round(Number(row?.trainingFeeCents || 0))),
    minimumInitialPaymentCents: Math.max(0, Math.round(Number(row?.minimumInitialPaymentCents || row?.trainingFeeCents || 0))),
    allowPartialPayment: row?.allowPartialPayment === true,
    balanceRecoveryMode: String(row?.balanceRecoveryMode || 'manual'),
    balanceRecoveryNotes: row?.balanceRecoveryNotes ? String(row.balanceRecoveryNotes) : null,
    currency: String(row?.currency || 'ZAR').toUpperCase(),
    paymentProvider: normaliseProvider(row?.paymentProvider),
    cardPaymentEnabled: row?.cardPaymentEnabled !== false,
    manualPaymentEnabled: row?.manualPaymentEnabled !== false,
    starterKitItems: stringArray(row?.starterKitItems),
    commercialPathways:
      normaliseCommercialPathways(
        (row as any)?.commercialPathways,
      ),
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

  const paymentPlan = String((onboarding as any)?.paymentPlan || '').trim();
  const waiverActive = paymentPlan === 'WAIVER_TRAIN_NOW_PAY_LATER';
  const minimumInitialPaymentCents = settings.allowPartialPayment
    ? Math.min(settings.trainingFeeCents, settings.minimumInitialPaymentCents)
    : settings.trainingFeeCents;
  const amountPaidCents = onboarding?.depositPaid === true ? minimumInitialPaymentCents : 0;
  const outstandingCents = Math.max(0, settings.trainingFeeCents - amountPaidCents);
  const trainingAccessGranted = onboarding?.depositPaid === true || waiverActive;

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
          depositPaid: onboarding.depositPaid ?? false,
          paymentPlan,
          paymentStatus: waiverActive ? 'waiver' : onboarding.depositPaid ? 'deposit_paid' : 'unpaid',
          amountPaidCents,
          outstandingCents,
          initialRequirementMet: onboarding.depositPaid === true,
          nextPaymentAt: (onboarding as any).nextPaymentAt?.toISOString?.() ?? null,
          waiverActive,
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
      paid: trainingAccessGranted,
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
      minimumInitialPaymentCents,
      allowPartialPayment: settings.allowPartialPayment,
      balanceRecoveryMode: settings.balanceRecoveryMode,
      balanceRecoveryNotes: settings.balanceRecoveryNotes,
      commercialPathways:
        settings.commercialPathways,
      amountPaidCents,
      outstandingCents,
      initialPaymentDueCents: minimumInitialPaymentCents,
      paymentStatus: waiverActive ? 'waiver' : onboarding?.depositPaid ? 'deposit_paid' : 'unpaid',
      initialRequirementMet: onboarding?.depositPaid === true,
      fullyPaid: amountPaidCents >= settings.trainingFeeCents && settings.trainingFeeCents > 0,
      paymentPlan,
      waiverActive,
      temporaryTrainingDevicesAllowed: waiverActive,
      permanentStarterKitRequiresDepositOrFullPayment: true,
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
