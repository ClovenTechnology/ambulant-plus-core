// apps/api-gateway/src/appointments/multi-care.ts
import crypto from 'node:crypto';
import { prisma } from '@/src/lib/db';
import type {
  MultiCareFeeKind,
  MultiCarePolicyView,
  MultiCareVisitMode,
} from '@/src/clinicians/multi-care-policy';

const MAX_RUNTIME_CARE_RECIPIENTS = 20;
const ACTIVE_APPOINTMENT_EXCLUSIONS = [
  'cancelled',
  'canceled',
  'Cancelled',
  'completed',
  'Completed',
];

export type RequestedCareRecipient = {
  patientId: string;
  familyRelationshipId: string | null;
  role: 'PRIMARY' | 'DEPENDANT' | 'ADDITIONAL';
  reason: string | null;
  caseId: string | null;
  metadata: Record<string, unknown> | null;
};

export type AuthorizedCareRecipient = RequestedCareRecipient & {
  sequence: number;
  patientId: string;
  patientUserId: string | null;
  displayName: string;
  photoUrl: string | null;
  gender: string | null;
  identityVerified: boolean;
  identityVerificationSource:
    | 'SELF_AUTHENTICATED'
    | 'LINKED_SUBJECT_ACCOUNT'
    | 'VERIFIED_RELATIONSHIP'
    | 'UNVERIFIED_DIRECT_RELATIONSHIP';
};

export type MultiCareAllocation = {
  sequence: number;
  patientId: string;
  baseAmountMinor: number;
  additionalAmountMinor: number;
  discountMinor: number;
  grossAmountMinor: number;
  sponsorAmountMinor: number;
  patientPayableMinor: number;
  currency: string;
};

export type MultiCareQuote = {
  recipientCount: number;
  multiCare: boolean;
  feeKind: MultiCareFeeKind;
  visitMode: MultiCareVisitMode;
  currency: string;
  baseAmountMinor: number;
  totalAmountMinor: number;
  baseDurationMin: number;
  additionalDurationMin: number;
  durationMin: number;
  policy: MultiCarePolicyView | null;
  allocations: MultiCareAllocation[];
};

export type MultiCarePriceLockPayload = {
  version: 1;
  clinicianId: string;
  hostUserId: string;
  actorPatientId: string;
  startsAt: string;
  requestedEndsAt: string;
  finalEndsAt: string;
  feeKind: MultiCareFeeKind;
  visitMode: MultiCareVisitMode;
  recipientIds: string[];
  totalAmountMinor: number;
  currency: string;
  durationMin: number;
  policyId: string | null;
  policyVersion: number | null;
  issuedAt: string;
  expiresAt: string;
};

export class MultiCareBookingError extends Error {
  status: number;
  code: string;
  details: unknown;

  constructor(code: string, status = 400, details: unknown = null) {
    super(code);
    this.name = 'MultiCareBookingError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asMinor(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(0, Math.round(numberValue));
}

function asPositiveInt(value: unknown, fallback: number) {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) return fallback;
  return numberValue;
}

function normalizeCurrency(value: unknown) {
  const currency = clean(value || 'ZAR', 3).toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : 'ZAR';
}

function normalizeRole(value: unknown, sequence: number) {
  if (sequence === 0) return 'PRIMARY' as const;

  const role = clean(value, 40).toUpperCase();
  return role === 'DEPENDANT' ? 'DEPENDANT' as const : 'ADDITIONAL' as const;
}

function permissionAllowsAppointmentBooking(value: unknown) {
  const permissions = asObject(value);
  if (!permissions) return false;

  const appointments = asObject(permissions.appointments);
  const modules = asObject(permissions.modules);
  const moduleAppointments = asObject(modules?.appointments);

  return [
    permissions.canBookAppointments,
    permissions.bookAppointments,
    permissions.manageAppointments,
    permissions.clinicalAuthority,
    appointments?.book,
    appointments?.manage,
    moduleAppointments?.book,
    moduleAppointments?.manage,
  ].some((permission) => permission === true);
}

function identityExplicitlyVerified(value: unknown) {
  const root = asObject(value);
  if (!root) return false;

  const identity = asObject(root.identity);
  const verification = asObject(root.verification);
  const verificationStatus = clean(
    verification?.status ||
      identity?.status ||
      root.identityVerificationStatus,
    80,
  ).toUpperCase();

  return (
    root.identityVerified === true ||
    root.verifiedIdentity === true ||
    identity?.verified === true ||
    verification?.identityVerified === true ||
    ['VERIFIED', 'APPROVED', 'COMPLETE', 'COMPLETED'].includes(
      verificationStatus,
    )
  );
}

