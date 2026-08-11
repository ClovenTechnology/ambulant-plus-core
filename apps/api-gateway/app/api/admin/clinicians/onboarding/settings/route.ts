// apps/api-gateway/app/api/admin/clinicians/onboarding/settings/route.ts
import {
  NextRequest,
  NextResponse,
} from 'next/server';
import {Prisma} from '@prisma/client';
import {prisma} from '@/src/lib/prisma';
import {
  effectiveClinicianPathwayPricing,
  getClinicianOnboardingSettings,
  normaliseClinicianOnboardingCommercialPathways,
  normaliseClinicianOnboardingSettings,
  normaliseClinicianTrainingPolicy,
  publicClinicianOnboardingSettings,
} from '@/src/clinicians/onboarding/settings';
import {verifyAdminRequest} from '../../../utils/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanStr(
  value: unknown,
  max = 500,
): string | null {
  const clean = String(value ?? '').trim();
  if (!clean) return null;
  return clean.length > max
    ? clean.slice(0, max)
    : clean;
}

function moneyCents(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.max(0, Math.round(amount));
}

function currency(value: unknown) {
  const code =
    String(value || 'ZAR')
      .trim()
      .toUpperCase();

  return /^[A-Z]{3}$/.test(code)
    ? code
    : 'ZAR';
}

function provider(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase() === 'payfast'
      ? 'payfast'
      : 'paystack';
}

function recoveryMode(value: unknown) {
  const mode =
    String(value || 'manual')
      .trim()
      .toLowerCase();

  if (
    mode === 'payout_deduction' ||
    mode === 'disabled'
  ) {
    return mode;
  }

  return 'manual';
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of value) {
    const item =
      cleanStr(
        typeof raw === 'string'
          ? raw
          : (raw as any)?.label,
        180,
      );

    if (!item) continue;

    const identity = item.toLowerCase();
    if (seen.has(identity)) continue;

    seen.add(identity);
    items.push(item);
  }

  return items.slice(0, 100);
}

function jsonObjectOrNull(value: unknown) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

function hasOwn(
  body: Record<string, any>,
  key: string,
) {
  return Object.prototype.hasOwnProperty.call(
    body,
    key,
  );
}

function trustedAdminKey(request: NextRequest) {
  const expected =
    String(process.env.ADMIN_API_KEY || '')
      .trim();

  if (!expected) return false;

  return String(
    request.headers.get('x-admin-key') || '',
  ).trim() === expected;
}

async function requireAdmin(request: NextRequest) {
  if (trustedAdminKey(request)) {
    return {
      ok: true as const,
      uid: 'admin-api-key',
      userId: 'admin-api-key',
      source: 'admin-api-key',
    };
  }

  return verifyAdminRequest(request);
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  const settings =
    await getClinicianOnboardingSettings();

  return NextResponse.json({
    ok: true,
    settings,
    publicSettings:
      publicClinicianOnboardingSettings(settings),
  });
}

