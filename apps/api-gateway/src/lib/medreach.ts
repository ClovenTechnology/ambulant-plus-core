import {
  MEDREACH_DRAW_STATUSES,
  MEDREACH_ELIGIBLE_LAB_STATUSES,
  MEDREACH_ORDER_STATUSES,
  MEDREACH_RELEASE_POLICIES,
  MEDREACH_RESULT_STATUSES,
  isBoolean,
  isNonEmptyString,
  toMedReachPayerType,
  toMedReachReleasePolicy,
  type MedReachNormalizedOrderPayload,
} from '@shared/medreach';

type IdentityLike = {
  userId?: string;
  role?: string;
  labId?: string;
  isAdmin?: boolean;
};

export function ok<T>(data: T, status = 200) {
  return Response.json({ ok: true, data }, { status });
}

export function fail(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
) {
  return Response.json(
    {
      ok: false,
      error: { code, message, details: details ?? null },
    },
    { status },
  );
}

function trimString(v: unknown) {
  return typeof v === 'string' ? v.trim() : '';
}

function optionalString(v: unknown) {
  const s = trimString(v);
  return s.length ? s : undefined;
}

function requiredString(name: string, v: unknown) {
  const s = trimString(v);
  if (!s) throw new Error(`Missing required field: ${name}`);
  return s;
}