function serializePolicy(row: any): MultiCarePolicyView {
  return {
    id: String(row.id),
    clinicianUserId: String(row.clinicianUserId),
    feeKind: row.feeKind as MultiCareFeeKind,
    visitMode: row.visitMode as MultiCareVisitMode,
    enabled: Boolean(row.enabled),
    pricingMode: row.pricingMode,
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

export function normalizeRequestedCareRecipients(args: {
  rawRecipients: unknown;
  fallbackPatientId: string;
  fallbackRelationshipId?: string | null;
  fallbackCaseId?: string | null;
}) {
  const fallbackPatientId = clean(args.fallbackPatientId);

  if (!fallbackPatientId) {
    throw new MultiCareBookingError('care_recipient_patient_required', 400);
  }

  const source = Array.isArray(args.rawRecipients)
    ? args.rawRecipients
    : [
        {
          patientId: fallbackPatientId,
          familyRelationshipId: args.fallbackRelationshipId || null,
          caseId: args.fallbackCaseId || null,
          role: 'PRIMARY',
        },
      ];

  if (source.length === 0) {
    throw new MultiCareBookingError('care_recipients_required', 400);
  }

  if (source.length > MAX_RUNTIME_CARE_RECIPIENTS) {
    throw new MultiCareBookingError(
      'care_recipient_limit_exceeded',
      400,
      { maximum: MAX_RUNTIME_CARE_RECIPIENTS },
    );
  }

  return source.map((raw: any, sequence): RequestedCareRecipient => {
    const patientId = clean(
      raw?.patientId ||
        raw?.patient_id ||
        raw?.subjectPatientId ||
        raw?.subject_patient_id,
    );

    if (!patientId) {
      throw new MultiCareBookingError(
        'care_recipient_patient_required',
        400,
        { sequence },
      );
    }

    return {
      patientId,
      familyRelationshipId:
        clean(
          raw?.familyRelationshipId ||
            raw?.family_relationship_id ||
            raw?.relationshipId ||
            raw?.relationship_id,
        ) || null,
      role: normalizeRole(raw?.role, sequence),
      reason: clean(raw?.reason || raw?.consultationReason, 1000) || null,
      caseId: clean(raw?.caseId || raw?.case_id) || null,
      metadata: asObject(raw?.metadata),
    };
  });
}

export async function resolveAuthorizedCareRecipients(args: {
  rawRecipients: unknown;
  actorPatientId: string;
  hostUserId: string;
  fallbackSubjectPatientId: string;
  fallbackRelationshipId?: string | null;
  fallbackCaseId?: string | null;
}) {
  const actorPatientId = clean(args.actorPatientId);
  const hostUserId = clean(args.hostUserId);

  if (!actorPatientId || !hostUserId) {
    throw new MultiCareBookingError('patient_identity_required', 401);
  }

  const requested = normalizeRequestedCareRecipients({
    rawRecipients: args.rawRecipients,
    fallbackPatientId: args.fallbackSubjectPatientId || actorPatientId,
    fallbackRelationshipId: args.fallbackRelationshipId,
    fallbackCaseId: args.fallbackCaseId,
  });

  const actorProfile = await (prisma as any).patientProfile.findFirst({
    where: {
      OR: [
        { id: actorPatientId },
        { userId: actorPatientId },
        { userId: hostUserId },
      ],
    },
    select: { id: true, userId: true },
  });

  if (!actorProfile) {
    throw new MultiCareBookingError('actor_patient_profile_not_found', 404);
  }

  const resolved: AuthorizedCareRecipient[] = [];
  const seen = new Set<string>();

  for (let sequence = 0; sequence < requested.length; sequence += 1) {
    const item = requested[sequence];

    const profile = await (prisma as any).patientProfile.findFirst({
      where: {
        OR: [
          { id: item.patientId },
          { userId: item.patientId },
        ],
      },
      select: {
        id: true,
        userId: true,
        name: true,
        photoUrl: true,
        gender: true,
        profileMetadata: true,
      },
    });

    if (!profile) {
      throw new MultiCareBookingError(
        'care_recipient_not_found',
        404,
        { sequence, patientId: item.patientId },
      );
    }

    const canonicalPatientId = String(profile.id);

    if (seen.has(canonicalPatientId)) {
      throw new MultiCareBookingError(
        'duplicate_care_recipient',
        409,
        { patientId: canonicalPatientId },
      );
    }

    seen.add(canonicalPatientId);

    const isSelf =
      canonicalPatientId === String(actorProfile.id) ||
      clean(profile.userId) === hostUserId ||
      clean(profile.userId) === clean(actorProfile.userId);

    let relationshipId = item.familyRelationshipId;
    let identityVerified = isSelf;
    let identityVerificationSource:
      AuthorizedCareRecipient['identityVerificationSource'] =
      'SELF_AUTHENTICATED';

    if (!isSelf) {
      if (!relationshipId) {
        throw new MultiCareBookingError(
          'direct_family_relationship_required',
          403,
          { patientId: canonicalPatientId },
        );
      }

      const relationship = await (prisma as any).familyRelationship.findFirst({
        where: {
          id: relationshipId,
          hostUserId,
          subjectPatientId: canonicalPatientId,
          status: 'ACTIVE',
          revokedAt: null,
        },
        select: {
          id: true,
          subjectUserId: true,
          permissions: true,
        },
      });

      if (!relationship) {
        throw new MultiCareBookingError(
          'family_relationship_not_authorized',
          403,
          { patientId: canonicalPatientId, relationshipId },
        );
      }

      if (!permissionAllowsAppointmentBooking(relationship.permissions)) {
        throw new MultiCareBookingError(
          'family_relationship_booking_permission_required',
          403,
          { patientId: canonicalPatientId, relationshipId },
        );
      }

      const linkedSubjectAccount =
        Boolean(clean(relationship.subjectUserId)) &&
        Boolean(clean(profile.userId)) &&
        clean(relationship.subjectUserId) === clean(profile.userId);
      const relationshipIdentityVerified =
        identityExplicitlyVerified(relationship.permissions);
      const profileIdentityVerified =
        identityExplicitlyVerified(profile.profileMetadata);

      identityVerified =
        linkedSubjectAccount ||
        relationshipIdentityVerified ||
        profileIdentityVerified;
      identityVerificationSource = linkedSubjectAccount
        ? 'LINKED_SUBJECT_ACCOUNT'
        : relationshipIdentityVerified || profileIdentityVerified
          ? 'VERIFIED_RELATIONSHIP'
          : 'UNVERIFIED_DIRECT_RELATIONSHIP';

      relationshipId = String(relationship.id);
    } else {
      relationshipId = null;
    }

    resolved.push({
      ...item,
      sequence,
      role: normalizeRole(item.role, sequence),
      patientId: canonicalPatientId,
      patientUserId: clean(profile.userId) || null,
      familyRelationshipId: relationshipId,
      displayName: clean(profile.name, 240) || `Patient ${sequence + 1}`,
      photoUrl: clean(profile.photoUrl, 2000) || null,
      gender: clean(profile.gender, 80) || null,
      identityVerified,
      identityVerificationSource,
    });
  }

  return resolved;
}

async function loadActivePolicy(args: {
  clinicianUserId: string;
  feeKind: MultiCareFeeKind;
  visitMode: MultiCareVisitMode;
  at?: Date;
}) {
  const clinicianUserId = clean(args.clinicianUserId);

  if (!clinicianUserId) return null;

  const at = args.at || new Date();
  const row = await (prisma as any).clinicianMultiCarePolicy.findFirst({
    where: {
      clinicianUserId,
      feeKind: args.feeKind,
      visitMode: args.visitMode,
      enabled: true,
      effectiveFrom: { lte: at },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gt: at } },
      ],
    },
    orderBy: [
      { effectiveFrom: 'desc' },
      { version: 'desc' },
    ],
  });

  return row ? serializePolicy(row) : null;
}

