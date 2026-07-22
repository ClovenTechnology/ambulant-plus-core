// apps/api-gateway/src/clinicians/onboarding/settings.ts
import { prisma } from '@/src/lib/prisma';

type DbLike = typeof prisma | any;

export type BalanceRecoveryMode =
  | 'manual'
  | 'payout_deduction'
  | 'disabled';

export type ClinicianOnboardingPathwayKey =
  | 'START_NOW_PAY_LATER'
  | 'QUALIFYING_DEPOSIT'
  | 'FULL_PAYMENT';

export type StarterKitReleaseLevel =
  | 'none'
  | 'deposit'
  | 'full';

export type ClinicianOnboardingPathwayPrivileges = {
  trainingAccess: boolean;
  practiceActivation: boolean;
  starterKitRelease: StarterKitReleaseLevel;
  platformIndemnityEligible: boolean;
  balanceRecoveryApplies: boolean;
};

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
  privileges: ClinicianOnboardingPathwayPrivileges;
};

export type ClinicianTrainingPolicy = {
  heading: string;
  introduction: string;
  timezone: string;
  defaultDurationDays: number;
  defaultSessionDurationMinutes: number;
  allowedModes: Array<'virtual' | 'in_person'>;
  virtualDescription: string;
  inPersonDescription: string;
  operationalNotice: string | null;
  supportMessage: string | null;
};

export const DEFAULT_CLINICIAN_ONBOARDING_PATHWAYS:
  ClinicianOnboardingCommercialPathway[] = [
    {
      key: 'START_NOW_PAY_LATER',
      displayOrder: 1,
      label: 'Start Now — Pay Later',
      badge: 'Fastest start',
      description:
        'Begin training after Ambulant+ Admin approves your Pay Later request, without an upfront onboarding payment.',
      ctaLabel: 'Request Pay Later approval',
      enabled: true,
      featured: true,
      conditions: [
        'Training access begins after Admin approval.',
        'No C-Med Kit is dispatched/released until a qualifying payment is received.',
        'Platform-wide Professional Indemnity eligibility begins only after a qualifying payment and applicable policy requirements.',
        'The outstanding onboarding balance remains payable.',
      ],
      privileges: {
        trainingAccess: true,
        practiceActivation: true,
        starterKitRelease: 'none',
        platformIndemnityEligible: false,
        balanceRecoveryApplies: true,
      },
    },
    {
      key: 'QUALIFYING_DEPOSIT',
      displayOrder: 2,
      label: 'Start with Initial Deposit',
      badge: 'Balanced option',
      description:
        'Pay the configured qualifying deposit and receive the benefits assigned to the deposit pathway.',
      ctaLabel: 'Pay initial deposit',
      enabled: true,
      featured: false,
      conditions: [
        'The qualifying initial amount is configured by Ambulant+ Admin.',
        'Only the C-Med items assigned to the deposit pathway are released.',
        'Professional Indemnity eligibility remains subject to the published policy conditions.',
        'The remaining onboarding balance remains payable.',
      ],
      privileges: {
        trainingAccess: true,
        practiceActivation: true,
        starterKitRelease: 'deposit',
        platformIndemnityEligible: true,
        balanceRecoveryApplies: true,
      },
    },
    {
      key: 'FULL_PAYMENT',
      displayOrder: 3,
      label: 'Pay in Full',
      badge: 'Complete package',
      description:
        'Settle the complete onboarding fee and receive the full configured onboarding package.',
      ctaLabel: 'Pay full onboarding fee',
      enabled: true,
      featured: false,
      conditions: [
        'The full Admin-configured onboarding fee is payable.',
        'The complete configured C-Med Kit can be released.',
        'Professional Indemnity eligibility remains subject to the published policy conditions.',
        'No onboarding-fee balance remains after confirmed full payment.',
      ],
      privileges: {
        trainingAccess: true,
        practiceActivation: true,
        starterKitRelease: 'full',
        platformIndemnityEligible: true,
        balanceRecoveryApplies: false,
      },
    },
  ];

export const DEFAULT_TRAINING_POLICY:
  ClinicianTrainingPolicy = {
    heading: 'Mandatory clinician onboarding training',
    introduction:
      'Choose an available programme, select an eligible training mode, and complete the applicable onboarding pathway.',
    timezone: 'Africa/Johannesburg',
    defaultDurationDays: 1,
    defaultSessionDurationMinutes: 60,
    allowedModes: ['virtual', 'in_person'],
    virtualDescription:
      'Attend remotely using the secure training room made available after confirmation.',
    inPersonDescription:
      'Attend at the venue shown in the selected programme.',
    operationalNotice: null,
    supportMessage:
      'If you need accessibility support or a special arrangement, contact Ambulant+ after selecting a programme.',
  };

