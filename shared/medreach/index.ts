// shared/medreach/index.ts

export const MEDREACH_ELIGIBILITY_STATUSES = {
  ELIGIBLE: 'ELIGIBLE',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  EXPIRED: 'EXPIRED',
  REMOVED: 'REMOVED',
} as const;

// Backwards-compatible alias used by older API Gateway helper code.
export const MEDREACH_ELIGIBLE_LAB_STATUSES = MEDREACH_ELIGIBILITY_STATUSES;

export const MEDREACH_ORDER_STATUSES = {
  MARKETPLACE_OPEN: 'MARKETPLACE_OPEN',
  MARKETPLACE_EXHAUSTED: 'MARKETPLACE_EXHAUSTED',
  ASSIGNED: 'ASSIGNED',
  RECEIVED_AT_LAB: 'RECEIVED_AT_LAB',
  RESULT_READY: 'RESULT_READY',
  RESULT_SENT: 'RESULT_SENT',
  CANCELLED: 'CANCELLED',
} as const;

export const MEDREACH_DRAW_STATUSES = {
  REQUESTED: 'REQUESTED',
  MARKETPLACE_OPEN: 'MARKETPLACE_OPEN',
  MARKETPLACE_EXHAUSTED: 'MARKETPLACE_EXHAUSTED',
  ASSIGNED: 'ASSIGNED',
  EN_ROUTE: 'EN_ROUTE',
  ARRIVED: 'ARRIVED',
  SPECIMEN_COLLECTED: 'SPECIMEN_COLLECTED',
  IN_TRANSIT_TO_LAB: 'IN_TRANSIT_TO_LAB',
  RECEIVED_AT_LAB: 'RECEIVED_AT_LAB',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export const MEDREACH_RESULT_STATUSES = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  READY: 'READY',
  SENT: 'SENT',
} as const;

export const MEDREACH_RELEASE_POLICIES = {
  CLINICIAN_FIRST: 'CLINICIAN_FIRST',
  SIMULTANEOUS: 'SIMULTANEOUS',
  PATIENT_IMMEDIATE: 'PATIENT_IMMEDIATE',
} as const;

export const MEDREACH_PAYER_TYPES = {
  CASH: 'CASH',
  MEDICAL_AID: 'MEDICAL_AID',
  CLIENT_SPONSOR: 'CLIENT_SPONSOR',
  SPLIT_SPONSOR_PATIENT: 'SPLIT_SPONSOR_PATIENT',
  VOUCHER: 'VOUCHER',
  PROMO: 'PROMO',
  HYBRID: 'HYBRID',
} as const;

export type MedReachEligibilityStatus =
  (typeof MEDREACH_ELIGIBILITY_STATUSES)[keyof typeof MEDREACH_ELIGIBILITY_STATUSES];

export type MedReachOrderStatus =
  (typeof MEDREACH_ORDER_STATUSES)[keyof typeof MEDREACH_ORDER_STATUSES];

export type MedReachDrawStatus =
  (typeof MEDREACH_DRAW_STATUSES)[keyof typeof MEDREACH_DRAW_STATUSES];

export type MedReachResultStatus =
  (typeof MEDREACH_RESULT_STATUSES)[keyof typeof MEDREACH_RESULT_STATUSES];

export type MedReachReleasePolicy =
  (typeof MEDREACH_RELEASE_POLICIES)[keyof typeof MEDREACH_RELEASE_POLICIES];

export type MedReachPayerType =
  (typeof MEDREACH_PAYER_TYPES)[keyof typeof MEDREACH_PAYER_TYPES];