function additionalUnit(policy: MultiCarePolicyView, baseAmountMinor: number) {
  if (policy.additionalRecipientAmountMinor != null) {
    return asMinor(policy.additionalRecipientAmountMinor);
  }

  if (policy.additionalRecipientPercentBps != null) {
    return Math.max(
      0,
      Math.round(
        baseAmountMinor *
          Number(policy.additionalRecipientPercentBps) /
          10_000,
      ),
    );
  }

  return 0;
}

export async function resolveMultiCareQuote(args: {
  clinicianUserId: string;
  recipients: AuthorizedCareRecipient[];
  feeKind: MultiCareFeeKind;
  visitMode: MultiCareVisitMode;
  baseAmountMinor: number;
  currency: string;
  baseDurationMin: number;
  at?: Date;
}): Promise<MultiCareQuote> {
  const recipients = args.recipients;
  const recipientCount = recipients.length;

  if (recipientCount === 0) {
    throw new MultiCareBookingError('care_recipients_required', 400);
  }

  const baseAmountMinor = asMinor(args.baseAmountMinor);
  const baseDurationMin = asPositiveInt(args.baseDurationMin, 30);
  const currency = normalizeCurrency(args.currency);

  if (recipientCount === 1) {
    return {
      recipientCount,
      multiCare: false,
      feeKind: args.feeKind,
      visitMode: args.visitMode,
      currency,
      baseAmountMinor,
      totalAmountMinor: baseAmountMinor,
      baseDurationMin,
      additionalDurationMin: 0,
      durationMin: baseDurationMin,
      policy: null,
      allocations: [
        {
          sequence: 0,
          patientId: recipients[0].patientId,
          baseAmountMinor,
          additionalAmountMinor: 0,
          discountMinor: 0,
          grossAmountMinor: baseAmountMinor,
          sponsorAmountMinor: 0,
          patientPayableMinor: baseAmountMinor,
          currency,
        },
      ],
    };
  }

  const policy = await loadActivePolicy({
    clinicianUserId: args.clinicianUserId,
    feeKind: args.feeKind,
    visitMode: args.visitMode,
    at: args.at,
  });

  if (!policy) {
    throw new MultiCareBookingError(
      'multi_care_not_enabled_for_selected_consultation',
      409,
      {
        feeKind: args.feeKind,
        visitMode: args.visitMode,
      },
    );
  }

  if (recipientCount > policy.maxCareRecipients) {
    throw new MultiCareBookingError(
      'multi_care_recipient_limit_exceeded',
      409,
      {
        requested: recipientCount,
        maximum: policy.maxCareRecipients,
      },
    );
  }

  if (
    policy.requireAllRecipientsVerifiedBeforeCheckout &&
    recipients.some((recipient) => !recipient.identityVerified)
  ) {
    throw new MultiCareBookingError(
      'care_recipient_identity_verification_required',
      409,
    );
  }

  const allocations: MultiCareAllocation[] = recipients.map(
    (recipient, sequence) => ({
      sequence,
      patientId: recipient.patientId,
      baseAmountMinor: 0,
      additionalAmountMinor: 0,
      discountMinor: 0,
      grossAmountMinor: 0,
      sponsorAmountMinor: 0,
      patientPayableMinor: 0,
      currency,
    }),
  );

  switch (policy.pricingMode) {
    case 'FULL_FEE_PER_RECIPIENT': {
      allocations.forEach((allocation, sequence) => {
        allocation.baseAmountMinor = sequence === 0 ? baseAmountMinor : 0;
        allocation.additionalAmountMinor =
          sequence === 0 ? 0 : baseAmountMinor;
        allocation.grossAmountMinor = baseAmountMinor;
        allocation.patientPayableMinor = baseAmountMinor;
      });
      break;
    }

    case 'FIXED_PACKAGE': {
      const packageAmountMinor = asMinor(
        policy.packageAmountMinor,
        baseAmountMinor,
      );

      allocations[0].baseAmountMinor = baseAmountMinor;
      allocations[0].additionalAmountMinor = Math.max(
        0,
        packageAmountMinor - baseAmountMinor,
      );
      allocations[0].discountMinor = Math.max(
        0,
        baseAmountMinor - packageAmountMinor,
      );
      allocations[0].grossAmountMinor = packageAmountMinor;
      allocations[0].patientPayableMinor = packageAmountMinor;
      break;
    }

    case 'NO_ADDITIONAL_FEE': {
      allocations[0].baseAmountMinor = baseAmountMinor;
      allocations[0].grossAmountMinor = baseAmountMinor;
      allocations[0].patientPayableMinor = baseAmountMinor;
      break;
    }

    case 'BASE_PLUS_ADDITIONAL':
    default: {
      const included = Math.max(
        1,
        Math.min(
          recipientCount,
          Number(policy.includedCareRecipients || 1),
        ),
      );
      const unit = additionalUnit(policy, baseAmountMinor);

      allocations[0].baseAmountMinor = baseAmountMinor;
      allocations[0].grossAmountMinor = baseAmountMinor;
      allocations[0].patientPayableMinor = baseAmountMinor;

      allocations.forEach((allocation, sequence) => {
        if (sequence < included) return;

        allocation.additionalAmountMinor = unit;
        allocation.grossAmountMinor = unit;
        allocation.patientPayableMinor = unit;
      });
      break;
    }
  }

  const totalAmountMinor = allocations.reduce(
    (sum, allocation) => sum + allocation.grossAmountMinor,
    0,
  );

  const uncappedAdditionalMinutes =
    Math.max(0, recipientCount - 1) *
    Math.max(0, Number(policy.additionalMinutesPerRecipient || 0));

  const additionalDurationMin =
    policy.maxAdditionalMinutes == null
      ? uncappedAdditionalMinutes
      : Math.min(
          uncappedAdditionalMinutes,
          Math.max(0, Number(policy.maxAdditionalMinutes)),
        );

  return {
    recipientCount,
    multiCare: true,
    feeKind: args.feeKind,
    visitMode: args.visitMode,
    currency,
    baseAmountMinor,
    totalAmountMinor,
    baseDurationMin,
    additionalDurationMin,
    durationMin: baseDurationMin + additionalDurationMin,
    policy,
    allocations,
  };
}