export async function PATCH(
  request: NextRequest,
) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;

    const body = await request
      .json()
      .catch(() => ({} as Record<string, any>));

    const existing = await getClinicianOnboardingSettings();

    const requestedPathways =
      normaliseClinicianOnboardingCommercialPathways(
        hasOwn(body, 'commercialPathways')
          ? body.commercialPathways
          : existing.commercialPathways,
      );

    const commercialPathways = requestedPathways.map((pathway) =>
      pathway.key === 'START_NOW_PAY_LATER'
        ? {
            ...pathway,
            standardPriceCents: 0,
            promotionalPriceCents: null,
            promotionStartsAt: null,
            promotionEndsAt: null,
            amountDueTodayCents: 0,
            promotionLabel: null,
            privileges: {
              ...pathway.privileges,
              trainingAccess: true,
              practiceActivation: true,
              starterKitRelease: 'none' as const,
              platformIndemnityEligible: false,
              balanceRecoveryApplies: false,
            },
          }
        : pathway,
    );

    const enabled = commercialPathways.filter((pathway) => pathway.enabled);
    const featured = commercialPathways.filter((pathway) => pathway.featured);

    if (!enabled.length) {
      return NextResponse.json(
        { ok: false, error: 'at_least_one_continuation_pathway_must_be_enabled' },
        { status: 400 },
      );
    }

    if (featured.length !== 1 || !featured[0]?.enabled) {
      return NextResponse.json(
        { ok: false, error: 'exactly_one_enabled_pathway_must_be_featured' },
        { status: 400 },
      );
    }

    const orders = commercialPathways.map((pathway) => pathway.displayOrder);
    if (new Set(orders).size !== orders.length) {
      return NextResponse.json(
        { ok: false, error: 'continuation_pathway_display_orders_must_be_unique' },
        { status: 400 },
      );
    }

    const paidEnabled = enabled.filter(
      (pathway) => pathway.key !== 'START_NOW_PAY_LATER',
    );

    for (const pathway of paidEnabled) {
      const standard = moneyCents(pathway.standardPriceCents) ?? 0;
      const promotional = pathway.promotionalPriceCents == null
        ? null
        : moneyCents(pathway.promotionalPriceCents);

      if (standard <= 0) {
        return NextResponse.json(
          { ok: false, error: 'c_med_standard_price_required', pathwayKey: pathway.key },
          { status: 400 },
        );
      }

      if (promotional != null) {
        if (promotional <= 0 || promotional >= standard) {
          return NextResponse.json(
            { ok: false, error: 'c_med_promotional_price_must_be_below_standard_price', pathwayKey: pathway.key },
            { status: 400 },
          );
        }
        if (!pathway.promotionEndsAt) {
          return NextResponse.json(
            { ok: false, error: 'c_med_promotion_expiry_required', pathwayKey: pathway.key },
            { status: 400 },
          );
        }
      }

      const startMs = pathway.promotionStartsAt
        ? Date.parse(pathway.promotionStartsAt)
        : null;
      const endMs = pathway.promotionEndsAt
        ? Date.parse(pathway.promotionEndsAt)
        : null;

      if (startMs != null && !Number.isFinite(startMs)) {
        return NextResponse.json(
          { ok: false, error: 'c_med_promotion_start_invalid', pathwayKey: pathway.key },
          { status: 400 },
        );
      }
      if (endMs != null && !Number.isFinite(endMs)) {
        return NextResponse.json(
          { ok: false, error: 'c_med_promotion_expiry_invalid', pathwayKey: pathway.key },
          { status: 400 },
        );
      }
      if (startMs != null && endMs != null && startMs >= endMs) {
        return NextResponse.json(
          { ok: false, error: 'c_med_promotion_expiry_must_follow_start', pathwayKey: pathway.key },
          { status: 400 },
        );
      }

      if (pathway.key === 'QUALIFYING_DEPOSIT') {
        const due = moneyCents(pathway.amountDueTodayCents) ?? 0;
        const lowestConfiguredTotal = promotional != null
          ? Math.min(standard, promotional)
          : standard;
        if (due <= 0 || due > lowestConfiguredTotal) {
          return NextResponse.json(
            { ok: false, error: 'c_med_flex_due_today_invalid', pathwayKey: pathway.key },
            { status: 400 },
          );
        }
      }
    }

    const starterKitItems = hasOwn(body, 'starterKitItems')
      ? stringArray(body.starterKitItems)
      : existing.starterKitItems;

    const paidKitReleaseEnabled = paidEnabled.some(
      (pathway) => pathway.privileges.starterKitRelease !== 'none',
    );

    if (paidKitReleaseEnabled && !starterKitItems.length) {
      return NextResponse.json(
        { ok: false, error: 'at_least_one_c_med_kit_item_required_for_c_med_pathways' },
        { status: 400 },
      );
    }

    const kitByIdentity = new Map(
      starterKitItems.map((item) => [item.toLowerCase(), item]),
    );

    const requestedDepositItems = hasOwn(body, 'starterKitDepositItems')
      ? stringArray(body.starterKitDepositItems)
      : existing.starterKitDepositItems;

    const unknownDepositItem = requestedDepositItems.find(
      (item) => !kitByIdentity.has(item.toLowerCase()),
    );

    if (unknownDepositItem) {
      return NextResponse.json(
        { ok: false, error: 'flex_kit_items_must_belong_to_full_kit', item: unknownDepositItem },
        { status: 400 },
      );
    }

    const starterKitDepositItems = requestedDepositItems.map(
      (item) => kitByIdentity.get(item.toLowerCase())!,
    );

    const flexPathway = commercialPathways.find(
      (pathway) => pathway.key === 'QUALIFYING_DEPOSIT',
    );
    if (
      flexPathway?.enabled &&
      flexPathway.privileges.starterKitRelease === 'deposit' &&
      !starterKitDepositItems.length
    ) {
      return NextResponse.json(
        { ok: false, error: 'select_at_least_one_c_med_flex_kit_item' },
        { status: 400 },
      );
    }

    const cardPaymentEnabled = hasOwn(body, 'cardPaymentEnabled')
      ? body.cardPaymentEnabled !== false
      : existing.cardPaymentEnabled;
    const manualPaymentEnabled = hasOwn(body, 'manualPaymentEnabled')
      ? body.manualPaymentEnabled !== false
      : existing.manualPaymentEnabled;

    if (paidEnabled.length && !cardPaymentEnabled && !manualPaymentEnabled) {
      return NextResponse.json(
        { ok: false, error: 'enable_card_or_eft_for_c_med_pathways' },
        { status: 400 },
      );
    }

    const trainingPolicy = normaliseClinicianTrainingPolicy(
      hasOwn(body, 'trainingPolicy')
        ? body.trainingPolicy
        : existing.trainingPolicy,
    );

    const fullPathway = commercialPathways.find(
      (pathway) => pathway.key === 'FULL_PAYMENT',
    );
    const flexPricing = flexPathway?.enabled
      ? effectiveClinicianPathwayPricing(flexPathway)
      : null;

    // Legacy columns remain synchronized for older routes/history, but the
    // commercial-pathway JSON is now the authoritative pricing contract.
    const trainingFeeCents = fullPathway?.enabled
      ? moneyCents(fullPathway.standardPriceCents) ?? 0
      : flexPathway?.enabled
        ? moneyCents(flexPathway.standardPriceCents) ?? 0
        : 0;
    const minimumInitialPaymentCents = flexPathway?.enabled
      ? flexPricing?.amountDueTodayCents ?? 0
      : trainingFeeCents;
    const allowPartialPayment = Boolean(flexPathway?.enabled);

    const actorId = cleanStr(
      (admin as any).uid || (admin as any).userId || 'admin-api-key',
      120,
    );

    const data: any = {
      trainingFeeCents,
      minimumInitialPaymentCents,
      allowPartialPayment,
      balanceRecoveryMode: hasOwn(body, 'balanceRecoveryMode')
        ? recoveryMode(body.balanceRecoveryMode)
        : existing.balanceRecoveryMode,
      balanceRecoveryNotes: hasOwn(body, 'balanceRecoveryNotes')
        ? cleanStr(body.balanceRecoveryNotes, 2000)
        : existing.balanceRecoveryNotes,
      currency: hasOwn(body, 'currency')
        ? currency(body.currency)
        : existing.currency,
      paymentProvider: hasOwn(body, 'paymentProvider')
        ? provider(body.paymentProvider)
        : existing.paymentProvider,
      cardPaymentEnabled,
      manualPaymentEnabled,
      starterKitItems,
      starterKitDepositItems,
      bankInstructions: hasOwn(body, 'bankInstructions')
        ? jsonObjectOrNull(body.bankInstructions)
        : existing.bankInstructions || Prisma.JsonNull,
      commercialPathways: commercialPathways as unknown as Prisma.InputJsonValue,
      trainingPolicy: trainingPolicy as unknown as Prisma.InputJsonValue,
      notes: hasOwn(body, 'notes')
        ? cleanStr(body.notes, 2000)
        : existing.notes,
      updatedByUserId: actorId,
    };

    const row = await prisma.clinicianOnboardingSetting.upsert({
      where: { id: 'default' },
      update: data,
      create: { id: 'default', ...data },
    });

    const settings = normaliseClinicianOnboardingSettings(row);

    await prisma.auditLog.create({
      data: {
        actorUserId: actorId,
        actorType: 'ADMIN',
        actorRefId: actorId,
        app: 'admin-dashboard',
        action: 'clinician_onboarding_policy.updated',
        entityType: 'ClinicianOnboardingSetting',
        entityId: 'default',
        description: 'Clinician training and C-Med continuation policy updated',
        ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          request.headers.get('x-real-ip') || null,
        userAgent: request.headers.get('user-agent'),
        meta: {
          currency: settings.currency,
          enabledPathways: settings.commercialPathways
            .filter((pathway) => pathway.enabled)
            .map((pathway) => pathway.key),
          starterKitItemCount: settings.starterKitItems.length,
          flexKitItemCount: settings.starterKitDepositItems.length,
          allowedModes: settings.trainingPolicy.allowedModes,
        },
      },
    }).catch((error) => {
      console.warn('[clinician-onboarding-settings] audit failed', error);
    });

    return NextResponse.json({
      ok: true,
      settings,
      publicSettings: publicClinicianOnboardingSettings(settings),
    });
  } catch (error: any) {
    console.error('[admin-clinician-onboarding-settings] error', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'settings_update_failed' },
      { status: 500 },
    );
  }
}
