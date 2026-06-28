// apps/api-gateway/src/lib/medreach.ts
import {
  MEDREACH_DRAW_STATUSES,
  MEDREACH_ELIGIBILITY_STATUSES,
  MEDREACH_ORDER_STATUSES,
  MEDREACH_RELEASE_POLICIES,
  MEDREACH_RESULT_STATUSES,
  isBoolean,
  toMedReachPayerType,
  toMedReachReleasePolicy,
  type MedReachNormalizedOrderPayload,
} from '@shared/medreach';

type IdentityLike = {
  uid?: string | null;
  userId?: string | null;
  role?: string | null;
  labId?: string | null;
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
      error: {
        code,
        message,
        details: details ?? null,
      },
    },
    { status },
  );
}

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalString(value: unknown) {
  const text = trimString(value);

  return text.length ? text : undefined;
}

function requiredString(name: string, value: unknown) {
  const text = trimString(value);

  if (!text) {
    throw new Error(`Missing required field: ${name}`);
  }

  return text;
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const n = Number(value);

  return Number.isFinite(n) ? n : undefined;
}

function optionalDate(value: unknown) {
  if (!value) return undefined;

  const date = new Date(String(value));

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function dedupeStrings(values: unknown[]) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  );
}

function actorUserId(identity: IdentityLike) {
  return identity.userId || identity.uid || null;
}

export function assertBroadcasterAuthorized(identity: IdentityLike, headers: Headers) {
  const role = String(identity?.role ?? '').toLowerCase();
  const isAdmin = Boolean(identity?.isAdmin) || role === 'admin';

  if (isAdmin) return;

  const serverActor = headers.get('x-medreach-server-actor');
  const providedKey = headers.get('x-medreach-broadcast-key');
  const expectedKey = process.env.MEDREACH_BROADCAST_KEY;

  if (serverActor === '1' && expectedKey && providedKey === expectedKey) {
    return;
  }

  throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
}

export async function assertLabActorAccess(
  prisma: any,
  identity: IdentityLike,
  labId: string,
) {
  const role = String(identity?.role ?? '').toLowerCase();
  const isAdmin = Boolean(identity?.isAdmin) || role === 'admin';
  const uid = actorUserId(identity);

  const lab = await prisma.labPartner.findUnique({
    where: {
      id: labId,
    },
    select: {
      id: true,
      active: true,
      status: true,
      ownerUserId: true,
    },
  });

  if (!lab || !lab.active || lab.status !== 'ACTIVE') {
    throw Object.assign(new Error('Lab not found or inactive'), {
      statusCode: 404,
    });
  }

  if (isAdmin) return lab;
  if (identity?.labId && identity.labId === labId) return lab;
  if (uid && lab.ownerUserId && lab.ownerUserId === uid) return lab;

  if (uid) {
    const staff = await prisma.medReachLabStaff.findFirst({
      where: {
        userId: uid,
        labId,
        active: true,
        status: 'ACTIVE',
      },
      select: {
        labId: true,
      },
    });

    if (staff?.labId === labId) return lab;
  }

  throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
}

export function normalizeBroadcastPayload(raw: any): MedReachNormalizedOrderPayload {
  const tests = asArray(raw?.tests);
  const panels = asArray(raw?.panels ?? raw?.panelInfo);

  if (!tests.length && !panels.length) {
    throw new Error('At least one test or panel is required');
  }

  const candidateLabIds = dedupeStrings(
    asArray(raw?.candidateLabIds || raw?.eligibleLabs || raw?.labIds),
  );

  if (!candidateLabIds.length) {
    throw new Error('At least one candidateLabId is required');
  }

  const billingConsentCaptured = raw?.billingConsentCaptured;
  const patientConsentToShareWithLab = raw?.patientConsentToShareWithLab;
  const patientConsentToShareWithMedicalAid =
    raw?.patientConsentToShareWithMedicalAid;

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
    initiatedByUserId: requiredString(
      'initiatedByUserId',
      raw?.initiatedByUserId,
    ),
    createdFromApp: requiredString('createdFromApp', raw?.createdFromApp),

    patientName: requiredString('patientName', raw?.patientName),
    patientDob: optionalDate(raw?.patientDob),
    patientGender: optionalString(raw?.patientGender),
    patientIdentifier: requiredString(
      'patientIdentifier',
      raw?.patientIdentifier,
    ),
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
          phlebId: draw.phlebId,
          scheduledAt: draw.scheduledAt,
          assignedAt: draw.assignedAt,
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
  orderStatusReceivedAtLab: MEDREACH_ORDER_STATUSES.RECEIVED_AT_LAB,
  orderStatusResultsReady: MEDREACH_ORDER_STATUSES.RESULT_READY,
  orderStatusResultSent: MEDREACH_ORDER_STATUSES.RESULT_SENT,
  orderStatusExhausted: MEDREACH_ORDER_STATUSES.MARKETPLACE_EXHAUSTED,
  orderStatusCancelled: MEDREACH_ORDER_STATUSES.CANCELLED,

  // Compatibility names retained for older call-sites.
  orderStatusCollected: MEDREACH_DRAW_STATUSES.SPECIMEN_COLLECTED,
  orderStatusResultsReadyCompat: MEDREACH_ORDER_STATUSES.RESULT_READY,

  drawRequested: MEDREACH_DRAW_STATUSES.REQUESTED,
  drawPending: MEDREACH_DRAW_STATUSES.REQUESTED,
  drawMarketplaceOpen: MEDREACH_DRAW_STATUSES.MARKETPLACE_OPEN,
  drawAssigned: MEDREACH_DRAW_STATUSES.ASSIGNED,
  drawEnRoute: MEDREACH_DRAW_STATUSES.EN_ROUTE,
  drawArrived: MEDREACH_DRAW_STATUSES.ARRIVED,
  drawCollected: MEDREACH_DRAW_STATUSES.SPECIMEN_COLLECTED,
  drawInTransitToLab: MEDREACH_DRAW_STATUSES.IN_TRANSIT_TO_LAB,
  drawReceived: MEDREACH_DRAW_STATUSES.RECEIVED_AT_LAB,
  drawCompleted: MEDREACH_DRAW_STATUSES.COMPLETED,
  drawCancelled: MEDREACH_DRAW_STATUSES.CANCELLED,

  resultPending: MEDREACH_RESULT_STATUSES.PENDING,
  resultInProgress: MEDREACH_RESULT_STATUSES.IN_PROGRESS,
  resultReady: MEDREACH_RESULT_STATUSES.READY,
  resultSent: MEDREACH_RESULT_STATUSES.SENT,

  // Compatibility names retained for older call-sites.
  resultReleasedToClinician: MEDREACH_RESULT_STATUSES.SENT,
  resultReleasedToPatient: MEDREACH_RESULT_STATUSES.SENT,

  eligible: MEDREACH_ELIGIBILITY_STATUSES.ELIGIBLE,
  accepted: MEDREACH_ELIGIBILITY_STATUSES.ACCEPTED,
  declined: MEDREACH_ELIGIBILITY_STATUSES.DECLINED,
  expired: MEDREACH_ELIGIBILITY_STATUSES.EXPIRED,
  removed: MEDREACH_ELIGIBILITY_STATUSES.REMOVED,
};