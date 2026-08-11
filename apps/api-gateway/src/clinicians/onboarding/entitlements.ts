import {
  calculateOnboardingPaymentState,
  effectiveClinicianPathwayPricing,
  getClinicianOnboardingSettings,
  type ClinicianOnboardingCommercialPathway,
  type ClinicianOnboardingPathwayKey,
  type ClinicianOnboardingPathwayPrivileges,
  type ClinicianOnboardingSettings,
  type StarterKitReleaseLevel,
} from '@/src/clinicians/onboarding/settings';

type DbLike = any;

export const CONFIRMED_ONBOARDING_PAYMENT_STATUSES = [
  'captured',
  'confirmed',
  'redeemed',
  'paid',
];

export type ClinicianOnboardingEntitlementEvidence = {
  payments?: any[];
  latestApprovedPayLater?: any | null;
};

const NO_PRIVILEGES: ClinicianOnboardingPathwayPrivileges = {
  trainingAccess: false,
  practiceActivation: false,
  starterKitRelease: 'none',
  platformIndemnityEligible: false,
  balanceRecoveryApplies: false,
};

function cents(value: unknown) {
  const amount = Number(value);

  return Number.isFinite(amount)
    ? Math.max(0, Math.round(amount))
    : 0;
}

function upper(value: unknown) {
  return String(value || '')
    .trim()
    .toUpperCase();
}

