// apps/api-gateway/src/clinicians/multi-care-policy.ts
import { prisma } from '@/src/lib/prisma';

export const MULTI_CARE_FEE_KINDS = ['STANDARD', 'FOLLOWUP'] as const;
export const MULTI_CARE_VISIT_MODES = ['televisit', 'in_person', 'hybrid'] as const;
export const MULTI_CARE_PRICING_MODES = [
  'FULL_FEE_PER_RECIPIENT',
  'BASE_PLUS_ADDITIONAL',
  'FIXED_PACKAGE',
  'NO_ADDITIONAL_FEE',
] as const;

export type MultiCareFeeKind = (typeof MULTI_CARE_FEE_KINDS)[number];
export type MultiCareVisitMode = (typeof MULTI_CARE_VISIT_MODES)[number];
export type MultiCarePricingMode = (typeof MULTI_CARE_PRICING_MODES)[number];

export type MultiCarePolicyInput = {
  feeKind: MultiCareFeeKind;
  visitMode: MultiCareVisitMode;
  enabled: boolean;
  pricingMode: MultiCarePricingMode;
  includedCareRecipients: number;
  additionalRecipientAmountMinor: number | null;
  additionalRecipientPercentBps: number | null;
  packageAmountMinor: number | null;
  maxCareRecipients: number;
  additionalMinutesPerRecipient: number;
  maxAdditionalMinutes: number | null;
  requireAllRecipientsVerifiedBeforeCheckout: boolean;
  allowPendingAdultInvitations: boolean;
  allowProvisionalDependentProfiles: boolean;
};

export type MultiCarePolicyView = MultiCarePolicyInput & {
  id: string | null;
  clinicianUserId: string;
  currency: string;
  version: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  persisted: boolean;
};

export class MultiCarePolicyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MultiCarePolicyValidationError';
  }
}

export function isMultiCareFoundationUnavailable(error: any) {
  const code = String(error?.code || '');
  const message = String(error?.message || error || '');

  return (
    code === 'P2021' ||
    code === 'P2022' ||
    message.includes('ClinicianMultiCarePolicy') &&
      (
        message.includes('does not exist') ||
        message.includes('Unknown arg') ||
        message.includes('Unknown field')
      )
  );
}

function normalizeCurrency(value: unknown) {
  const currency = String(value || 'ZAR').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : 'ZAR';
}

function requiredEnum<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  field: string,
): T[number] {
  const normalized = String(value || '').trim();

  if (!allowed.includes(normalized as T[number])) {
    throw new MultiCarePolicyValidationError(
      `${field} must be one of: ${allowed.join(', ')}`,
    );
  }

  return normalized as T[number];
}

function requiredBoolean(value: unknown, field: string) {
  if (typeof value !== 'boolean') {
    throw new MultiCarePolicyValidationError(`${field} must be boolean`);
  }

  return value;
}

function requiredInt(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue)) {
    throw new MultiCarePolicyValidationError(`${field} must be an integer`);
  }

  if (numberValue < minimum || numberValue > maximum) {
    throw new MultiCarePolicyValidationError(
      `${field} must be between ${minimum} and ${maximum}`,
    );
  }

  return numberValue;
}

function optionalInt(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
) {
  if (value == null || value === '') return null;
  return requiredInt(value, field, minimum, maximum);
}

function defaultPolicy(
  clinicianUserId: string,
  currency: string,
  feeKind: MultiCareFeeKind,
  visitMode: MultiCareVisitMode,
): MultiCarePolicyView {
  return {
    id: null,
    clinicianUserId,
    feeKind,
    visitMode,
    enabled: false,
    pricingMode: 'BASE_PLUS_ADDITIONAL',
    currency,
    includedCareRecipients: 1,
    additionalRecipientAmountMinor: 0,
    additionalRecipientPercentBps: null,
    packageAmountMinor: null,
    maxCareRecipients: 2,
    additionalMinutesPerRecipient: 0,
    maxAdditionalMinutes: null,
    requireAllRecipientsVerifiedBeforeCheckout: true,
    allowPendingAdultInvitations: false,
    allowProvisionalDependentProfiles: true,
    version: 0,
    effectiveFrom: null,
    effectiveTo: null,
    persisted: false,
  };
}

