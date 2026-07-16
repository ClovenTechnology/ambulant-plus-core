// apps/api-gateway/app/api/admin/clinicians/onboarding/settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/src/lib/prisma';
import {
  DEFAULT_CLINICIAN_ONBOARDING_PATHWAYS,
  DEFAULT_STARTER_KIT_ITEMS,
  normaliseClinicianOnboardingCommercialPathways,
  normaliseClinicianOnboardingSettings,
  publicClinicianOnboardingSettings,
} from '@/src/clinicians/onboarding/settings';
import { verifyAdminRequest } from '../../../utils/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanStr(value: unknown, max = 500): string | null {
  const s = String(value ?? '').trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function moneyCents(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n));
}

function currency(value: unknown): string {
  const s = String(value || 'ZAR').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(s) ? s : 'ZAR';
}

function provider(value: unknown): string {
  const s = String(value || process.env.CARD_PAYMENT_PROVIDER || 'paystack')
    .trim()
    .toLowerCase();

  return ['paystack', 'payfast'].includes(s) ? (s as any) : 'paystack';
}

function balanceRecoveryMode(value: unknown): 'manual' | 'payout_deduction' | 'disabled' {
  const s = String(value || 'manual').trim().toLowerCase();
  return ['manual', 'payout_deduction', 'disabled'].includes(s)
    ? (s as 'manual' | 'payout_deduction' | 'disabled')
    : 'manual';
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return DEFAULT_STARTER_KIT_ITEMS;

  const out = value
    .map((x) => cleanStr(typeof x === 'string' ? x : (x as any)?.label, 180))
    .filter(Boolean) as string[];

  return out.length > 0 ? out : DEFAULT_STARTER_KIT_ITEMS;
}

function jsonObjectOrNull(value: unknown): Record<string, any> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, any>;
}

function jsonNullable(value: unknown) {
  return jsonObjectOrNull(value) ?? Prisma.JsonNull;
}

function isTrustedAdminKey(req: NextRequest) {
  const expected = String(process.env.ADMIN_API_KEY || '').trim();
  if (!expected) return false;

  const got =
    req.headers.get('x-admin-key') ||
    req.headers.get('X-Admin-Key') ||
    '';

  return String(got).trim() === expected;
}

async function requireAdmin(req: NextRequest) {
  if (isTrustedAdminKey(req)) {
    return {
      ok: true as const,
      uid: 'admin-api-key',
      userId: 'admin-api-key',
      source: 'admin-api-key',
    };
  }

  const verified = await verifyAdminRequest(req);
  if ((verified as any)?.ok === false) return verified;

  return verified;
}

export async function GET(req: NextRequest) {
  const isAdmin = await requireAdmin(req);
  if ((isAdmin as any)?.ok === false) return (isAdmin as any).response;

  const row = await prisma.clinicianOnboardingSetting.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      trainingFeeCents: 0,
      minimumInitialPaymentCents: 0,
      allowPartialPayment: false,
      balanceRecoveryMode: 'manual',
      balanceRecoveryNotes: null,
      currency: 'ZAR',
      paymentProvider: provider(process.env.CARD_PAYMENT_PROVIDER),
      cardPaymentEnabled: true,
      manualPaymentEnabled: true,
      starterKitItems: DEFAULT_STARTER_KIT_ITEMS,
      bankInstructions: Prisma.JsonNull,
      commercialPathways:
        DEFAULT_CLINICIAN_ONBOARDING_PATHWAYS as unknown as Prisma.InputJsonValue,
      notes: 'Configure clinician onboarding payment settings from Admin Dashboard.',
    },
  });

  const settings = normaliseClinicianOnboardingSettings(row);

  return NextResponse.json({
    ok: true,
    settings,
    publicSettings: publicClinicianOnboardingSettings(settings),
  });
}

