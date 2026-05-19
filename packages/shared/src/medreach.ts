export const MEDREACH_ORDER_STATUSES = {
  MARKETPLACE_OPEN: 'pending_lab',
  ASSIGNED: 'waiting_phleb',
  PHLEB_EN_ROUTE: 'phleb_en_route',
  PHLEB_ARRIVED: 'phleb_arrived',
  SPECIMEN_COLLECTED: 'collected',
  RECEIVED_AT_LAB: 'received_at_lab',
  RESULT_READY: 'result_ready',
  RESULT_SENT_TO_CLINICIAN: 'result_sent_to_clinician',
  RESULT_SENT_TO_PATIENT: 'result_sent_to_patient',
  COMPLETED: 'completed',
  CANCELLED: 'canceled',
  MARKETPLACE_EXHAUSTED: 'marketplace_exhausted',
} as const;

export const MEDREACH_DRAW_STATUSES = {
  MARKETPLACE_OPEN: 'pending_lab',
  ASSIGNED: 'waiting_phleb',
  PHLEB_EN_ROUTE: 'phleb_en_route',
  PHLEB_ARRIVED: 'phleb_arrived',
  SPECIMEN_COLLECTED: 'collected',
  RECEIVED_AT_LAB: 'received_at_lab',
  COMPLETED: 'completed',
  CANCELLED: 'canceled',
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
  VOUCHER: 'VOUCHER',
  PROMO: 'PROMO',
  HYBRID: 'HYBRID',
} as const;

export const MEDREACH_ELIGIBILITY_STATUSES = {
  ELIGIBLE: 'ELIGIBLE',
  DECLINED: 'DECLINED',
  ACCEPTED: 'ACCEPTED',
  EXPIRED: 'EXPIRED',
  REMOVED: 'REMOVED',
} as const;

export type MedReachResultStatus =
  (typeof MEDREACH_RESULT_STATUSES)[keyof typeof MEDREACH_RESULT_STATUSES];

export type MedReachReleasePolicy =
  (typeof MEDREACH_RELEASE_POLICIES)[keyof typeof MEDREACH_RELEASE_POLICIES];

export type MedReachPayerType =
  (typeof MEDREACH_PAYER_TYPES)[keyof typeof MEDREACH_PAYER_TYPES];

export type NormalizedMedReachPayload = {
  orderId?: string;
  encounterId: string;
  patientId: string;
  clinicianId: string;
  sessionId?: string;
  caseId?: string;
  initiatedByRole: string;
  initiatedByUserId: string;
  createdFromApp: string;
  patientName: string;
  patientDob?: string;
  patientGender?: string;
  patientIdentifier: string;
  patientPhone?: string;
  patientAddress: string;
  patientArea: string;
  destinationLat?: number;
  destinationLng?: number;
  tests: Array<{ code?: string; name?: string }>;
  panels: Array<{ code?: string; name?: string }>;
  urgency?: string;
  prepNotes?: string;
  collectionWindow?: unknown;
  candidateLabIds: string[];
  payerType: MedReachPayerType;
  medicalAidPolicyId?: string;
  medicalAidSchemeName?: string;
  medicalAidPlanName?: string;
  membershipNumber?: string;
  dependentCode?: string;
  authorizationLetterFileKey?: string;
  voucherId?: string;
  promoTokenId?: string;
  cashFallbackAllowed: boolean;
  billingConsentCaptured: boolean;
  patientConsentToShareWithLab: boolean;
  patientConsentToShareWithMedicalAid: boolean;
  patientConsentVersion?: string;
  releasePolicy: MedReachReleasePolicy;
};

function cleanString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function uniqStrings(values: unknown[]): string[] {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((v) => cleanString(v))
        .filter(Boolean),
    ),
  );
}

function toUpperKey(v: unknown) {
  return cleanString(v).toUpperCase().replace(/[\s-]+/g, '_');
}

export function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function toPayerType(v: unknown): MedReachPayerType {
  const k = toUpperKey(v);
  if (k in MEDREACH_PAYER_TYPES) {
    return MEDREACH_PAYER_TYPES[k as keyof typeof MEDREACH_PAYER_TYPES];
  }
  return MEDREACH_PAYER_TYPES.CASH;
}

export function toReleasePolicy(v: unknown): MedReachReleasePolicy {
  const k = toUpperKey(v);
  if (k in MEDREACH_RELEASE_POLICIES) {
    return MEDREACH_RELEASE_POLICIES[k as keyof typeof MEDREACH_RELEASE_POLICIES];
  }
  return MEDREACH_RELEASE_POLICIES.CLINICIAN_FIRST;
}

export function isValidDrawStatus(v: unknown) {
  return Object.values(MEDREACH_DRAW_STATUSES).includes(cleanString(v) as any);
}