function serializePolicy(row: any): MultiCarePolicyView {
  return {
    id: String(row.id),
    clinicianUserId: String(row.clinicianUserId),
    feeKind: row.feeKind as MultiCareFeeKind,
    visitMode: row.visitMode as MultiCareVisitMode,
    enabled: Boolean(row.enabled),
    pricingMode: row.pricingMode as MultiCarePricingMode,
    currency: normalizeCurrency(row.currency),
    includedCareRecipients: Number(row.includedCareRecipients),
    additionalRecipientAmountMinor:
      row.additionalRecipientAmountMinor == null
        ? null
        : Number(row.additionalRecipientAmountMinor),
    additionalRecipientPercentBps:
      row.additionalRecipientPercentBps == null
        ? null
        : Number(row.additionalRecipientPercentBps),
    packageAmountMinor:
      row.packageAmountMinor == null
        ? null
        : Number(row.packageAmountMinor),
    maxCareRecipients: Number(row.maxCareRecipients),
    additionalMinutesPerRecipient: Number(row.additionalMinutesPerRecipient),
    maxAdditionalMinutes:
      row.maxAdditionalMinutes == null
        ? null
        : Number(row.maxAdditionalMinutes),
    requireAllRecipientsVerifiedBeforeCheckout: Boolean(
      row.requireAllRecipientsVerifiedBeforeCheckout,
    ),
    allowPendingAdultInvitations: Boolean(row.allowPendingAdultInvitations),
    allowProvisionalDependentProfiles: Boolean(
      row.allowProvisionalDependentProfiles,
    ),
    version: Number(row.version),
    effectiveFrom: row.effectiveFrom
      ? new Date(row.effectiveFrom).toISOString()
      : null,
    effectiveTo: row.effectiveTo
      ? new Date(row.effectiveTo).toISOString()
      : null,
    persisted: true,
  };
}

function normalizePolicyInput(
  raw: any,
  authoritativeCurrency: string,
): MultiCarePolicyInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new MultiCarePolicyValidationError('Each policy must be an object');
  }

  const feeKind = requiredEnum(raw.feeKind, MULTI_CARE_FEE_KINDS, 'feeKind');
  const visitMode = requiredEnum(
    raw.visitMode,
    MULTI_CARE_VISIT_MODES,
    'visitMode',
  );
  const pricingMode = requiredEnum(
    raw.pricingMode,
    MULTI_CARE_PRICING_MODES,
    'pricingMode',
  );
  const enabled = requiredBoolean(raw.enabled, 'enabled');
  const maxCareRecipients = requiredInt(
    raw.maxCareRecipients,
    'maxCareRecipients',
    2,
    20,
  );
  const includedCareRecipients = requiredInt(
    raw.includedCareRecipients,
    'includedCareRecipients',
    1,
    maxCareRecipients,
  );
  const additionalMinutesPerRecipient = requiredInt(
    raw.additionalMinutesPerRecipient,
    'additionalMinutesPerRecipient',
    0,
    240,
  );
  const maxAdditionalMinutes = optionalInt(
    raw.maxAdditionalMinutes,
    'maxAdditionalMinutes',
    0,
    720,
  );

  if (
    maxAdditionalMinutes != null &&
    maxAdditionalMinutes < additionalMinutesPerRecipient
  ) {
    throw new MultiCarePolicyValidationError(
      'maxAdditionalMinutes cannot be less than additionalMinutesPerRecipient',
    );
  }

  let additionalRecipientAmountMinor = optionalInt(
    raw.additionalRecipientAmountMinor,
    'additionalRecipientAmountMinor',
    0,
    100_000_000,
  );
  let additionalRecipientPercentBps = optionalInt(
    raw.additionalRecipientPercentBps,
    'additionalRecipientPercentBps',
    0,
    10_000,
  );
  let packageAmountMinor = optionalInt(
    raw.packageAmountMinor,
    'packageAmountMinor',
    0,
    100_000_000,
  );

  if (pricingMode === 'BASE_PLUS_ADDITIONAL') {
    const usesAmount = additionalRecipientAmountMinor != null;
    const usesPercent = additionalRecipientPercentBps != null;

    if (usesAmount && usesPercent) {
      throw new MultiCarePolicyValidationError(
        'BASE_PLUS_ADDITIONAL must use either a fixed amount or a percentage, not both',
      );
    }

    if (!usesAmount && !usesPercent) {
      additionalRecipientAmountMinor = 0;
    }

    if (
      enabled &&
      Number(additionalRecipientAmountMinor || 0) <= 0 &&
      Number(additionalRecipientPercentBps || 0) <= 0
    ) {
      throw new MultiCarePolicyValidationError(
        'Enabled BASE_PLUS_ADDITIONAL policies require a positive additional fee or percentage',
      );
    }

    packageAmountMinor = null;
  } else if (pricingMode === 'FIXED_PACKAGE') {
    if (enabled && Number(packageAmountMinor || 0) <= 0) {
      throw new MultiCarePolicyValidationError(
        'Enabled FIXED_PACKAGE policies require a positive package amount',
      );
    }

    additionalRecipientAmountMinor = null;
    additionalRecipientPercentBps = null;
  } else {
    additionalRecipientAmountMinor = null;
    additionalRecipientPercentBps = null;
    packageAmountMinor = null;
  }

  normalizeCurrency(authoritativeCurrency);

  return {
    feeKind,
    visitMode,
    enabled,
    pricingMode,
    includedCareRecipients,
    additionalRecipientAmountMinor,
    additionalRecipientPercentBps,
    packageAmountMinor,
    maxCareRecipients,
    additionalMinutesPerRecipient,
    maxAdditionalMinutes,
    requireAllRecipientsVerifiedBeforeCheckout: requiredBoolean(
      raw.requireAllRecipientsVerifiedBeforeCheckout,
      'requireAllRecipientsVerifiedBeforeCheckout',
    ),
    allowPendingAdultInvitations: requiredBoolean(
      raw.allowPendingAdultInvitations,
      'allowPendingAdultInvitations',
    ),
    allowProvisionalDependentProfiles: requiredBoolean(
      raw.allowProvisionalDependentProfiles,
      'allowProvisionalDependentProfiles',
    ),
  };
}

