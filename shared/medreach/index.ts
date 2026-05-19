export const MEDREACH_ELIGIBILITY_STATUSES = {
  ELIGIBLE: 'ELIGIBLE',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  EXPIRED: 'EXPIRED',
  REMOVED: 'REMOVED',
} as const;

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

export type MedReachEligibilityStatus =
  (typeof MEDREACH_ELIGIBILITY_STATUSES)[keyof typeof MEDREACH_ELIGIBILITY_STATUSES];

export type MedReachOrderStatus =
  (typeof MEDREACH_ORDER_STATUSES)[keyof typeof MEDREACH_ORDER_STATUSES];

export type MedReachDrawStatus =
  (typeof MEDREACH_DRAW_STATUSES)[keyof typeof MEDREACH_DRAW_STATUSES];

export type MedReachResultStatus =
  (typeof MEDREACH_RESULT_STATUSES)[keyof typeof MEDREACH_RESULT_STATUSES];

const DRAW_STATUS_VALUES = new Set<string>(Object.values(MEDREACH_DRAW_STATUSES));
const RESULT_STATUS_VALUES = new Set<string>(Object.values(MEDREACH_RESULT_STATUSES));

export function isValidDrawStatus(value: unknown): value is MedReachDrawStatus {
  return typeof value === 'string' && DRAW_STATUS_VALUES.has(value);
}

export function isValidResultStatus(value: unknown): value is MedReachResultStatus {
  return typeof value === 'string' && RESULT_STATUS_VALUES.has(value);
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

  return value
    .map((item) => cleanString(item))
    .filter(Boolean);
}

function cleanObjectArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function cleanBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function cleanNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeMedReachPayload(input: unknown): Record<string, any> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('payload_must_be_object');
  }

  const raw = input as Record<string, any>;

  const candidateLabIds = cleanStringArray(raw.candidateLabIds);

  if (candidateLabIds.length === 0) {
    throw new Error('candidateLabIds_required');
  }

  return {
    ...raw,

    orderId: cleanNullableString(raw.orderId),
    encounterId: cleanNullableString(raw.encounterId),
    patientId: cleanNullableString(raw.patientId),
    clinicianId: cleanNullableString(raw.clinicianId),

    initiatedByRole: cleanNullableString(raw.initiatedByRole),
    initiatedByUserId: cleanNullableString(raw.initiatedByUserId),
    createdFromApp: cleanNullableString(raw.createdFromApp),

    releasePolicy: cleanNullableString(raw.releasePolicy),
    payerType: cleanNullableString(raw.payerType),
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
    panels: cleanObjectArray(raw.panels),

    patientName: cleanNullableString(raw.patientName),
    patientDob: cleanNullableString(raw.patientDob),
    patientGender: cleanNullableString(raw.patientGender),
    patientIdentifier: cleanNullableString(raw.patientIdentifier),
    patientPhone: cleanNullableString(raw.patientPhone),
    patientAddress: cleanNullableString(raw.patientAddress),
    patientArea: cleanNullableString(raw.patientArea),
    destinationLat: raw.destinationLat == null ? null : cleanNumber(raw.destinationLat),
    destinationLng: raw.destinationLng == null ? null : cleanNumber(raw.destinationLng),

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

    billingConsentCaptured: cleanBoolean(raw.billingConsentCaptured, false),
    patientConsentToShareWithLab: cleanBoolean(raw.patientConsentToShareWithLab, false),
    patientConsentToShareWithMedicalAid: cleanBoolean(
      raw.patientConsentToShareWithMedicalAid,
      false,
    ),
    patientConsentVersion: cleanNullableString(raw.patientConsentVersion),
  };
}