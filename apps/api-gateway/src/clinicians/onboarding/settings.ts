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
  standardPriceCents: number | null;
  promotionalPriceCents: number | null;
  promotionStartsAt: string | null;
  promotionEndsAt: string | null;
  amountDueTodayCents: number | null;
  promotionLabel: string | null;
};

export type ClinicianSignupPresentation = {
  heroHeading: string;
  heroIntroduction: string;
  noticeHeading: string;
  noticeBody: string;
  noticeSecondary: string;
  noticeCtaLabel: string;
  noticeCtaHref: string;
  optionalKitTitle: string;
  optionalKitDescription: string;
  successHeading: string;
  successBody: string;
  successSecondary: string;
  successCtaLabel: string;
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
  signupPresentation: ClinicianSignupPresentation;
};

export const DEFAULT_SIGNUP_PRESENTATION: ClinicianSignupPresentation = {
  heroHeading: 'Join the Contactless Care Network',
  heroIntroduction:
    'Complete your application and required training. Once verified, trained and approved, your profile can go live and you can start consulting on Ambulant+. No upfront onboarding payment is required.',
  noticeHeading: 'Start now - no mandatory upfront payment',
  noticeBody:
    'Training is required, but payment is not. Complete your Ambulant+ training and, once your credentials are verified and your profile is approved, you can start consulting and earning on Ambulant+ without purchasing a C-Med Kit.',
  noticeSecondary:
    'The Contactless Medicine Kit (C-Med Kit) is optional. If you choose one, clinicians receive discounted pricing with flexible payment options and tracked delivery.',
  noticeCtaLabel: 'View C-Med Kit & payment options',
  noticeCtaHref: '/clinicians/c-med-options',
  optionalKitTitle: 'Optional C-Med Kit',
  optionalKitDescription:
    "Add a discounted C-Med Kit if you want one, with flexible payment options and tracked delivery. Qualifying C-Med options also include access to Ambulant+'s platform-wide Professional Indemnity / Medical Malpractice cover, subject to eligibility and policy terms.",
  successHeading: 'Application submitted successfully',
  successBody:
    'Your Ambulant+ clinician account has been created. Sign in to choose an available Ambulant+ training programme and complete your onboarding.',
  successSecondary:
    'No upfront onboarding payment is required to continue. You can choose a discounted C-Med Kit with flexible payment options during the next step.',
  successCtaLabel: 'Sign in & continue to training',
};

export const DEFAULT_CLINICIAN_ONBOARDING_PATHWAYS:
  ClinicianOnboardingCommercialPathway[] = [
    {
      key: 'START_NOW_PAY_LATER',
      displayOrder: 1,
      label: 'Continue to Training',
      badge: 'Direct pathway',
      description:
        'Continue with your required training without purchasing a C-Med Kit. Once your credentials are verified, training is completed and your profile is approved, you can start consulting and earning on Ambulant+.',
      ctaLabel: 'Continue to Training',
      enabled: true,
      featured: true,
      conditions: [
        'R0 upfront — no mandatory onboarding payment is required.',
        'The C-Med Kit is optional and is not required to complete training.',
        'Credential verification, training completion and profile approval remain required before practice activation.',
      ],
      privileges: {
        trainingAccess: true,
        practiceActivation: true,
        starterKitRelease: 'none',
        platformIndemnityEligible: false,
        balanceRecoveryApplies: false,
      },
      standardPriceCents: 0,
      promotionalPriceCents: null,
      promotionStartsAt: null,
      promotionEndsAt: null,
      amountDueTodayCents: 0,
      promotionLabel: null,
    },
    {
      key: 'QUALIFYING_DEPOSIT',
      displayOrder: 2,
      label: 'C-Med Flex',
      badge: 'Flexible payment',
      description:
        'Get your discounted C-Med package with a qualifying initial payment and flexible settlement.',
      ctaLabel: 'Choose C-Med Flex',
      enabled: true,
      featured: false,
      conditions: [
        'A qualifying initial payment is due when you choose this optional C-Med pathway.',
        'The configured C-Med Flex package benefits and fulfilment rules apply.',
        'Professional Indemnity / Medical Malpractice cover remains subject to eligibility and policy terms.',
        'Any remaining C-Med package balance is settled under the configured arrangement.',
      ],
      privileges: {
        trainingAccess: true,
        practiceActivation: true,
        starterKitRelease: 'deposit',
        platformIndemnityEligible: true,
        balanceRecoveryApplies: true,
      },
      standardPriceCents: null,
      promotionalPriceCents: null,
      promotionStartsAt: null,
      promotionEndsAt: null,
      amountDueTodayCents: null,
      promotionLabel: null,
    },
    {
      key: 'FULL_PAYMENT',
      displayOrder: 3,
      label: 'C-Med Full',
      badge: 'Best value',
      description:
        'Pay in full and receive the highest available C-Med package discount and priority fulfilment.',
      ctaLabel: 'Choose C-Med Full',
      enabled: true,
      featured: false,
      conditions: [
        'The current Admin-configured C-Med Full price is payable.',
        'The complete configured C-Med Kit can be released after qualifying payment confirmation.',
        'Professional Indemnity / Medical Malpractice cover remains subject to eligibility and policy terms.',
        'No C-Med package balance remains after confirmed full payment.',
      ],
      privileges: {
        trainingAccess: true,
        practiceActivation: true,
        starterKitRelease: 'full',
        platformIndemnityEligible: true,
        balanceRecoveryApplies: false,
      },
      standardPriceCents: null,
      promotionalPriceCents: null,
      promotionStartsAt: null,
      promotionEndsAt: null,
      amountDueTodayCents: null,
      promotionLabel: null,
    },
  ];