function policyKey(policy: {
  feeKind: MultiCareFeeKind;
  visitMode: MultiCareVisitMode;
}) {
  return `${policy.feeKind}:${policy.visitMode}`;
}

function isDormantDefaultPolicy(next: MultiCarePolicyInput) {
  return (
    next.enabled === false &&
    next.pricingMode === 'BASE_PLUS_ADDITIONAL' &&
    next.includedCareRecipients === 1 &&
    Number(next.additionalRecipientAmountMinor || 0) === 0 &&
    next.additionalRecipientPercentBps == null &&
    next.packageAmountMinor == null &&
    next.maxCareRecipients === 2 &&
    next.additionalMinutesPerRecipient === 0 &&
    next.maxAdditionalMinutes == null &&
    next.requireAllRecipientsVerifiedBeforeCheckout === true &&
    next.allowPendingAdultInvitations === false &&
    next.allowProvisionalDependentProfiles === true
  );
}

function policiesEqual(current: any, next: MultiCarePolicyInput, currency: string) {
  return (
    current &&
    current.effectiveTo == null &&
    Boolean(current.enabled) === next.enabled &&
    String(current.pricingMode) === next.pricingMode &&
    normalizeCurrency(current.currency) === currency &&
    Number(current.includedCareRecipients) === next.includedCareRecipients &&
    (current.additionalRecipientAmountMinor == null
      ? null
      : Number(current.additionalRecipientAmountMinor)) ===
      next.additionalRecipientAmountMinor &&
    (current.additionalRecipientPercentBps == null
      ? null
      : Number(current.additionalRecipientPercentBps)) ===
      next.additionalRecipientPercentBps &&
    (current.packageAmountMinor == null
      ? null
      : Number(current.packageAmountMinor)) === next.packageAmountMinor &&
    Number(current.maxCareRecipients) === next.maxCareRecipients &&
    Number(current.additionalMinutesPerRecipient) ===
      next.additionalMinutesPerRecipient &&
    (current.maxAdditionalMinutes == null
      ? null
      : Number(current.maxAdditionalMinutes)) === next.maxAdditionalMinutes &&
    Boolean(current.requireAllRecipientsVerifiedBeforeCheckout) ===
      next.requireAllRecipientsVerifiedBeforeCheckout &&
    Boolean(current.allowPendingAdultInvitations) ===
      next.allowPendingAdultInvitations &&
    Boolean(current.allowProvisionalDependentProfiles) ===
      next.allowProvisionalDependentProfiles
  );
}