export async function findMultiCareConflicts(args: {
  db?: any;
  clinicianId: string;
  hostUserId: string;
  actorPatientId: string;
  recipientPatientIds: string[];
  startsAt: Date;
  endsAt: Date;
}) {
  const db = args.db || prisma;
  const recipientPatientIds = Array.from(
    new Set(args.recipientPatientIds.map((value) => clean(value)).filter(Boolean)),
  );

  const clinicianConflict = await db.appointment.findFirst({
    where: {
      clinicianId: args.clinicianId,
      startsAt: { lt: args.endsAt },
      endsAt: { gt: args.startsAt },
      status: { notIn: ACTIVE_APPOINTMENT_EXCLUSIONS },
    },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
    },
  });

  if (clinicianConflict) {
    return {
      clinicianConflict,
      patientConflict: null,
    };
  }

  const legacyOr: any[] = [];

  if (args.actorPatientId) {
    legacyOr.push(
      { patientId: args.actorPatientId },
      { subjectPatientId: args.actorPatientId },
    );
  }

  if (args.hostUserId) {
    legacyOr.push({ hostUserId: args.hostUserId });
  }

  for (const patientId of recipientPatientIds) {
    legacyOr.push(
      { patientId },
      { subjectPatientId: patientId },
    );
  }

  const legacyPatientConflict = legacyOr.length
    ? await db.appointment.findFirst({
        where: {
          OR: legacyOr,
          startsAt: { lt: args.endsAt },
          endsAt: { gt: args.startsAt },
          status: { notIn: ACTIVE_APPOINTMENT_EXCLUSIONS },
        },
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          clinicianId: true,
          patientId: true,
          subjectPatientId: true,
        },
      })
    : null;

  if (legacyPatientConflict) {
    return {
      clinicianConflict: null,
      patientConflict: legacyPatientConflict,
    };
  }

  const childConflict =
    recipientPatientIds.length > 0 &&
    db.appointmentCareRecipient?.findFirst
      ? await db.appointmentCareRecipient.findFirst({
          where: {
            patientId: { in: recipientPatientIds },
            status: {
              notIn: ['DECLINED', 'REMOVED', 'CANCELLED'],
            },
            appointment: {
              startsAt: { lt: args.endsAt },
              endsAt: { gt: args.startsAt },
              status: { notIn: ACTIVE_APPOINTMENT_EXCLUSIONS },
            },
          },
          select: {
            appointmentId: true,
            patientId: true,
            appointment: {
              select: {
                id: true,
                startsAt: true,
                endsAt: true,
                clinicianId: true,
              },
            },
          },
        })
      : null;

  return {
    clinicianConflict: null,
    patientConflict: childConflict
      ? {
          id: childConflict.appointmentId,
          patientId: childConflict.patientId,
          startsAt: childConflict.appointment?.startsAt,
          endsAt: childConflict.appointment?.endsAt,
          clinicianId: childConflict.appointment?.clinicianId,
        }
      : null,
  };
}