export const DEFAULT_STARTER_KIT_ITEMS: string[] = [];

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
  starterKitDepositItems: string[];
  bankInstructions: Record<string, any> | null;
  commercialPathways:
    ClinicianOnboardingCommercialPathway[];
  trainingPolicy: ClinicianTrainingPolicy;
  notes: string | null;
};

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

function cents(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.round(number));
}

function positiveInteger(
  value: unknown,
  fallback: number,
  maximum: number,
): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;

  return Math.min(
    maximum,
    Math.max(1, Math.round(number)),
  );
}

function normaliseProvider(
  value: unknown,
): 'paystack' | 'payfast' {
  const provider = String(
    value ||
      process.env.CARD_PAYMENT_PROVIDER ||
      process.env.PAYMENT_PROVIDER ||
      'paystack',
  )
    .trim()
    .toLowerCase();

  return provider === 'payfast'
    ? 'payfast'
    : 'paystack';
}

function normaliseCurrency(value: unknown): string {
  const currency =
    String(value || 'ZAR')
      .trim()
      .toUpperCase();

  return /^[A-Z]{3}$/.test(currency)
    ? currency
    : 'ZAR';
}

function normaliseItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of value) {
    const item = cleanStr(
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

function normaliseJsonObject(
  value: unknown,
): Record<string, any> | null {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as Record<string, any>;
}

function cleanTextArray(
  value: unknown,
  fallback: string[],
): string[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const items =
    value
      .map((item) => cleanStr(item, 500))
      .filter(Boolean) as string[];

  return items.length
    ? items.slice(0, 12)
    : [...fallback];
}

function normalisePrivileges(
  value: unknown,
  fallback:
    ClinicianOnboardingPathwayPrivileges,
): ClinicianOnboardingPathwayPrivileges {
  const raw =
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
      ? value as Record<string, any>
      : {};

  const release =
    String(
      raw.starterKitRelease ||
      fallback.starterKitRelease,
    )
      .trim()
      .toLowerCase();

  return {
    trainingAccess:
      typeof raw.trainingAccess === 'boolean'
        ? raw.trainingAccess
        : fallback.trainingAccess,
    practiceActivation:
      typeof raw.practiceActivation === 'boolean'
        ? raw.practiceActivation
        : fallback.practiceActivation,
    starterKitRelease:
      release === 'full'
        ? 'full'
        : release === 'deposit'
          ? 'deposit'
          : 'none',
    platformIndemnityEligible:
      typeof raw.platformIndemnityEligible ===
      'boolean'
        ? raw.platformIndemnityEligible
        : fallback.platformIndemnityEligible,
    balanceRecoveryApplies:
      typeof raw.balanceRecoveryApplies ===
      'boolean'
        ? raw.balanceRecoveryApplies
        : fallback.balanceRecoveryApplies,
  };
}

function cloneDefaultPathways() {
  return DEFAULT_CLINICIAN_ONBOARDING_PATHWAYS.map(
    (pathway) => ({
      ...pathway,
      conditions: [...pathway.conditions],
      privileges: {...pathway.privileges},
    }),
  );
}

export function normaliseClinicianOnboardingCommercialPathways(
  value: unknown,
): ClinicianOnboardingCommercialPathway[] {
  const defaults = cloneDefaultPathways();

  if (!Array.isArray(value)) return defaults;

  const rawByKey =
    new Map<string, Record<string, any>>();

  for (const item of value) {
    if (
      !item ||
      typeof item !== 'object' ||
      Array.isArray(item)
    ) {
      continue;
    }

    const key =
      String((item as any).key || '')
        .trim()
        .toUpperCase();

    if (!rawByKey.has(key)) {
      rawByKey.set(
        key,
        item as Record<string, any>,
      );
    }
  }

  return defaults
    .map((fallback) => {
      const raw = rawByKey.get(fallback.key);
      if (!raw) return fallback;

      return {
        key: fallback.key,
        displayOrder: positiveInteger(
          raw.displayOrder,
          fallback.displayOrder,
          99,
        ),
        label:
          cleanStr(raw.label, 120) ||
          fallback.label,
        badge:
          Object.prototype.hasOwnProperty.call(
            raw,
            'badge',
          )
            ? cleanStr(raw.badge, 80)
            : fallback.badge,
        description:
          cleanStr(raw.description, 600) ||
          fallback.description,
        ctaLabel:
          cleanStr(raw.ctaLabel, 120) ||
          fallback.ctaLabel,
        enabled: raw.enabled !== false,
        featured: raw.featured === true,
        conditions: cleanTextArray(
          raw.conditions,
          fallback.conditions,
        ),
        privileges: normalisePrivileges(
          raw.privileges,
          fallback.privileges,
        ),
      };
    })
    .sort(
      (left, right) =>
        left.displayOrder -
          right.displayOrder ||
        defaults.findIndex(
          (item) => item.key === left.key,
        ) -
          defaults.findIndex(
            (item) => item.key === right.key,
          ),
    );
}

export function normaliseClinicianTrainingPolicy(
  value: unknown,
): ClinicianTrainingPolicy {
  const raw =
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
      ? value as Record<string, any>
      : {};

  const requestedModes =
    Array.isArray(raw.allowedModes)
      ? raw.allowedModes
          .map((mode: unknown) =>
            String(mode || '')
              .trim()
              .toLowerCase(),
          )
          .filter(
            (mode: string) =>
              mode === 'virtual' ||
              mode === 'in_person',
          )
      : [];

  const allowedModes =
    Array.from(new Set(requestedModes)) as
      Array<'virtual' | 'in_person'>;

  return {
    heading:
      cleanStr(raw.heading, 180) ||
      DEFAULT_TRAINING_POLICY.heading,
    introduction:
      cleanStr(raw.introduction, 1500) ||
      DEFAULT_TRAINING_POLICY.introduction,
    timezone:
      cleanStr(raw.timezone, 120) ||
      DEFAULT_TRAINING_POLICY.timezone,
    defaultDurationDays: positiveInteger(
      raw.defaultDurationDays,
      DEFAULT_TRAINING_POLICY.defaultDurationDays,
      365,
    ),
    defaultSessionDurationMinutes: positiveInteger(
      raw.defaultSessionDurationMinutes,
      DEFAULT_TRAINING_POLICY
        .defaultSessionDurationMinutes,
      1440,
    ),
    allowedModes:
      allowedModes.length
        ? allowedModes
        : [...DEFAULT_TRAINING_POLICY.allowedModes],
    virtualDescription:
      cleanStr(raw.virtualDescription, 800) ||
      DEFAULT_TRAINING_POLICY.virtualDescription,
    inPersonDescription:
      cleanStr(raw.inPersonDescription, 800) ||
      DEFAULT_TRAINING_POLICY.inPersonDescription,
    operationalNotice:
      cleanStr(raw.operationalNotice, 2000),
    supportMessage:
      cleanStr(raw.supportMessage, 1000),
  };
}

function normaliseRecoveryMode(
  value: unknown,
): BalanceRecoveryMode {
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

function effectiveMinimumInitialPayment(args: {
  trainingFeeCents: number;
  minimumInitialPaymentCents: number;
  allowPartialPayment: boolean;
}) {
  const full = cents(args.trainingFeeCents);
  const minimum =
    cents(args.minimumInitialPaymentCents);

  if (full <= 0) return 0;
  if (!args.allowPartialPayment) return full;
  if (minimum <= 0) return full;

  return Math.min(minimum, full);
}

export function normaliseClinicianOnboardingSettings(
  row: any,
): ClinicianOnboardingSettings {
  const trainingFeeCents =
    cents(row?.trainingFeeCents);

  const allowPartialPayment =
    row?.allowPartialPayment === true;

  const starterKitItems =
    normaliseItems(row?.starterKitItems);

  const kitByIdentity =
    new Map(
      starterKitItems.map((item) => [
        item.toLowerCase(),
        item,
      ]),
    );

  const starterKitDepositItems =
    normaliseItems(row?.starterKitDepositItems)
      .map((item) =>
        kitByIdentity.get(item.toLowerCase()),
      )
      .filter(Boolean) as string[];

  return {
    id: String(row?.id || 'default'),
    trainingFeeCents,
    minimumInitialPaymentCents:
      effectiveMinimumInitialPayment({
        trainingFeeCents,
        minimumInitialPaymentCents:
          cents(row?.minimumInitialPaymentCents),
        allowPartialPayment,
      }),
    allowPartialPayment,
    balanceRecoveryMode:
      normaliseRecoveryMode(
        row?.balanceRecoveryMode,
      ),
    balanceRecoveryNotes:
      cleanStr(row?.balanceRecoveryNotes, 2000),
    currency:
      normaliseCurrency(row?.currency),
    paymentProvider:
      normaliseProvider(row?.paymentProvider),
    cardPaymentEnabled:
      row?.cardPaymentEnabled !== false,
    manualPaymentEnabled:
      row?.manualPaymentEnabled !== false,
    starterKitItems,
    starterKitDepositItems,
    bankInstructions:
      normaliseJsonObject(row?.bankInstructions),
    commercialPathways:
      normaliseClinicianOnboardingCommercialPathways(
        row?.commercialPathways,
      ),
    trainingPolicy:
      normaliseClinicianTrainingPolicy(
        row?.trainingPolicy,
      ),
    notes: cleanStr(row?.notes, 2000),
  };
}

export async function getClinicianOnboardingSettings(
  db: DbLike = prisma,
): Promise<ClinicianOnboardingSettings> {
  const existing =
    await db.clinicianOnboardingSetting.findUnique({
      where: {id: 'default'},
    });

  if (existing) {
    return normaliseClinicianOnboardingSettings(
      existing,
    );
  }

  const created =
    await db.clinicianOnboardingSetting.create({
      data: {
        id: 'default',
        trainingFeeCents: 0,
        minimumInitialPaymentCents: 0,
        allowPartialPayment: false,
        balanceRecoveryMode: 'manual',
        balanceRecoveryNotes: null,
        currency: 'ZAR',
        paymentProvider:
          normaliseProvider(
            process.env.CARD_PAYMENT_PROVIDER,
          ),
        cardPaymentEnabled: true,
        manualPaymentEnabled: true,
        starterKitItems:
          DEFAULT_STARTER_KIT_ITEMS,
        starterKitDepositItems: [],
        bankInstructions: null,
        commercialPathways:
          DEFAULT_CLINICIAN_ONBOARDING_PATHWAYS,
        trainingPolicy:
          DEFAULT_TRAINING_POLICY,
        notes:
          'Configure clinician onboarding from Admin Dashboard.',
      },
    });

  return normaliseClinicianOnboardingSettings(
    created,
  );
}

export function publicClinicianOnboardingSettings(
  settings: ClinicianOnboardingSettings,
) {
  return {
    trainingFeeCents:
      settings.trainingFeeCents,
    minimumInitialPaymentCents:
      settings.minimumInitialPaymentCents,
    allowPartialPayment:
      settings.allowPartialPayment,
    balanceRecoveryMode:
      settings.balanceRecoveryMode,
    balanceRecoveryNotes:
      settings.balanceRecoveryNotes,
    currency: settings.currency,
    paymentProvider:
      settings.paymentProvider,
    cardPaymentEnabled:
      settings.cardPaymentEnabled,
    manualPaymentEnabled:
      settings.manualPaymentEnabled,
    starterKitItems:
      settings.starterKitItems,
    starterKitDepositItems:
      settings.starterKitDepositItems,
    bankInstructions:
      settings.manualPaymentEnabled
        ? settings.bankInstructions
        : null,
    commercialPathways:
      settings.commercialPathways,
    trainingPolicy:
      settings.trainingPolicy,
    configured:
      settings.trainingFeeCents > 0 &&
      settings.starterKitItems.length > 0,
  };
}

export function calculateOnboardingPaymentState(
  args: {
    trainingFeeCents: number;
    minimumInitialPaymentCents: number;
    amountPaidCents: number;
  },
) {
  const full = cents(args.trainingFeeCents);

  const minimum =
    Math.min(
      cents(args.minimumInitialPaymentCents),
      full,
    );

  const paid = cents(args.amountPaidCents);
  const outstanding = Math.max(0, full - paid);

  const fullyPaid =
    full > 0 && paid >= full;

  const initialRequirementMet =
    full > 0 &&
    paid > 0 &&
    paid >= minimum;

  return {
    trainingFeeCents: full,
    minimumInitialPaymentCents: minimum,
    amountPaidCents: paid,
    outstandingCents: outstanding,
    initialRequirementMet,
    fullyPaid,
    paymentStatus:
      fullyPaid
        ? 'fully_paid'
        : paid > 0
          ? 'partially_paid'
          : 'unpaid',
  };
}