function itemIdentity(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function isDeferredProvider(value: unknown) {
  const provider =
    String(value || '')
      .trim()
      .toLowerCase();

  return (
    provider === 'waiver' ||
    provider === 'deferred'
  );
}

function isPayLaterPlan(value: unknown) {
  return [
    'START_NOW_PAY_LATER',
    'WAIVER_TRAIN_NOW_PAY_LATER',
  ].includes(upper(value));
}

function pathwayByKey(
  settings: ClinicianOnboardingSettings,
  key: ClinicianOnboardingPathwayKey,
): ClinicianOnboardingCommercialPathway | null {
  return (
    settings.commercialPathways.find(
      (pathway) =>
        pathway.key === key &&
        pathway.enabled === true,
    ) || null
  );
}

function uniqueLabels(values: unknown) {
  const rows =
    Array.isArray(values)
      ? values
      : [];

  const seen =
    new Set<string>();

  const output: string[] = [];

  for (const value of rows) {
    const label =
      String(value || '').trim();

    const identity =
      itemIdentity(label);

    if (
      !label ||
      !identity ||
      seen.has(identity)
    ) {
      continue;
    }

    seen.add(identity);
    output.push(label);
  }

  return output;
}

function isPermanentDispatch(
  dispatch: any,
) {
  const status =
    String(dispatch?.status || '')
      .trim()
      .toLowerCase();

  if (
    status === 'canceled' ||
    status === 'cancelled'
  ) {
    return false;
  }

  const notes =
    String(dispatch?.notes || '')
      .trim()
      .toLowerCase();

  return !(
    notes.includes('temporary training') ||
    notes.includes('training loan') ||
    notes.includes('loaner training')
  );
}

export function resolvePermanentStarterKitFulfilment(
  entitlements: {
    starterKitItems?: unknown;
  },
  dispatchesInput: unknown,
) {
  const authorisedItems =
    uniqueLabels(
      entitlements?.starterKitItems,
    );

  const dispatches =
    Array.isArray(dispatchesInput)
      ? dispatchesInput.filter(
          isPermanentDispatch,
        )
      : [];

  const releasedIdentities =
    new Set<string>();

  for (const dispatch of dispatches) {
    const items =
      Array.isArray(dispatch?.items)
        ? dispatch.items
        : [];

    for (const item of items) {
      const identity =
        itemIdentity(item?.label);

      if (identity) {
        releasedIdentities.add(
          identity,
        );
      }
    }
  }

  const releasedItems =
    authorisedItems.filter(
      (label) =>
        releasedIdentities.has(
          itemIdentity(label),
        ),
    );

  const missingItems =
    authorisedItems.filter(
      (label) =>
        !releasedIdentities.has(
          itemIdentity(label),
        ),
    );

  return {
    authorisedItems,
    releasedItems,
    missingItems,
    releaseSatisfied:
      authorisedItems.length > 0 &&
      missingItems.length === 0,
    permanentDispatchCount:
      dispatches.length,
  };
}

function jsonObject(value: unknown): Record<string, any> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, any>
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

function pricingSnapshot(payment: any) {
  const meta = jsonObject(payment?.meta);
  const snapshot = jsonObject(meta?.pricingSnapshot);
  if (!snapshot) return null;

  const pathwayKey = upper(snapshot.pathwayKey);
  if (!['QUALIFYING_DEPOSIT', 'FULL_PAYMENT'].includes(pathwayKey)) return null;

  return {
    pathwayKey: pathwayKey as ClinicianOnboardingPathwayKey,
    standardPriceCents: cents(snapshot.standardPriceCents),
    currentPriceCents: cents(
      snapshot.currentPriceCents ??
      snapshot.effectivePriceCents ??
      snapshot.standardPriceCents,
    ),
    amountDueTodayCents: cents(
      snapshot.amountDueTodayCents ??
      snapshot.currentPriceCents ??
      snapshot.effectivePriceCents,
    ),
    capturedAt: String(snapshot.capturedAt || payment?.confirmedAt || ''),
  };
}

function latestPricingSnapshot(
  payments: any[],
  key: ClinicianOnboardingPathwayKey,
) {
  return payments
    .map((payment) => ({
      payment,
      snapshot: pricingSnapshot(payment),
      timestamp: Date.parse(
        String(payment?.confirmedAt || payment?.createdAt || ''),
      ),
    }))
    .filter((row) => row.snapshot?.pathwayKey === key)
    .sort((left, right) =>
      (Number.isFinite(right.timestamp) ? right.timestamp : 0) -
      (Number.isFinite(left.timestamp) ? left.timestamp : 0),
    )[0]?.snapshot || null;
}

export function resolveClinicianOnboardingEntitlementsFromEvidence(
  input: {
    settings: ClinicianOnboardingSettings;
    onboarding?: any | null;
    payments?: any[];
    latestApprovedPayLater?: any | null;
  },
) {
  const settings = input.settings;
  const onboarding = input.onboarding || null;
  const payments = Array.isArray(input.payments) ? input.payments : [];
  const latestApprovedPayLater = input.latestApprovedPayLater || null;

  const amountPaidCents = payments.reduce(
    (total: number, payment: any) =>
      isDeferredProvider(payment?.provider)
        ? total
        : total + cents(payment?.amountCents),
    0,
  );

  const legacyPaymentState = calculateOnboardingPaymentState({
    trainingFeeCents: settings.trainingFeeCents,
    minimumInitialPaymentCents: settings.minimumInitialPaymentCents,
    amountPaidCents,
  });

  const approvedPayLater =
    Boolean(latestApprovedPayLater) ||
    isPayLaterPlan(onboarding?.paymentPlan) ||
    payments.some((payment: any) => isDeferredProvider(payment?.provider));

  const directPathway = pathwayByKey(settings, 'START_NOW_PAY_LATER');
  const flexPathway = pathwayByKey(settings, 'QUALIFYING_DEPOSIT');
  const fullPathway = pathwayByKey(settings, 'FULL_PAYMENT');

  const flexSnapshot = latestPricingSnapshot(payments, 'QUALIFYING_DEPOSIT');
  const fullSnapshot = latestPricingSnapshot(payments, 'FULL_PAYMENT');
  const anyModernSnapshot = Boolean(flexSnapshot || fullSnapshot);

  const flexPricing = flexPathway
    ? effectiveClinicianPathwayPricing(flexPathway)
    : null;
  const fullPricing = fullPathway
    ? effectiveClinicianPathwayPricing(fullPathway)
    : null;

  const flexTotalCents = flexSnapshot?.currentPriceCents || flexPricing?.effectivePriceCents || 0;
  const flexInitialCents = flexSnapshot?.amountDueTodayCents || flexPricing?.amountDueTodayCents || 0;
  const fullTotalCents = fullSnapshot?.currentPriceCents || fullPricing?.effectivePriceCents || 0;

  const fullQualified = Boolean(
    fullPathway &&
    fullTotalCents > 0 &&
    amountPaidCents >= fullTotalCents &&
    (Boolean(fullSnapshot) || !anyModernSnapshot),
  );

  const flexQualified = Boolean(
    flexPathway &&
    flexInitialCents > 0 &&
    amountPaidCents >= flexInitialCents &&
    (Boolean(flexSnapshot) || (!anyModernSnapshot && legacyPaymentState.initialRequirementMet)),
  );

  let pathway: ClinicianOnboardingCommercialPathway | null = null;

  if (fullQualified) pathway = fullPathway;
  if (!pathway && flexQualified) pathway = flexPathway;
  if (!pathway && directPathway) pathway = directPathway;

  const privileges: ClinicianOnboardingPathwayPrivileges = pathway
    ? { ...pathway.privileges }
    : { ...NO_PRIVILEGES };

  let paymentState = legacyPaymentState;

  if (pathway?.key === 'FULL_PAYMENT') {
    paymentState = calculateOnboardingPaymentState({
      trainingFeeCents: fullTotalCents,
      minimumInitialPaymentCents: fullTotalCents,
      amountPaidCents,
    });
  } else if (pathway?.key === 'QUALIFYING_DEPOSIT') {
    paymentState = calculateOnboardingPaymentState({
      trainingFeeCents: flexTotalCents,
      minimumInitialPaymentCents: flexInitialCents,
      amountPaidCents,
    });
  } else if (pathway?.key === 'START_NOW_PAY_LATER') {
    paymentState = {
      trainingFeeCents: 0,
      minimumInitialPaymentCents: 0,
      amountPaidCents,
      outstandingCents: 0,
      initialRequirementMet: true,
      fullyPaid: true,
      paymentStatus: 'not_required',
    };
  }

  const starterKitRelease: StarterKitReleaseLevel = privileges.starterKitRelease;
  const starterKitItems =
    starterKitRelease === 'full'
      ? [...settings.starterKitItems]
      : starterKitRelease === 'deposit'
        ? [...settings.starterKitDepositItems]
        : [];

  return {
    resolvedAt: new Date().toISOString(),
    pathwayKey: pathway?.key || null,
    pathwayLabel: pathway?.label || null,
    pathwayEnabled: Boolean(pathway),
    approvedPayLater,
    latestApprovedPayLaterRequestId: latestApprovedPayLater?.id || null,
    depositQualified: flexQualified,
    paymentState,
    pricingSnapshot:
      pathway?.key === 'FULL_PAYMENT'
        ? fullSnapshot
        : pathway?.key === 'QUALIFYING_DEPOSIT'
          ? flexSnapshot
          : null,
    privileges,
    trainingAccess: privileges.trainingAccess,
    practiceActivation: privileges.practiceActivation,
    starterKitRelease,
    starterKitItems,
    platformIndemnityEligible: privileges.platformIndemnityEligible,
    balanceRecoveryApplies:
      privileges.balanceRecoveryApplies && paymentState.outstandingCents > 0,
    outstandingCents: paymentState.outstandingCents,
    conditions: pathway ? [...pathway.conditions] : [],
  };
}

export async function resolveClinicianOnboardingEntitlements(
  db: DbLike,
  clinicianId: string,
  onboardingInput?: any | null,
  settingsInput?: ClinicianOnboardingSettings,
  evidenceInput?: ClinicianOnboardingEntitlementEvidence,
) {
  const settings =
    settingsInput ||
    await getClinicianOnboardingSettings(
      db,
    );

  const onboarding =
    onboardingInput === undefined
      ? await db.clinicianOnboarding
          .findUnique({
            where: {
              clinicianId,
            },
          })
      : onboardingInput;

  const hasPaymentEvidence =
    Boolean(evidenceInput) &&
    Object.prototype
      .hasOwnProperty
      .call(
        evidenceInput,
        'payments',
      );

  const payments =
    hasPaymentEvidence
      ? (
          Array.isArray(
            evidenceInput?.payments,
          )
            ? evidenceInput?.payments
            : []
        )
      : await db
          .clinicianOnboardingPayment
          .findMany({
            where: {
              clinicianId,
              status: {
                in:
                  CONFIRMED_ONBOARDING_PAYMENT_STATUSES,
              },
            },
            select: {
              id: true,
              amountCents: true,
              provider: true,
              status: true,
              meta: true,
              confirmedAt: true,
            },
            orderBy: [
              {
                confirmedAt: 'desc',
              },
              {
                createdAt: 'desc',
              },
            ],
          });

  const hasPayLaterEvidence =
    Boolean(evidenceInput) &&
    Object.prototype
      .hasOwnProperty
      .call(
        evidenceInput,
        'latestApprovedPayLater',
      );

  const latestApprovedPayLater =
    hasPayLaterEvidence
      ? (
          evidenceInput
            ?.latestApprovedPayLater ||
          null
        )
      : await db
          .clinicianOnboardingPayLaterRequest
          .findFirst({
            where: {
              clinicianId,
              status: 'approved',
            },
            select: {
              id: true,
              reviewedAt: true,
            },
            orderBy: {
              reviewedAt: 'desc',
            },
          })
          .catch(() => null);

  return resolveClinicianOnboardingEntitlementsFromEvidence(
    {
      settings,
      onboarding,
      payments,
      latestApprovedPayLater,
    },
  );
}