function priceLockSecret() {
  const secret = clean(
    process.env.MULTI_CARE_PRICE_LOCK_SECRET ||
      process.env.AMBULANT_INTERNAL_IDENTITY_SECRET ||
      process.env.INTERNAL_IDENTITY_SECRET ||
      process.env.AUTH_SESSION_SECRET ||
      process.env.NEXTAUTH_SECRET,
    4096,
  );

  if (!secret || secret.length < 24) {
    throw new MultiCareBookingError(
      'multi_care_price_lock_secret_unavailable',
      503,
    );
  }

  return secret;
}

function toBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}

function signPayload(encodedPayload: string) {
  return crypto
    .createHmac('sha256', priceLockSecret())
    .update(encodedPayload)
    .digest('base64url');
}

export function createMultiCarePriceLock(
  input: Omit<
    MultiCarePriceLockPayload,
    'version' | 'issuedAt' | 'expiresAt'
  > & {
    ttlSeconds?: number;
  },
) {
  const now = new Date();
  const ttlSeconds = Math.max(
    60,
    Math.min(30 * 60, Number(input.ttlSeconds || 10 * 60)),
  );
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  const payload: MultiCarePriceLockPayload = {
    version: 1,
    clinicianId: clean(input.clinicianId),
    hostUserId: clean(input.hostUserId),
    actorPatientId: clean(input.actorPatientId),
    startsAt: new Date(input.startsAt).toISOString(),
    requestedEndsAt: new Date(input.requestedEndsAt).toISOString(),
    finalEndsAt: new Date(input.finalEndsAt).toISOString(),
    feeKind: input.feeKind,
    visitMode: input.visitMode,
    recipientIds: input.recipientIds.map((value) => clean(value)),
    totalAmountMinor: asMinor(input.totalAmountMinor),
    currency: normalizeCurrency(input.currency),
    durationMin: asPositiveInt(input.durationMin, 30),
    policyId: clean(input.policyId) || null,
    policyVersion:
      input.policyVersion == null
        ? null
        : Math.max(0, Math.round(Number(input.policyVersion))),
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);

  return {
    token: `mcp1.${encodedPayload}.${signature}`,
    payload,
  };
}