export type MedReachNormalizedOrderPayload = {
  orderId?: string | null;
  encounterId?: string | null;
  patientId?: string | null;
  clinicianId?: string | null;
  sessionId?: string | null;
  caseId?: string | null;

  initiatedByRole?: string | null;
  initiatedByUserId?: string | null;
  createdFromApp?: string | null;

  releasePolicy?: MedReachReleasePolicy | string | null;
  payerType?: MedReachPayerType | string | null;
  urgency?: string | null;
  prepNotes?: string | null;
  fulfillmentMode?: string | null;

  clientId?: string | null;
  clientMemberId?: string | null;
  coveragePlanId?: string | null;
  coverageAuthorizationId?: string | null;

  sponsorAmountMinor?: number | null;
  patientCopayMinor?: number | null;

  candidateLabIds: string[];
  tests: unknown[];
  panels: unknown[];

  patientName?: string | null;
  patientDob?: string | Date | null;
  patientGender?: string | null;
  patientIdentifier?: string | null;
  patientPhone?: string | null;
  patientAddress?: string | null;
  patientArea?: string | null;
  destinationLat?: number | null;
  destinationLng?: number | null;

  preferredPaymentMethod?: string | null;
  gapPaymentMethod?: string | null;
  sponsorRequested?: boolean;

  medicalAidPolicyId?: string | null;
  medicalAidSchemeName?: string | null;
  medicalAidPlanName?: string | null;
  membershipNumber?: string | null;
  dependentCode?: string | null;
  authorizationLetterFileKey?: string | null;
  voucherId?: string | null;
  promoTokenId?: string | null;
  cashFallbackAllowed?: boolean;

  billingConsentCaptured?: boolean;
  patientConsentToShareWithLab?: boolean;
  patientConsentToShareWithMedicalAid?: boolean;
  patientConsentVersion?: string | null;

  collectionWindow?: unknown;
  sponsorPricingSnapshot?: unknown;
};

export type NormalizedMedReachPayload = MedReachNormalizedOrderPayload;

const DRAW_STATUS_VALUES = new Set<string>(Object.values(MEDREACH_DRAW_STATUSES));
const RESULT_STATUS_VALUES = new Set<string>(Object.values(MEDREACH_RESULT_STATUSES));
const RELEASE_POLICY_VALUES = new Set<string>(Object.values(MEDREACH_RELEASE_POLICIES));
const PAYER_TYPE_VALUES = new Set<string>(Object.values(MEDREACH_PAYER_TYPES));

export function isValidDrawStatus(value: unknown): value is MedReachDrawStatus {
  return typeof value === 'string' && DRAW_STATUS_VALUES.has(value);
}

export function isValidResultStatus(value: unknown): value is MedReachResultStatus {
  return typeof value === 'string' && RESULT_STATUS_VALUES.has(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanNullableString(value: unknown): string | null {
  const cleaned = cleanString(value);
  return cleaned || null;
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => cleanString(item))
        .filter(Boolean),
    ),
  );
}

function cleanObjectArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function cleanBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function cleanNumber(value: unknown): number | null {
  if (value == null || value === '') return null;

  const n = Number(value);

  return Number.isFinite(n) ? n : null;
}