export function isValidResultStatus(v: unknown): v is MedReachResultStatus {
  return Object.values(MEDREACH_RESULT_STATUSES).includes(String(v).toUpperCase() as any);
}

export function normalizeMedReachPayload(raw: any): NormalizedMedReachPayload {
  const tests = Array.isArray(raw?.tests) ? raw.tests : [];
  const panels = Array.isArray(raw?.panels) ? raw.panels : [];
  const candidateLabIds = uniqStrings(raw?.candidateLabIds || raw?.eligibleLabs || raw?.labIds || []);

  if (!cleanString(raw?.encounterId)) throw new Error('encounterId is required');
  if (!cleanString(raw?.patientId)) throw new Error('patientId is required');
  if (!cleanString(raw?.clinicianId)) throw new Error('clinicianId is required');
  if (!cleanString(raw?.initiatedByRole)) throw new Error('initiatedByRole is required');
  if (!cleanString(raw?.initiatedByUserId)) throw new Error('initiatedByUserId is required');
  if (!cleanString(raw?.createdFromApp)) throw new Error('createdFromApp is required');
  if (!cleanString(raw?.patientName)) throw new Error('patientName is required');
  if (!cleanString(raw?.patientIdentifier)) throw new Error('patientIdentifier is required');
  if (!cleanString(raw?.patientAddress)) throw new Error('patientAddress is required');
  if (!cleanString(raw?.patientArea)) throw new Error('patientArea is required');
  if (!candidateLabIds.length) throw new Error('candidateLabIds is required');
  if (!tests.length && !panels.length) throw new Error('tests or panels is required');
  if (typeof raw?.billingConsentCaptured !== 'boolean') {
    throw new Error('billingConsentCaptured must be boolean');
  }
  if (typeof raw?.patientConsentToShareWithLab !== 'boolean') {
    throw new Error('patientConsentToShareWithLab must be boolean');
  }
  if (typeof raw?.patientConsentToShareWithMedicalAid !== 'boolean') {
    throw new Error('patientConsentToShareWithMedicalAid must be boolean');
  }

  const payerType = toPayerType(raw?.payerType);

  return {
    orderId: cleanString(raw?.orderId) || undefined,
    encounterId: cleanString(raw?.encounterId),
    patientId: cleanString(raw?.patientId),
    clinicianId: cleanString(raw?.clinicianId),
    sessionId: cleanString(raw?.sessionId) || undefined,
    caseId: cleanString(raw?.caseId) || undefined,
    initiatedByRole: cleanString(raw?.initiatedByRole),
    initiatedByUserId: cleanString(raw?.initiatedByUserId),
    createdFromApp: cleanString(raw?.createdFromApp),
    patientName: cleanString(raw?.patientName),
    patientDob: cleanString(raw?.patientDob) || undefined,
    patientGender: cleanString(raw?.patientGender) || undefined,
    patientIdentifier: cleanString(raw?.patientIdentifier),
    patientPhone: cleanString(raw?.patientPhone) || undefined,
    patientAddress: cleanString(raw?.patientAddress),
    patientArea: cleanString(raw?.patientArea),
    destinationLat:
      raw?.destinationLat == null || raw?.destinationLat === ''
        ? undefined
        : Number(raw.destinationLat),
    destinationLng:
      raw?.destinationLng == null || raw?.destinationLng === ''
        ? undefined
        : Number(raw.destinationLng),
    tests,
    panels,
    urgency: cleanString(raw?.urgency) || undefined,
    prepNotes: cleanString(raw?.prepNotes) || undefined,
    collectionWindow: raw?.collectionWindow ?? undefined,
    candidateLabIds,
    payerType,
    medicalAidPolicyId: cleanString(raw?.medicalAidPolicyId) || undefined,
    medicalAidSchemeName: cleanString(raw?.medicalAidSchemeName) || undefined,
    medicalAidPlanName: cleanString(raw?.medicalAidPlanName) || undefined,
    membershipNumber: cleanString(raw?.membershipNumber) || undefined,
    dependentCode: cleanString(raw?.dependentCode) || undefined,
    authorizationLetterFileKey: cleanString(raw?.authorizationLetterFileKey) || undefined,
    voucherId: cleanString(raw?.voucherId) || undefined,
    promoTokenId: cleanString(raw?.promoTokenId) || undefined,
    cashFallbackAllowed: Boolean(raw?.cashFallbackAllowed),
    billingConsentCaptured: raw.billingConsentCaptured,
    patientConsentToShareWithLab: raw.patientConsentToShareWithLab,
    patientConsentToShareWithMedicalAid: raw.patientConsentToShareWithMedicalAid,
    patientConsentVersion: cleanString(raw?.patientConsentVersion) || undefined,
    releasePolicy: toReleasePolicy(raw?.releasePolicy),
  };
}