export const DEFAULT_TRAINING_POLICY:
  ClinicianTrainingPolicy = {
    heading: 'Mandatory clinician onboarding training',
    introduction:
      'Choose an available programme, select an eligible training mode, then choose how you would like to continue. No upfront payment is required for the direct training pathway.',
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
    signupPresentation: {
      ...DEFAULT_SIGNUP_PRESENTATION,
    },
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

function optionalCents(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.round(number));
}

function normaliseDateTime(value: unknown): string | null {
  const text = cleanStr(value, 100);
  if (!text) return null;
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function safeInternalHref(value: unknown, fallback: string) {
  const href = cleanStr(value, 240) || fallback;
  return href.startsWith('/') && !href.startsWith('//') ? href : fallback;
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

      const legacyPresentation = (() => {
        const label = String(raw.label || '').trim().toLowerCase();
        const cta = String(raw.ctaLabel || '').trim().toLowerCase();
        const description = String(raw.description || '').trim().toLowerCase();

        if (fallback.key === 'START_NOW_PAY_LATER') {
          return (
            label === 'start now — pay later' ||
            label === 'start now - pay later' ||
            cta === 'request pay later approval' ||
            description.includes('admin approves your pay later request')
          );
        }

        if (fallback.key === 'QUALIFYING_DEPOSIT') {
          return (
            label === 'start with initial deposit' ||
            cta === 'pay initial deposit' ||
            description.includes('qualifying deposit')
          );
        }

        return (
          label === 'pay in full' ||
          cta === 'pay full onboarding fee' ||
          description.includes('complete onboarding fee')
        );
      })();

      const presentation = legacyPresentation
        ? {} as Record<string, any>
        : raw;

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
            presentation,
            'badge',
          )
            ? cleanStr(presentation.badge, 80)
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
          presentation.conditions,
          fallback.conditions,
        ),
        privileges: normalisePrivileges(
          raw.privileges,
          fallback.privileges,
        ),
        standardPriceCents:
          optionalCents(raw.standardPriceCents),
        promotionalPriceCents:
          optionalCents(raw.promotionalPriceCents),
        promotionStartsAt:
          normaliseDateTime(raw.promotionStartsAt),
        promotionEndsAt:
          normaliseDateTime(raw.promotionEndsAt),
        amountDueTodayCents:
          optionalCents(raw.amountDueTodayCents),
        promotionLabel:
          cleanStr(raw.promotionLabel, 120),
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

