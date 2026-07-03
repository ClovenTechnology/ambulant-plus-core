// apps/api-gateway/src/clinicians/onboarding/settings.ts
import { prisma } from '@/src/lib/prisma';

type DbLike = typeof prisma | any;

export type BalanceRecoveryMode = 'manual' | 'payout_deduction' | 'disabled';

export type ClinicianOnboardingSettings = {
  id: string;
  trainingFeeCents: number;
  minimumInitialPaymentCents: number;
  allowPartialPayment: boolean;
  balanceRecoveryMode: BalanceRecoveryMode;
  balanceRecoveryNotes: string | null;
  currency: string;
  paymentProvider: 'paystack' | 'payfast' | 'mock';
  cardPaymentEnabled: boolean;
  manualPaymentEnabled: boolean;
  starterKitItems: string[];
  bankInstructions: Record<string, any> | null;
  notes: string | null;
};

export const DEFAULT_STARTER_KIT_ITEMS: string[] = [];

function cleanStr(value: unknown, max = 500): string | null {
  const s = String(value ?? '').trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function normaliseProvider(value: unknown): 'paystack' | 'payfast' | 'mock' {
  const v = String(value || process.env.CARD_PAYMENT_PROVIDER || process.env.PAYMENT_PROVIDER || 'paystack')
    .trim()
    .toLowerCase();

  if (v === 'paystack' || v === 'payfast' || v === 'mock') return v;
  return 'paystack';
}

function normaliseCurrency(value: unknown): string {
  const v = String(value || 'ZAR').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(v) ? v : 'ZAR';
}

function normaliseItems(value: unknown): string[] {
  if (Array.isArray(value)) {
    const items = value
      .map((x) => cleanStr(typeof x === 'string' ? x : (x as any)?.label, 180))
      .filter(Boolean) as string[];

    if (items.length > 0) return items;
  }

  return DEFAULT_STARTER_KIT_ITEMS;
}

function normaliseJsonObject(value: unknown): Record<string, any> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, any>;
}

function cents(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function normaliseBalanceRecoveryMode(value: unknown): BalanceRecoveryMode {
  const v = String(value || 'manual').trim().toLowerCase();
  if (v === 'payout_deduction' || v === 'manual' || v === 'disabled') return v;
  return 'manual';
}

function effectiveMinimumInitialPayment(args: {
  trainingFeeCents: number;
  minimumInitialPaymentCents: number;
  allowPartialPayment: boolean;
}) {
  const full = Math.max(0, Math.round(Number(args.trainingFeeCents || 0)));
  const min = Math.max(0, Math.round(Number(args.minimumInitialPaymentCents || 0)));

  if (full <= 0) return 0;
  if (!args.allowPartialPayment) return full;
  if (min <= 0) return full;

  return Math.min(min, full);
}

export function normaliseClinicianOnboardingSettings(row: any): ClinicianOnboardingSettings {
  const trainingFeeCents = cents(row?.trainingFeeCents);
  const allowPartialPayment = row?.allowPartialPayment === true;
  const minimumInitialPaymentCents = effectiveMinimumInitialPayment({
    trainingFeeCents,
    minimumInitialPaymentCents: cents(row?.minimumInitialPaymentCents),
    allowPartialPayment,
  });

  return {
    id: String(row?.id || 'default'),
    trainingFeeCents,
    minimumInitialPaymentCents,
    allowPartialPayment,
    balanceRecoveryMode: normaliseBalanceRecoveryMode(row?.balanceRecoveryMode),
    balanceRecoveryNotes: cleanStr(row?.balanceRecoveryNotes, 2000),
    currency: normaliseCurrency(row?.currency),
    paymentProvider: normaliseProvider(row?.paymentProvider),
    cardPaymentEnabled: row?.cardPaymentEnabled !== false,
    manualPaymentEnabled: row?.manualPaymentEnabled !== false,
    starterKitItems: normaliseItems(row?.starterKitItems),
    bankInstructions: normaliseJsonObject(row?.bankInstructions),
    notes: cleanStr(row?.notes, 2000),
  };
}

export async function getClinicianOnboardingSettings(db: DbLike = prisma): Promise<ClinicianOnboardingSettings> {
  const existing = await db.clinicianOnboardingSetting.findUnique({ where: { id: 'default' } });
  if (existing) return normaliseClinicianOnboardingSettings(existing);

  const created = await db.clinicianOnboardingSetting.create({
    data: {
      id: 'default',
      trainingFeeCents: 0,
      minimumInitialPaymentCents: 0,
      allowPartialPayment: false,
      balanceRecoveryMode: 'manual',
      balanceRecoveryNotes: null,
      currency: 'ZAR',
      paymentProvider: normaliseProvider(process.env.CARD_PAYMENT_PROVIDER || process.env.PAYMENT_PROVIDER || 'paystack'),
      cardPaymentEnabled: true,
      manualPaymentEnabled: true,
      starterKitItems: DEFAULT_STARTER_KIT_ITEMS,
      bankInstructions: null,
      notes: 'Configure clinician onboarding training fee, payment rules and C-Med StarterKit contents from Admin Dashboard.',
    },
  });

  return normaliseClinicianOnboardingSettings(created);
}

export function publicClinicianOnboardingSettings(settings: ClinicianOnboardingSettings) {
  return {
    trainingFeeCents: settings.trainingFeeCents,
    minimumInitialPaymentCents: settings.minimumInitialPaymentCents,
    allowPartialPayment: settings.allowPartialPayment,
    balanceRecoveryMode: settings.balanceRecoveryMode,
    balanceRecoveryNotes: settings.balanceRecoveryNotes,
    currency: settings.currency,
    paymentProvider: settings.paymentProvider,
    cardPaymentEnabled: settings.cardPaymentEnabled,
    manualPaymentEnabled: settings.manualPaymentEnabled,
    starterKitItems: settings.starterKitItems,
    bankInstructions: settings.manualPaymentEnabled ? settings.bankInstructions : null,
    configured: settings.trainingFeeCents > 0,
  };
}

export function calculateOnboardingPaymentState(args: {
  trainingFeeCents: number;
  minimumInitialPaymentCents: number;
  amountPaidCents: number;
}) {
  const full = Math.max(0, Math.round(Number(args.trainingFeeCents || 0)));
  const minimum = Math.min(
    Math.max(0, Math.round(Number(args.minimumInitialPaymentCents || 0))),
    full,
  );
  const paid = Math.max(0, Math.round(Number(args.amountPaidCents || 0)));
  const outstanding = Math.max(0, full - paid);

  const fullyPaid = full > 0 && paid >= full;
  const initialRequirementMet = full > 0 && paid >= minimum;
  const paymentStatus = fullyPaid
    ? 'fully_paid'
    : paid > 0
      ? 'partially_paid'
      : 'unpaid';

  return {
    trainingFeeCents: full,
    minimumInitialPaymentCents: minimum,
    amountPaidCents: paid,
    outstandingCents: outstanding,
    initialRequirementMet,
    fullyPaid,
    paymentStatus,
  };
}