// apps/api-gateway/app/api/admin/clinicians/onboarding/settings/route.ts
import {
  NextRequest,
  NextResponse,
} from 'next/server';
import {Prisma} from '@prisma/client';
import {prisma} from '@/src/lib/prisma';
import {
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

    if (!admin.ok) {
      return admin.response;
    }

    const body =
      await request
        .json()
        .catch(() => ({} as Record<string, any>));

    const existing =
      await getClinicianOnboardingSettings();

    const trainingFeeCents =
      hasOwn(body, 'trainingFeeCents')
        ? moneyCents(body.trainingFeeCents)
        : existing.trainingFeeCents;

    if (
      trainingFeeCents == null ||
      trainingFeeCents <= 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'full_onboarding_fee_must_be_greater_than_zero',
        },
        {status: 400},
      );
    }

    const allowPartialPayment =
      hasOwn(body, 'allowPartialPayment')
        ? body.allowPartialPayment === true
        : existing.allowPartialPayment;

    const minimumInitialPaymentCents =
      hasOwn(body, 'minimumInitialPaymentCents')
        ? moneyCents(
            body.minimumInitialPaymentCents,
          ) ?? 0
        : existing.minimumInitialPaymentCents;

    if (
      allowPartialPayment &&
      minimumInitialPaymentCents <= 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'minimum_initial_payment_required',
        },
        {status: 400},
      );
    }

    if (
      minimumInitialPaymentCents >
      trainingFeeCents
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'minimum_initial_payment_cannot_exceed_full_fee',
        },
        {status: 400},
      );
    }

    const starterKitItems =
      hasOwn(body, 'starterKitItems')
        ? stringArray(body.starterKitItems)
        : existing.starterKitItems;

    if (!starterKitItems.length) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'at_least_one_c_med_kit_item_required',
        },
        {status: 400},
      );
    }

    const kitByIdentity =
      new Map(
        starterKitItems.map((item) => [
          item.toLowerCase(),
          item,
        ]),
      );

    const requestedDepositItems =
      hasOwn(body, 'starterKitDepositItems')
        ? stringArray(
            body.starterKitDepositItems,
          )
        : existing.starterKitDepositItems;

    const unknownDepositItem =
      requestedDepositItems.find(
        (item) =>
          !kitByIdentity.has(
            item.toLowerCase(),
          ),
      );

    if (unknownDepositItem) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'deposit_kit_items_must_belong_to_full_kit',
          item: unknownDepositItem,
        },
        {status: 400},
      );
    }

    const starterKitDepositItems =
      requestedDepositItems.map(
        (item) =>
          kitByIdentity.get(
            item.toLowerCase(),
          )!,
      );

    const commercialPathways =
      normaliseClinicianOnboardingCommercialPathways(
        hasOwn(body, 'commercialPathways')
          ? body.commercialPathways
          : existing.commercialPathways,
      );

    const enabled =
      commercialPathways.filter(
        (pathway) => pathway.enabled,
      );

    const featured =
      commercialPathways.filter(
        (pathway) => pathway.featured,
      );

    if (!enabled.length) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'at_least_one_payment_pathway_must_be_enabled',
        },
        {status: 400},
      );
    }

    if (
      featured.length !== 1 ||
      !featured[0]?.enabled
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'exactly_one_enabled_pathway_must_be_featured',
        },
        {status: 400},
      );
    }

    const orders =
      commercialPathways.map(
        (pathway) => pathway.displayOrder,
      );

    if (
      new Set(orders).size !==
      orders.length
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'payment_pathway_display_orders_must_be_unique',
        },
        {status: 400},
      );
    }

    const depositPathway =
      commercialPathways.find(
        (pathway) =>
          pathway.key ===
          'QUALIFYING_DEPOSIT',
      );

    if (
      depositPathway?.enabled &&
      !allowPartialPayment
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'enable_partial_payment_or_disable_deposit_pathway',
        },
        {status: 400},
      );
    }

    if (
      depositPathway?.enabled &&
      depositPathway.privileges
        .starterKitRelease === 'deposit' &&
      !starterKitDepositItems.length
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'select_at_least_one_deposit_kit_item',
        },
        {status: 400},
      );
    }

    const cardPaymentEnabled =
      hasOwn(body, 'cardPaymentEnabled')
        ? body.cardPaymentEnabled !== false
        : existing.cardPaymentEnabled;

    const manualPaymentEnabled =
      hasOwn(body, 'manualPaymentEnabled')
        ? body.manualPaymentEnabled !== false
        : existing.manualPaymentEnabled;

    const paidPathwayEnabled =
      enabled.some(
        (pathway) =>
          pathway.key !==
          'START_NOW_PAY_LATER',
      );

    if (
      paidPathwayEnabled &&
      !cardPaymentEnabled &&
      !manualPaymentEnabled
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'enable_card_or_eft_for_paid_pathways',
        },
        {status: 400},
      );
    }

    const trainingPolicy =
      normaliseClinicianTrainingPolicy(
        hasOwn(body, 'trainingPolicy')
          ? body.trainingPolicy
          : existing.trainingPolicy,
      );

    const actorId =
      cleanStr(
        (admin as any).uid ||
        (admin as any).userId ||
        'admin-api-key',
        120,
      );

    const data: any = {
      trainingFeeCents,
      minimumInitialPaymentCents,
      allowPartialPayment,
      balanceRecoveryMode:
        hasOwn(body, 'balanceRecoveryMode')
          ? recoveryMode(
              body.balanceRecoveryMode,
            )
          : existing.balanceRecoveryMode,
      balanceRecoveryNotes:
        hasOwn(body, 'balanceRecoveryNotes')
          ? cleanStr(
              body.balanceRecoveryNotes,
              2000,
            )
          : existing.balanceRecoveryNotes,
      currency:
        hasOwn(body, 'currency')
          ? currency(body.currency)
          : existing.currency,
      paymentProvider:
        hasOwn(body, 'paymentProvider')
          ? provider(body.paymentProvider)
          : existing.paymentProvider,
      cardPaymentEnabled,
      manualPaymentEnabled,
      starterKitItems,
      starterKitDepositItems,
      bankInstructions:
        hasOwn(body, 'bankInstructions')
          ? jsonObjectOrNull(
              body.bankInstructions,
            )
          : existing.bankInstructions ||
            Prisma.JsonNull,
      commercialPathways:
        commercialPathways as unknown as
          Prisma.InputJsonValue,
      trainingPolicy:
        trainingPolicy as unknown as
          Prisma.InputJsonValue,
      notes:
        hasOwn(body, 'notes')
          ? cleanStr(body.notes, 2000)
          : existing.notes,
      updatedByUserId: actorId,
    };

    const row =
      await prisma
        .clinicianOnboardingSetting
        .upsert({
          where: {id: 'default'},
          update: data,
          create: {
            id: 'default',
            ...data,
          },
        });

    const settings =
      normaliseClinicianOnboardingSettings(
        row,
      );

    await prisma.auditLog
      .create({
        data: {
          actorUserId: actorId,
          actorType: 'ADMIN',
          actorRefId: actorId,
          app: 'admin-dashboard',
          action:
            'clinician_onboarding_policy.updated',
          entityType:
            'ClinicianOnboardingSetting',
          entityId: 'default',
          description:
            'Clinician training, payment and C-Med policy updated',
          ip:
            request.headers
              .get('x-forwarded-for')
              ?.split(',')[0]
              ?.trim() ||
            request.headers
              .get('x-real-ip') ||
            null,
          userAgent:
            request.headers
              .get('user-agent'),
          meta: {
            currency: settings.currency,
            trainingFeeCents:
              settings.trainingFeeCents,
            minimumInitialPaymentCents:
              settings.minimumInitialPaymentCents,
            starterKitItemCount:
              settings.starterKitItems.length,
            depositKitItemCount:
              settings
                .starterKitDepositItems
                .length,
            allowedModes:
              settings.trainingPolicy
                .allowedModes,
          },
        },
      })
      .catch((error) => {
        console.warn(
          '[clinician-onboarding-settings] audit failed',
          error,
        );
      });

    return NextResponse.json({
      ok: true,
      settings,
      publicSettings:
        publicClinicianOnboardingSettings(
          settings,
        ),
    });
  } catch (error: any) {
    console.error(
      '[admin-clinician-onboarding-settings] error',
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          'settings_update_failed',
      },
      {status: 500},
    );
  }
}