function optionalNumber(v: unknown) {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function optionalDate(v: unknown) {
  if (!v) return undefined;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function asArray(v: unknown) {
  return Array.isArray(v) ? v : [];
}

function dedupeStrings(values: unknown[]) {
  return [...new Set(values.map((v) => String(v).trim()).filter(Boolean))];
}

export function assertBroadcasterAuthorized(identity: IdentityLike, headers: Headers) {
  const role = String(identity?.role ?? '').toLowerCase();
  const isAdmin = Boolean(identity?.isAdmin) || role === 'admin';

  if (isAdmin) return;

  const serverActor = headers.get('x-medreach-server-actor');
  const providedKey = headers.get('x-medreach-broadcast-key');
  const expectedKey = process.env.MEDREACH_BROADCAST_KEY;

  if (serverActor === '1' && expectedKey && providedKey === expectedKey) return;

  throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
}

export async function assertLabActorAccess(
  prisma: any,
  identity: IdentityLike,
  labId: string,
) {
  const role = String(identity?.role ?? '').toLowerCase();
  const isAdmin = Boolean(identity?.isAdmin) || role === 'admin';

  const lab = await prisma.labPartner.findUnique({
    where: { id: labId },
    select: {
      id: true,
      active: true,
      ownerUserId: true,
    },
  });

  if (!lab || !lab.active) {
    throw Object.assign(new Error('Lab not found or inactive'), { statusCode: 404 });
  }

  if (isAdmin) return lab;
  if (identity?.labId && identity.labId === labId) return lab;
  if (identity?.userId && lab.ownerUserId && lab.ownerUserId === identity.userId) return lab;

  throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
}

export function normalizeBroadcastPayload(raw: any): MedReachNormalizedOrderPayload {
  const tests = asArray(raw?.tests);
  const panels = asArray(raw?.panels ?? raw?.panelInfo);

  if (!tests.length && !panels.length) {
    throw new Error('At least one test or panel is required');
  }

  const candidateLabIds = dedupeStrings(asArray(raw?.candidateLabIds));
  if (!candidateLabIds.length) {
    throw new Error('At least one candidateLabId is required');
  }

  const billingConsentCaptured = raw?.billingConsentCaptured;
  const patientConsentToShareWithLab = raw?.patientConsentToShareWithLab;
  const patientConsentToShareWithMedicalAid = raw?.patientConsentToShareWithMedicalAid;

  if (!isBoolean(billingConsentCaptured)) {
    throw new Error('billingConsentCaptured must be boolean');
  }
  if (!isBoolean(patientConsentToShareWithLab)) {
    throw new Error('patientConsentToShareWithLab must be boolean');
  }
  if (!isBoolean(patientConsentToShareWithMedicalAid)) {
    throw new Error('patientConsentToShareWithMedicalAid must be boolean');
  }

  return {
    orderId: optionalString(raw?.orderId),
    encounterId: requiredString('encounterId', raw?.encounterId),
    patientId: requiredString('patientId', raw?.patientId),
    clinicianId: requiredString('clinicianId', raw?.clinicianId),
    sessionId: optionalString(raw?.sessionId),
    caseId: optionalString(raw?.caseId),
    initiatedByRole: requiredString('initiatedByRole', raw?.initiatedByRole),
    initiatedByUserId: requiredString('initiatedByUserId', raw?.initiatedByUserId),
    createdFromApp: requiredString('createdFromApp', raw?.createdFromApp),
    patientName: requiredString('patientName', raw?.patientName),
    patientDob: optionalDate(raw?.patientDob),
    patientGender: optionalString(raw?.patientGender),
    patientIdentifier: requiredString('patientIdentifier', raw?.patientIdentifier),
    patientPhone: optionalString(raw?.patientPhone),
    patientAddress: requiredString('patientAddress', raw?.patientAddress),
    patientArea: requiredString('patientArea', raw?.patientArea),
    destinationLat: optionalNumber(raw?.destinationLat),
    destinationLng: optionalNumber(raw?.destinationLng),
    tests,
    panels,
    urgency: optionalString(raw?.urgency),
    prepNotes: optionalString(raw?.prepNotes),
    collectionWindow: raw?.collectionWindow ?? undefined,
    candidateLabIds,
    payerType: toMedReachPayerType(raw?.payerType),
    medicalAidPolicyId: optionalString(raw?.medicalAidPolicyId),
    medicalAidSchemeName: optionalString(raw?.medicalAidSchemeName),
    medicalAidPlanName: optionalString(raw?.medicalAidPlanName),
    membershipNumber: optionalString(raw?.membershipNumber),
    dependentCode: optionalString(raw?.dependentCode),
    authorizationLetterFileKey: optionalString(raw?.authorizationLetterFileKey),
    voucherId: optionalString(raw?.voucherId),
    promoTokenId: optionalString(raw?.promoTokenId),
    cashFallbackAllowed: Boolean(raw?.cashFallbackAllowed),
    billingConsentCaptured,
    patientConsentToShareWithLab,
    patientConsentToShareWithMedicalAid,
    patientConsentVersion: optionalString(raw?.patientConsentVersion),
    releasePolicy: toMedReachReleasePolicy(
      raw?.releasePolicy ?? MEDREACH_RELEASE_POLICIES.CLINICIAN_FIRST,
    ),
  };
}

export const medreachChannels = {
  order: (orderId: string) => `medreach:order:${orderId}`,
  draw: (drawId: string) => `medreach:draw:${drawId}`,
  labQueue: (labId: string) => `medreach:lab:${labId}:queue`,
};

export function buildLabFacingOrderShape(input: {
  order: any;
  draw?: any;
  eligibility?: any;
}) {
  const order = input.order;
  const draw = input.draw ?? order?.draw ?? null;
  const eligibility = input.eligibility ?? null;

  return {
    orderId: order.id,
    encounterId: order.encounterId,
    status: order.status,
    resultStatus: order.resultStatus,
    releasePolicy: order.releasePolicy,
    payerType: order.payerType,
    urgency: order.urgency,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    patient: {
      id: order.patientId,
      name: order.patientName,
      dob: order.patientDob,
      gender: order.patientGender,
      identifier: order.patientIdentifier,
      phone: order.patientPhone,
      address: order.patientAddress,
      area: order.patientArea,
      lat: order.destinationLat,
      lng: order.destinationLng,
    },
    clinicianId: order.clinicianId,
    tests: order.testsJson ?? [],
    panels: order.panelsJson ?? [],
    prepNotes: order.prepNotes,
    collectionWindow: order.collectionWindowJson ?? null,
    draw: draw
      ? {
          id: draw.id,
          status: draw.status,
          partnerId: draw.partnerId,
          assignedAt: draw.assignedAt,
          specimenCollectedAt: draw.specimenCollectedAt,
          receivedByLabAt: draw.receivedByLabAt,
        }
      : null,
    eligibility: eligibility
      ? {
          id: eligibility.id,
          status: eligibility.status,
          respondedAt: eligibility.respondedAt,
          acceptedAt: eligibility.acceptedAt,
          declinedAt: eligibility.declinedAt,
          expiredAt: eligibility.expiredAt,
        }
      : null,
  };
}

export const medreachDefaults = {
  orderStatusOpen: MEDREACH_ORDER_STATUSES.MARKETPLACE_OPEN,
  orderStatusAssigned: MEDREACH_ORDER_STATUSES.ASSIGNED,
  orderStatusCollected: MEDREACH_ORDER_STATUSES.SPECIMEN_COLLECTED,
  orderStatusResultsReady: MEDREACH_ORDER_STATUSES.RESULTS_READY,
  orderStatusExhausted: MEDREACH_ORDER_STATUSES.MARKETPLACE_EXHAUSTED,
  drawPending: MEDREACH_DRAW_STATUSES.PENDING_ASSIGNMENT,
  drawAssigned: MEDREACH_DRAW_STATUSES.ASSIGNED,
  drawCollected: MEDREACH_DRAW_STATUSES.SPECIMEN_COLLECTED,
  drawReceived: MEDREACH_DRAW_STATUSES.RECEIVED_BY_LAB,
  resultPending: MEDREACH_RESULT_STATUSES.PENDING_SPECIMEN,
  resultReady: MEDREACH_RESULT_STATUSES.READY_FOR_REVIEW,
  resultReleasedToClinician: MEDREACH_RESULT_STATUSES.RELEASED_TO_CLINICIAN,
  resultReleasedToPatient: MEDREACH_RESULT_STATUSES.RELEASED_TO_PATIENT,
  eligible: MEDREACH_ELIGIBLE_LAB_STATUSES.ELIGIBLE,
  accepted: MEDREACH_ELIGIBLE_LAB_STATUSES.ACCEPTED,
  declined: MEDREACH_ELIGIBLE_LAB_STATUSES.DECLINED,
  expired: MEDREACH_ELIGIBLE_LAB_STATUSES.EXPIRED,
};