export async function PATCH(req: NextRequest) {
  try {
    const isAdmin = await requireAdmin(req);
    if ((isAdmin as any)?.ok === false) return (isAdmin as any).response;

    const body = (await req.json().catch(() => ({}))) as any;

    const amount = moneyCents(body.trainingFeeCents ?? body.amountCents);
    if (amount == null) {
      return NextResponse.json(
        { ok: false, error: 'trainingFeeCents_required' },
        { status: 400 },
      );
    }

    const minimumInitialPaymentCents =
      moneyCents(body.minimumInitialPaymentCents) ?? 0;

    const allowPartialPayment = body.allowPartialPayment === true;
    const recoveryMode = balanceRecoveryMode(body.balanceRecoveryMode);

    const existingSettingsRow =
      await prisma.clinicianOnboardingSetting.findUnique({
        where: { id: 'default' },
      });

    const pathwayInput =
      Object.prototype.hasOwnProperty.call(
        body,
        'commercialPathways',
      )
        ? body.commercialPathways
        : existingSettingsRow?.commercialPathways;

    const commercialPathways =
      normaliseClinicianOnboardingCommercialPathways(
        pathwayInput,
      );

    const enabledPathways =
      commercialPathways.filter(
        (pathway) =>
          pathway.enabled,
      );

    const featuredPathways =
      commercialPathways.filter(
        (pathway) =>
          pathway.featured,
      );

    const pathwayOrders =
      commercialPathways.map(
        (pathway) =>
          pathway.displayOrder,
      );

    if (enabledPathways.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'atLeastOneCommercialPathwayMustBeEnabled',
        },
        { status: 400 },
      );
    }

    if (
      featuredPathways.length !== 1 ||
      featuredPathways[0]?.enabled !== true
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'exactlyOneEnabledCommercialPathwayMustBeFeatured',
        },
        { status: 400 },
      );
    }

    if (
      new Set(pathwayOrders).size !==
      pathwayOrders.length
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'commercialPathwayDisplayOrdersMustBeUnique',
        },
        { status: 400 },
      );
    }

    if (allowPartialPayment && minimumInitialPaymentCents <= 0) {
      return NextResponse.json(
        { ok: false, error: 'minimumInitialPaymentCents_required_when_partial_payment_enabled' },
        { status: 400 },
      );
    }

    if (minimumInitialPaymentCents > amount) {
      return NextResponse.json(
        { ok: false, error: 'minimumInitialPaymentCannotExceedTrainingFee' },
        { status: 400 },
      );
    }

    const updatedByUserId = cleanStr(
      (isAdmin as any)?.uid ||
        (isAdmin as any)?.userId ||
        body.updatedByUserId ||
        'admin-api-key',
      120,
    );

    const row = await prisma.clinicianOnboardingSetting.upsert({
      where: { id: 'default' },
      update: {
        trainingFeeCents: amount,
        minimumInitialPaymentCents,
        allowPartialPayment,
        balanceRecoveryMode: recoveryMode,
        balanceRecoveryNotes: cleanStr(body.balanceRecoveryNotes, 2000),
        currency: currency(body.currency),
        paymentProvider: provider(body.paymentProvider),
        cardPaymentEnabled: body.cardPaymentEnabled !== false,
        manualPaymentEnabled: body.manualPaymentEnabled !== false,
        starterKitItems: stringArray(body.starterKitItems),
        bankInstructions: jsonNullable(body.bankInstructions),
        commercialPathways:
          commercialPathways as unknown as Prisma.InputJsonValue,
        notes: cleanStr(body.notes, 2000),
        updatedByUserId,
      },
      create: {
        id: 'default',
        trainingFeeCents: amount,
        minimumInitialPaymentCents,
        allowPartialPayment,
        balanceRecoveryMode: recoveryMode,
        balanceRecoveryNotes: cleanStr(body.balanceRecoveryNotes, 2000),
        currency: currency(body.currency),
        paymentProvider: provider(body.paymentProvider),
        cardPaymentEnabled: body.cardPaymentEnabled !== false,
        manualPaymentEnabled: body.manualPaymentEnabled !== false,
        starterKitItems: stringArray(body.starterKitItems),
        bankInstructions: jsonNullable(body.bankInstructions),
        commercialPathways:
          commercialPathways as unknown as Prisma.InputJsonValue,
        notes: cleanStr(body.notes, 2000),
        updatedByUserId,
      },
    });

    const settings = normaliseClinicianOnboardingSettings(row);

    return NextResponse.json({
      ok: true,
      settings,
      publicSettings: publicClinicianOnboardingSettings(settings),
    });
  } catch (err: any) {
    console.error('[admin-clinician-onboarding-settings] error', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'settings_update_failed' },
      { status: 500 },
    );
  }
}