function toUpperKey(value: unknown) {
  return cleanString(value)
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

export function toMedReachPayerType(value: unknown): MedReachPayerType {
  const key = toUpperKey(value);

  if (PAYER_TYPE_VALUES.has(key)) {
    return key as MedReachPayerType;
  }

  if (key === 'MEDICALAID') return MEDREACH_PAYER_TYPES.MEDICAL_AID;
  if (key === 'CLIENT' || key === 'SPONSOR') {
    return MEDREACH_PAYER_TYPES.CLIENT_SPONSOR;
  }
  if (key === 'SPLIT') {
    return MEDREACH_PAYER_TYPES.SPLIT_SPONSOR_PATIENT;
  }

  return MEDREACH_PAYER_TYPES.CASH;
}

export function toMedReachReleasePolicy(value: unknown): MedReachReleasePolicy {
  const key = toUpperKey(value);

  if (RELEASE_POLICY_VALUES.has(key)) {
    return key as MedReachReleasePolicy;
  }

  return MEDREACH_RELEASE_POLICIES.CLINICIAN_FIRST;
}

// Backwards-compatible aliases from the older shared contract.
export const toPayerType = toMedReachPayerType;
export const toReleasePolicy = toMedReachReleasePolicy;

export function normalizeMedReachPayload(input: unknown): MedReachNormalizedOrderPayload {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('payload_must_be_object');
  }

  const raw = input as Record<string, any>;

  const candidateLabIds = cleanStringArray(
    raw.candidateLabIds || raw.eligibleLabs || raw.labIds,
  );

  if (candidateLabIds.length === 0) {
    throw new Error('candidateLabIds_required');
  }

  return {
    ...raw,

    orderId: cleanNullableString(raw.orderId),
    encounterId: cleanNullableString(raw.encounterId),
    patientId: cleanNullableString(raw.patientId),
    clinicianId: cleanNullableString(raw.clinicianId),
    sessionId: cleanNullableString(raw.sessionId),
    caseId: cleanNullableString(raw.caseId),

    initiatedByRole: cleanNullableString(raw.initiatedByRole),
    initiatedByUserId: cleanNullableString(raw.initiatedByUserId),
    createdFromApp: cleanNullableString(raw.createdFromApp),

    releasePolicy: toMedReachReleasePolicy(raw.releasePolicy),
    payerType: toMedReachPayerType(raw.payerType),
    urgency: cleanNullableString(raw.urgency),
    prepNotes: cleanNullableString(raw.prepNotes),
    fulfillmentMode: cleanNullableString(raw.fulfillmentMode),

    clientId: cleanNullableString(raw.clientId),
    clientMemberId: cleanNullableString(raw.clientMemberId),
    coveragePlanId: cleanNullableString(raw.coveragePlanId),
    coverageAuthorizationId: cleanNullableString(raw.coverageAuthorizationId),

    sponsorAmountMinor:
      raw.sponsorAmountMinor == null ? null : cleanNumber(raw.sponsorAmountMinor),
    patientCopayMinor:
      raw.patientCopayMinor == null ? null : cleanNumber(raw.patientCopayMinor),

    candidateLabIds,
    tests: cleanObjectArray(raw.tests),
    panels: cleanObjectArray(raw.panels ?? raw.panelInfo),

    patientName: cleanNullableString(raw.patientName),
    patientDob: cleanNullableString(raw.patientDob),
    patientGender: cleanNullableString(raw.patientGender),
    patientIdentifier: cleanNullableString(raw.patientIdentifier),
    patientPhone: cleanNullableString(raw.patientPhone),
    patientAddress: cleanNullableString(raw.patientAddress),
    patientArea: cleanNullableString(raw.patientArea),
    destinationLat: cleanNumber(raw.destinationLat),
    destinationLng: cleanNumber(raw.destinationLng),

    preferredPaymentMethod: cleanNullableString(raw.preferredPaymentMethod),
    gapPaymentMethod: cleanNullableString(raw.gapPaymentMethod),
    sponsorRequested: cleanBoolean(raw.sponsorRequested, false),

    medicalAidPolicyId: cleanNullableString(raw.medicalAidPolicyId),
    medicalAidSchemeName: cleanNullableString(raw.medicalAidSchemeName),
    medicalAidPlanName: cleanNullableString(raw.medicalAidPlanName),
    membershipNumber: cleanNullableString(raw.membershipNumber),
    dependentCode: cleanNullableString(raw.dependentCode),
    authorizationLetterFileKey: cleanNullableString(raw.authorizationLetterFileKey),
    voucherId: cleanNullableString(raw.voucherId),
    promoTokenId: cleanNullableString(raw.promoTokenId),
    cashFallbackAllowed: cleanBoolean(raw.cashFallbackAllowed, false),

    billingConsentCaptured: cleanBoolean(raw.billingConsentCaptured, false),
    patientConsentToShareWithLab: cleanBoolean(raw.patientConsentToShareWithLab, false),
    patientConsentToShareWithMedicalAid: cleanBoolean(
      raw.patientConsentToShareWithMedicalAid,
      false,
    ),
    patientConsentVersion: cleanNullableString(raw.patientConsentVersion),

    collectionWindow: raw.collectionWindow ?? undefined,
    sponsorPricingSnapshot: raw.sponsorPricingSnapshot ?? undefined,
  };
}