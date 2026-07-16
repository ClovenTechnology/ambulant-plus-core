// apps/api-gateway/src/clinicians/onboarding/settings.ts
import { prisma } from '@/src/lib/prisma';

type DbLike = typeof prisma | any;

export type BalanceRecoveryMode = 'manual' | 'payout_deduction' | 'disabled';

export type ClinicianOnboardingPathwayKey =
  | 'START_NOW_PAY_LATER'
  | 'QUALIFYING_DEPOSIT'
  | 'FULL_PAYMENT';

export type ClinicianOnboardingCommercialPathway = {
  key: ClinicianOnboardingPathwayKey;
  displayOrder: number;
  label: string;
  badge: string | null;
  description: string;
  ctaLabel: string;
  enabled: boolean;
  featured: boolean;
  conditions: string[];
};

export const DEFAULT_CLINICIAN_ONBOARDING_PATHWAYS: ClinicianOnboardingCommercialPathway[] = [
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


export type ClinicianOnboardingSettings = {
  id: string;
  trainingFeeCents: number;
  minimumInitialPaymentCents: number;
  allowPartialPayment: boolean;
  balanceRecoveryMode: BalanceRecoveryMode;
  balanceRecoveryNotes: string | null;
  currency: string;
  paymentProvider: 'paystack' | 'payfast';
  cardPaymentEnabled: boolean;
  manualPaymentEnabled: boolean;
  starterKitItems: string[];
  bankInstructions: Record<string, any> | null;
  commercialPathways: ClinicianOnboardingCommercialPathway[];
  notes: string | null;
};

export const DEFAULT_STARTER_KIT_ITEMS: string[] = [];

function cleanStr(value: unknown, max = 500): string | null {
  const s = String(value ?? '').trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function normaliseProvider(value: unknown): 'paystack' | 'payfast' {
  const v = String(value || process.env.CARD_PAYMENT_PROVIDER || process.env.PAYMENT_PROVIDER || 'paystack')
    .trim()
    .toLowerCase();

  if (v === 'paystack' || v === 'payfast') return v;
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


function cleanTextArray(
  value: unknown,
  fallback: string[],
): string[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const items = value
    .map((item) =>
      cleanStr(item, 500),
    )
    .filter(Boolean) as string[];

  return items.length > 0
    ? items.slice(0, 12)
    : [...fallback];
}

function cloneDefaultCommercialPathways(): ClinicianOnboardingCommercialPathway[] {
  return DEFAULT_CLINICIAN_ONBOARDING_PATHWAYS.map(
    (pathway) => ({
      ...pathway,
      conditions: [
        ...pathway.conditions,
      ],
    }),
  );
}

export function normaliseClinicianOnboardingCommercialPathways(
  value: unknown,
): ClinicianOnboardingCommercialPathway[] {
  const defaults =
    cloneDefaultCommercialPathways();

  if (!Array.isArray(value)) {
    return defaults;
  }

  const defaultByKey = new Map(
    defaults.map((pathway) => [
      pathway.key,
      pathway,
    ]),
  );

  const accepted = new Map<
    ClinicianOnboardingPathwayKey,
    ClinicianOnboardingCommercialPathway
  >();

  for (const raw of value) {
    if (
      !raw ||
      typeof raw !== 'object' ||
      Array.isArray(raw)
    ) {
      continue;
    }

    const key = String(
      (raw as any).key || '',
    )
      .trim()
      .toUpperCase() as
      ClinicianOnboardingPathwayKey;

    const fallback =
      defaultByKey.get(key);

    if (!fallback || accepted.has(key)) {
      continue;
    }

    const requestedOrder = Number(
      (raw as any).displayOrder,
    );

    const displayOrder =
      Number.isFinite(requestedOrder)
        ? Math.min(
            99,
            Math.max(
              1,
              Math.round(
                requestedOrder,
              ),
            ),
          )
        : fallback.displayOrder;

    accepted.set(key, {
      key,
      displayOrder,
      label:
        cleanStr(
          (raw as any).label,
          120,
        ) || fallback.label,
      badge:
        cleanStr(
          (raw as any).badge,
          80,
        ),
      description:
        cleanStr(
          (raw as any).description,
          600,
        ) ||
        fallback.description,
      ctaLabel:
        cleanStr(
          (raw as any).ctaLabel,
          120,
        ) ||
        fallback.ctaLabel,
      enabled:
        (raw as any).enabled !== false,
      featured:
        (raw as any).featured === true,
      conditions: cleanTextArray(
        (raw as any).conditions,
        fallback.conditions,
      ),
    });
  }

  const merged = defaults.map(
    (fallback) =>
      accepted.get(fallback.key) ||
      fallback,
  );

  return merged.sort(
    (left, right) =>
      left.displayOrder -
        right.displayOrder ||
      defaults.findIndex(
        (item) =>
          item.key === left.key,
      ) -
        defaults.findIndex(
          (item) =>
            item.key === right.key,
        ),
  );
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
    commercialPathways:
      normaliseClinicianOnboardingCommercialPathways(
        row?.commercialPathways,
      ),
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
      commercialPathways:
        DEFAULT_CLINICIAN_ONBOARDING_PATHWAYS,
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
    commercialPathways:
      settings.commercialPathways,
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