export function normaliseClinicianSignupPresentation(
  value: unknown,
): ClinicianSignupPresentation {
  const raw =
    value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, any>
      : {};

  return {
    heroHeading:
      cleanStr(raw.heroHeading, 180) || DEFAULT_SIGNUP_PRESENTATION.heroHeading,
    heroIntroduction:
      cleanStr(raw.heroIntroduction, 1600) || DEFAULT_SIGNUP_PRESENTATION.heroIntroduction,
    noticeHeading:
      cleanStr(raw.noticeHeading, 180) || DEFAULT_SIGNUP_PRESENTATION.noticeHeading,
    noticeBody:
      cleanStr(raw.noticeBody, 1800) || DEFAULT_SIGNUP_PRESENTATION.noticeBody,
    noticeSecondary:
      cleanStr(raw.noticeSecondary, 1800) || DEFAULT_SIGNUP_PRESENTATION.noticeSecondary,
    noticeCtaLabel:
      cleanStr(raw.noticeCtaLabel, 140) || DEFAULT_SIGNUP_PRESENTATION.noticeCtaLabel,
    noticeCtaHref:
      safeInternalHref(raw.noticeCtaHref, DEFAULT_SIGNUP_PRESENTATION.noticeCtaHref),
    optionalKitTitle:
      cleanStr(raw.optionalKitTitle, 180) || DEFAULT_SIGNUP_PRESENTATION.optionalKitTitle,
    optionalKitDescription:
      cleanStr(raw.optionalKitDescription, 1800) || DEFAULT_SIGNUP_PRESENTATION.optionalKitDescription,
    successHeading:
      cleanStr(raw.successHeading, 180) || DEFAULT_SIGNUP_PRESENTATION.successHeading,
    successBody:
      cleanStr(raw.successBody, 1800) || DEFAULT_SIGNUP_PRESENTATION.successBody,
    successSecondary:
      cleanStr(raw.successSecondary, 1800) || DEFAULT_SIGNUP_PRESENTATION.successSecondary,
    successCtaLabel:
      cleanStr(raw.successCtaLabel, 140) || DEFAULT_SIGNUP_PRESENTATION.successCtaLabel,
  };
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
    signupPresentation:
      normaliseClinicianSignupPresentation(
        raw.signupPresentation,
      ),
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

  const minimumInitialPaymentCents =
    effectiveMinimumInitialPayment({
      trainingFeeCents,
      minimumInitialPaymentCents:
        cents(row?.minimumInitialPaymentCents),
      allowPartialPayment,
    });

  const commercialPathways =
    normaliseClinicianOnboardingCommercialPathways(
      row?.commercialPathways,
    ).map((pathway) => {
      if (pathway.key === 'START_NOW_PAY_LATER') {
        return {
          ...pathway,
          standardPriceCents: 0,
          promotionalPriceCents: null,
          promotionStartsAt: null,
          promotionEndsAt: null,
          amountDueTodayCents: 0,
          privileges: {
            ...pathway.privileges,
            trainingAccess: true,
            practiceActivation: true,
            starterKitRelease: 'none' as const,
            platformIndemnityEligible: false,
            balanceRecoveryApplies: false,
          },
        };
      }

      if (pathway.key === 'QUALIFYING_DEPOSIT') {
        return {
          ...pathway,
          standardPriceCents:
            pathway.standardPriceCents ?? trainingFeeCents,
          amountDueTodayCents:
            pathway.amountDueTodayCents ??
            minimumInitialPaymentCents ??
            trainingFeeCents,
        };
      }

      return {
        ...pathway,
        standardPriceCents:
          pathway.standardPriceCents ?? trainingFeeCents,
        amountDueTodayCents: null,
      };
    });

  return {
    id: String(row?.id || 'default'),
    trainingFeeCents,
    minimumInitialPaymentCents,
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
    commercialPathways,
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

export function effectiveClinicianPathwayPricing(
  pathway: ClinicianOnboardingCommercialPathway,
  now: Date = new Date(),
) {
  const standardPriceCents =
    pathway.key === 'START_NOW_PAY_LATER'
      ? 0
      : cents(pathway.standardPriceCents);
  const promotionalPriceCents =
    pathway.promotionalPriceCents == null
      ? null
      : cents(pathway.promotionalPriceCents);
  const startsAt = pathway.promotionStartsAt
    ? Date.parse(pathway.promotionStartsAt)
    : Number.NEGATIVE_INFINITY;
  const endsAt = pathway.promotionEndsAt
    ? Date.parse(pathway.promotionEndsAt)
    : Number.POSITIVE_INFINITY;
  const nowMs = now.getTime();
  const promotionActive =
    pathway.key !== 'START_NOW_PAY_LATER' &&
    promotionalPriceCents != null &&
    promotionalPriceCents > 0 &&
    promotionalPriceCents < standardPriceCents &&
    Number.isFinite(nowMs) &&
    nowMs >= startsAt &&
    nowMs <= endsAt;
  const effectivePriceCents =
    promotionActive && promotionalPriceCents != null
      ? promotionalPriceCents
      : standardPriceCents;
  const amountDueTodayCents =
    pathway.key === 'START_NOW_PAY_LATER'
      ? 0
      : pathway.key === 'FULL_PAYMENT'
        ? effectivePriceCents
        : Math.min(
            effectivePriceCents,
            pathway.amountDueTodayCents == null
              ? effectivePriceCents
              : cents(pathway.amountDueTodayCents),
          );

  return {
    standardPriceCents,
    promotionalPriceCents,
    promotionStartsAt: pathway.promotionStartsAt,
    promotionEndsAt: pathway.promotionEndsAt,
    promotionLabel: pathway.promotionLabel,
    promotionActive,
    effectivePriceCents,
    amountDueTodayCents,
    savingsCents: Math.max(0, standardPriceCents - effectivePriceCents),
  };
}

export function publicClinicianOnboardingCommercialOffer(
  settings: ClinicianOnboardingSettings,
  now: Date = new Date(),
) {
  return {
    currency: settings.currency,
    starterKitItems: [...settings.starterKitItems],
    starterKitDepositItems: [...settings.starterKitDepositItems],
    signupPresentation: {
      ...settings.trainingPolicy.signupPresentation,
    },
    commercialPathways: settings.commercialPathways
      .filter((pathway) => pathway.enabled)
      .map((pathway) => ({
        key: pathway.key,
        displayOrder: pathway.displayOrder,
        label: pathway.label,
        badge: pathway.badge,
        description: pathway.description,
        ctaLabel: pathway.ctaLabel,
        featured: pathway.featured,
        conditions: [...pathway.conditions],
        privileges: { ...pathway.privileges },
        pricing: effectiveClinicianPathwayPricing(pathway, now),
      })),
  };
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
      settings.commercialPathways.map((pathway) => ({
        ...pathway,
        pricing:
          effectiveClinicianPathwayPricing(pathway),
      })),
    trainingPolicy:
      settings.trainingPolicy,
    configured:
      settings.commercialPathways.some(
        (pathway) => pathway.enabled,
      ),
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
