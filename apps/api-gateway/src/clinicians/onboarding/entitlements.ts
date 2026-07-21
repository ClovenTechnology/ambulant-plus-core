import {
  calculateOnboardingPaymentState,
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

export function resolveClinicianOnboardingEntitlementsFromEvidence(
  input: {
    settings: ClinicianOnboardingSettings;
    onboarding?: any | null;
    payments?: any[];
    latestApprovedPayLater?: any | null;
  },
) {
  const settings =
    input.settings;

  const onboarding =
    input.onboarding || null;

  const payments =
    Array.isArray(input.payments)
      ? input.payments
      : [];

  const latestApprovedPayLater =
    input.latestApprovedPayLater || null;

  const amountPaidCents =
    payments.reduce(
      (total: number, payment: any) =>
        isDeferredProvider(
          payment?.provider,
        )
          ? total
          : total +
            cents(payment?.amountCents),
      0,
    );

  const paymentState =
    calculateOnboardingPaymentState({
      trainingFeeCents:
        settings.trainingFeeCents,
      minimumInitialPaymentCents:
        settings.minimumInitialPaymentCents,
      amountPaidCents,
    });

  const approvedPayLater =
    Boolean(latestApprovedPayLater) ||
    isPayLaterPlan(
      onboarding?.paymentPlan,
    ) ||
    payments.some(
      (payment: any) =>
        isDeferredProvider(
          payment?.provider,
        ),
    );

  const depositQualified =
    paymentState.amountPaidCents > 0 &&
    paymentState.initialRequirementMet;

  let pathway:
    ClinicianOnboardingCommercialPathway | null =
      null;

  if (paymentState.fullyPaid) {
    pathway =
      pathwayByKey(
        settings,
        'FULL_PAYMENT',
      );
  }

  if (!pathway && depositQualified) {
    pathway =
      pathwayByKey(
        settings,
        'QUALIFYING_DEPOSIT',
      );
  }

  if (!pathway && approvedPayLater) {
    pathway =
      pathwayByKey(
        settings,
        'START_NOW_PAY_LATER',
      );
  }

  const privileges:
    ClinicianOnboardingPathwayPrivileges =
      pathway
        ? { ...pathway.privileges }
        : { ...NO_PRIVILEGES };

  const starterKitRelease:
    StarterKitReleaseLevel =
      privileges.starterKitRelease;

  const starterKitItems =
    starterKitRelease === 'full'
      ? [...settings.starterKitItems]
      : starterKitRelease === 'deposit'
        ? [
            ...settings
              .starterKitDepositItems,
          ]
        : [];

  return {
    resolvedAt:
      new Date().toISOString(),
    pathwayKey:
      pathway?.key || null,
    pathwayLabel:
      pathway?.label || null,
    pathwayEnabled:
      Boolean(pathway),
    approvedPayLater,
    latestApprovedPayLaterRequestId:
      latestApprovedPayLater?.id ||
      null,
    depositQualified,
    paymentState,
    privileges,
    trainingAccess:
      privileges.trainingAccess,
    practiceActivation:
      privileges.practiceActivation,
    starterKitRelease,
    starterKitItems,
    platformIndemnityEligible:
      privileges
        .platformIndemnityEligible,
    balanceRecoveryApplies:
      privileges.balanceRecoveryApplies &&
      paymentState.outstandingCents > 0,
    outstandingCents:
      paymentState.outstandingCents,
    conditions:
      pathway
        ? [...pathway.conditions]
        : [],
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