export async function loadClinicianMultiCarePolicies(args: {
  clinicianUserId: string;
  currency: string;
}) {
  const clinicianUserId = String(args.clinicianUserId || '').trim();

  if (!clinicianUserId) {
    throw new MultiCarePolicyValidationError('clinicianUserId is required');
  }

  const currency = normalizeCurrency(args.currency);
  const rows = await (prisma as any).clinicianMultiCarePolicy.findMany({
    where: { clinicianUserId },
    orderBy: [
      { feeKind: 'asc' },
      { visitMode: 'asc' },
      { version: 'desc' },
    ],
  });

  const latestByKey = new Map<string, any>();

  for (const row of rows) {
    const key = policyKey(row);
    if (!latestByKey.has(key)) latestByKey.set(key, row);
  }

  const policies: MultiCarePolicyView[] = [];

  for (const visitMode of MULTI_CARE_VISIT_MODES) {
    for (const feeKind of MULTI_CARE_FEE_KINDS) {
      const row = latestByKey.get(policyKey({ feeKind, visitMode }));
      policies.push(
        row
          ? serializePolicy(row)
          : defaultPolicy(clinicianUserId, currency, feeKind, visitMode),
      );
    }
  }

  return {
    currency,
    feeKinds: [...MULTI_CARE_FEE_KINDS],
    visitModes: [...MULTI_CARE_VISIT_MODES],
    pricingModes: [...MULTI_CARE_PRICING_MODES],
    policies,
  };
}

export async function saveClinicianMultiCarePolicies(args: {
  clinicianUserId: string;
  currency: string;
  orgId?: string | null;
  policies: unknown;
}) {
  const clinicianUserId = String(args.clinicianUserId || '').trim();

  if (!clinicianUserId) {
    throw new MultiCarePolicyValidationError('clinicianUserId is required');
  }

  if (!Array.isArray(args.policies) || args.policies.length === 0) {
    throw new MultiCarePolicyValidationError(
      'policies must be a non-empty array',
    );
  }

  if (args.policies.length > 6) {
    throw new MultiCarePolicyValidationError(
      'No more than six multi-care policies can be saved at once',
    );
  }

  const currency = normalizeCurrency(args.currency);
  const orgId = String(args.orgId || 'org-default').trim() || 'org-default';
  const normalized = args.policies.map((policy) =>
    normalizePolicyInput(policy, currency),
  );
  const keys = normalized.map(policyKey);

  if (new Set(keys).size !== keys.length) {
    throw new MultiCarePolicyValidationError(
      'Duplicate feeKind and visitMode policy combinations are not allowed',
    );
  }

  await (prisma as any).$transaction(async (tx: any) => {
    const currentRows = await tx.clinicianMultiCarePolicy.findMany({
      where: {
        clinicianUserId,
        OR: normalized.map((policy) => ({
          feeKind: policy.feeKind,
          visitMode: policy.visitMode,
        })),
      },
      orderBy: [{ version: 'desc' }],
    });

    for (const next of normalized) {
      const current = currentRows.find(
        (row: any) => policyKey(row) === policyKey(next),
      );

      if (policiesEqual(current, next, currency)) {
        continue;
      }

      if (!current && isDormantDefaultPolicy(next)) {
        continue;
      }

      const now = new Date();

      await tx.clinicianMultiCarePolicy.updateMany({
        where: {
          clinicianUserId,
          feeKind: next.feeKind,
          visitMode: next.visitMode,
          effectiveTo: null,
        },
        data: { effectiveTo: now },
      });

      await tx.clinicianMultiCarePolicy.create({
        data: {
          clinicianUserId,
          feeKind: next.feeKind,
          visitMode: next.visitMode,
          enabled: next.enabled,
          pricingMode: next.pricingMode,
          currency,
          includedCareRecipients: next.includedCareRecipients,
          additionalRecipientAmountMinor:
            next.additionalRecipientAmountMinor,
          additionalRecipientPercentBps:
            next.additionalRecipientPercentBps,
          packageAmountMinor: next.packageAmountMinor,
          maxCareRecipients: next.maxCareRecipients,
          additionalMinutesPerRecipient:
            next.additionalMinutesPerRecipient,
          maxAdditionalMinutes: next.maxAdditionalMinutes,
          requireAllRecipientsVerifiedBeforeCheckout:
            next.requireAllRecipientsVerifiedBeforeCheckout,
          allowPendingAdultInvitations:
            next.allowPendingAdultInvitations,
          allowProvisionalDependentProfiles:
            next.allowProvisionalDependentProfiles,
          effectiveFrom: now,
          effectiveTo: null,
          version: Number(current?.version || 0) + 1,
          metadata: {
            source: 'clinician_fees_settings',
            authority: 'clinician',
          },
          orgId,
        },
      });
    }
  });

  return loadClinicianMultiCarePolicies({
    clinicianUserId,
    currency,
  });
}