export function verifyMultiCarePriceLock(token: unknown) {
  const raw = clean(token, 16_000);
  const [prefix, encodedPayload, suppliedSignature, ...rest] = raw.split('.');

  if (
    prefix !== 'mcp1' ||
    !encodedPayload ||
    !suppliedSignature ||
    rest.length > 0
  ) {
    throw new MultiCareBookingError('multi_care_price_lock_invalid', 409);
  }

  const expectedSignature = signPayload(encodedPayload);
  const expectedBuffer = Buffer.from(expectedSignature);
  const suppliedBuffer = Buffer.from(suppliedSignature);

  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    throw new MultiCareBookingError('multi_care_price_lock_invalid', 409);
  }

  let payload: MultiCarePriceLockPayload;

  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as MultiCarePriceLockPayload;
  } catch {
    throw new MultiCareBookingError('multi_care_price_lock_invalid', 409);
  }

  if (
    payload.version !== 1 ||
    !payload.expiresAt ||
    new Date(payload.expiresAt).getTime() <= Date.now()
  ) {
    throw new MultiCareBookingError('multi_care_price_lock_expired', 409);
  }

  return payload;
}

function sameOrderedStrings(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function assertMultiCarePriceLock(args: {
  payload: MultiCarePriceLockPayload;
  clinicianId: string;
  hostUserId: string;
  actorPatientId: string;
  startsAt: Date;
  requestedEndsAt: Date;
  finalEndsAt: Date;
  quote: MultiCareQuote;
  recipientIds: string[];
}) {
  const payload = args.payload;
  const expectedPolicyId = args.quote.policy?.id || null;
  const expectedPolicyVersion = args.quote.policy?.version ?? null;

  const valid =
    payload.clinicianId === clean(args.clinicianId) &&
    payload.hostUserId === clean(args.hostUserId) &&
    payload.actorPatientId === clean(args.actorPatientId) &&
    payload.startsAt === args.startsAt.toISOString() &&
    payload.requestedEndsAt === args.requestedEndsAt.toISOString() &&
    payload.finalEndsAt === args.finalEndsAt.toISOString() &&
    payload.feeKind === args.quote.feeKind &&
    payload.visitMode === args.quote.visitMode &&
    sameOrderedStrings(
      payload.recipientIds,
      args.recipientIds.map((value) => clean(value)),
    ) &&
    payload.totalAmountMinor === args.quote.totalAmountMinor &&
    payload.currency === args.quote.currency &&
    payload.durationMin === args.quote.durationMin &&
    payload.policyId === expectedPolicyId &&
    payload.policyVersion === expectedPolicyVersion;

  if (!valid) {
    throw new MultiCareBookingError(
      'multi_care_price_lock_mismatch',
      409,
    );
  }
}
