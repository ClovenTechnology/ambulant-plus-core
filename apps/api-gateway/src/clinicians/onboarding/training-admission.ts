import crypto from 'node:crypto';
import {
  SignJWT,
  jwtVerify,
} from 'jose';
import { prisma } from '@/src/lib/prisma';

export type TrainingParticipantRole =
  | 'clinician'
  | 'trainer'
  | 'observer'
  | 'admin';

export type IssuedTrainingAdmission = {
  admissionId: string;
  assignmentId: string;
  token: string;
  roomId: string;
  trainingSlotId: string;
  sessionKey: string;
  role: TrainingParticipantRole;
  uid: string;
  displayName: string;
  notBeforeAt: Date;
  expiresAt: Date;
  joinOpensAt: Date;
  joinClosesAt: Date;
};

export type VerifiedTrainingAdmission = {
  admissionId: string;
  assignmentId: string | null;
  trainingSlotId: string;
  sessionKey: string;
  roomId: string;
  subjectId: string;
  role: TrainingParticipantRole;
  uid: string;
  displayName: string;
  orgId: string | null;
  permissions: unknown;
  expiresAt: Date;
};

type IssueTrainingAdmissionInput = {
  assignmentId: string;
  expectedPrincipalKey: string;
  subjectId: string;
  uid: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  issuedByUserId?: string | null;
};

type ErrorDetails = {
  joinOpensAt?: string;
  joinClosesAt?: string;
};

export class TrainingAdmissionError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: ErrorDetails;

  constructor(
    code: string,
    status: number,
    details?: ErrorDetails,
  ) {
    super(code);
    this.name = 'TrainingAdmissionError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const TOKEN_TTL_SECONDS = 10 * 60;
const DEFAULT_OPEN_MINUTES = 30;
const DEFAULT_CLOSE_MINUTES = 180;
const CLOCK_SKEW_SECONDS = 30;
const ISSUER = 'ambulant-api-gateway';
const AUDIENCE = 'ambulant-training-room';

function cleanText(
  value: unknown,
  max = 400,
) {
  const text = String(value ?? '').trim();

  if (!text) {
    return null;
  }

  return text.length > max
    ? text.slice(0, max)
    : text;
}

function positiveInteger(
  value: unknown,
  fallback: number,
  maximum: number,
) {
  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.round(parsed),
  );
}

function admissionBaseSecret() {
  const secret =
    process.env.TRAINING_ADMISSION_JWT_SECRET ||
    process.env.TELEVISIT_JOIN_JWT_SECRET ||
    process.env.RTC_JOIN_JWT_SECRET ||
    process.env.JOIN_TICKET_JWT_SECRET ||
    '';

  if (!secret) {
    throw new TrainingAdmissionError(
      'training_admission_secret_missing',
      503,
    );
  }

  return secret;
}

function signingKey() {
  return crypto
    .createHmac(
      'sha256',
      admissionBaseSecret(),
    )
    .update(
      'ambulant-training-admission:v1',
    )
    .digest();
}

function configuredIssuer() {
  return (
    cleanText(
      process.env.TRAINING_ADMISSION_JWT_ISSUER,
      240,
    ) ||
    ISSUER
  );
}

function configuredAudience() {
  return (
    cleanText(
      process.env.TRAINING_ADMISSION_JWT_AUDIENCE,
      240,
    ) ||
    AUDIENCE
  );
}

function tokenHash(token: string) {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

function requestIpHash(
  ipAddress?: string | null,
) {
  const address =
    cleanText(ipAddress, 512);

  if (!address) {
    return null;
  }

  return crypto
    .createHmac(
      'sha256',
      signingKey(),
    )
    .update(address)
    .digest('hex');
}

function isParticipantRole(
  value: unknown,
): value is TrainingParticipantRole {
  return (
    value === 'clinician' ||
    value === 'trainer' ||
    value === 'observer' ||
    value === 'admin'
  );
}

function roomIdForTrainingSlot(
  trainingSlotId: string,
) {
  return `training-slot-${trainingSlotId}`;
}

function joinWindow(slot: {
  startsAt: Date;
  endsAt: Date;
}) {
  const openMinutes =
    positiveInteger(
      process.env.TRAINING_JOIN_OPEN_MINUTES,
      DEFAULT_OPEN_MINUTES,
      7 * 24 * 60,
    );

  const closeMinutes =
    positiveInteger(
      process.env.TRAINING_JOIN_CLOSE_MINUTES,
      DEFAULT_CLOSE_MINUTES,
      7 * 24 * 60,
    );

  return {
    opensAt: new Date(
      slot.startsAt.getTime() -
        openMinutes * 60 * 1000,
    ),
    closesAt: new Date(
      slot.endsAt.getTime() +
        closeMinutes * 60 * 1000,
    ),
  };
}

function requireJoinWindow(
  slot: {
    startsAt: Date;
    endsAt: Date;
  },
  now: Date,
) {
  const window = joinWindow(slot);

  const details = {
    joinOpensAt:
      window.opensAt.toISOString(),
    joinClosesAt:
      window.closesAt.toISOString(),
  };

  if (now < window.opensAt) {
    throw new TrainingAdmissionError(
      'training_room_not_open',
      403,
      details,
    );
  }

  if (now > window.closesAt) {
    throw new TrainingAdmissionError(
      'training_room_closed',
      403,
      details,
    );
  }

  return window;
}

function safeUserAgent(
  value?: string | null,
) {
  return cleanText(value, 1000);
}

export function trainingPrincipalKey(
  principalType:
    | 'clinician'
    | 'org_user',
  principalId: string,
) {
  const id =
    cleanText(principalId, 320);

  if (!id) {
    throw new TrainingAdmissionError(
      'training_principal_required',
      400,
    );
  }

  return `${principalType}:${id}`;
}

export function externalTrainingPrincipalKey(
  email: string,
) {
  const normalised =
    cleanText(email, 320)
      ?.toLowerCase();

  if (!normalised) {
    throw new TrainingAdmissionError(
      'external_participant_email_required',
      400,
    );
  }

  const digest = crypto
    .createHash('sha256')
    .update(normalised)
    .digest('hex');

  return `external_guest:${digest}`;
}

export function ipAddressFromRequest(
  request: Request,
) {
  const forwarded =
    request.headers
      .get('x-forwarded-for')
      ?.split(',')[0]
      ?.trim();

  return (
    forwarded ||
    request.headers.get('x-real-ip') ||
    null
  );
}

export async function issueTrainingAdmission(
  input: IssueTrainingAdmissionInput,
): Promise<IssuedTrainingAdmission> {
  const db: any = prisma;

  const assignmentId =
    cleanText(input.assignmentId, 240);

  const expectedPrincipalKey =
    cleanText(
      input.expectedPrincipalKey,
      400,
    );

  const subjectId =
    cleanText(input.subjectId, 240);

  const uid =
    cleanText(input.uid, 240);

  if (
    !assignmentId ||
    !expectedPrincipalKey ||
    !subjectId ||
    !uid
  ) {
    throw new TrainingAdmissionError(
      'invalid_training_admission_request',
      400,
    );
  }

  const assignment =
    await db
      .clinicianTrainingParticipantAssignment
      .findUnique({
        where: {
          id: assignmentId,
        },
        include: {
          trainingSlot: true,
        },
      });

  if (!assignment) {
    throw new TrainingAdmissionError(
      'training_assignment_not_found',
      404,
    );
  }

  if (
    String(assignment.principalKey) !==
    expectedPrincipalKey
  ) {
    throw new TrainingAdmissionError(
      'training_assignment_identity_mismatch',
      403,
    );
  }

  if (
    !isParticipantRole(
      assignment.role,
    )
  ) {
    throw new TrainingAdmissionError(
      'invalid_training_assignment_role',
      403,
    );
  }

  if (
    assignment.status !== 'assigned' &&
    assignment.status !== 'accepted'
  ) {
    throw new TrainingAdmissionError(
      'training_assignment_inactive',
      403,
    );
  }

  const now = new Date();

  if (
    assignment.expiresAt &&
    new Date(assignment.expiresAt) <= now
  ) {
    throw new TrainingAdmissionError(
      'training_assignment_expired',
      403,
    );
  }

  const slot =
    assignment.trainingSlot;

  if (!slot) {
    throw new TrainingAdmissionError(
      'training_slot_not_found',
      404,
    );
  }

  if (
    String(slot.status)
      .toLowerCase() === 'cancelled' ||
    slot.cancelledAt
  ) {
    throw new TrainingAdmissionError(
      'training_slot_cancelled',
      409,
    );
  }

  const window =
    requireJoinWindow(
      {
        startsAt:
          new Date(slot.startsAt),
        endsAt:
          new Date(slot.endsAt),
      },
      now,
    );

  const admissionId =
    crypto.randomUUID();

  const jti =
    crypto.randomUUID();

  const issuedAtSeconds =
    Math.floor(
      now.getTime() / 1000,
    );

  const notBeforeAt =
    new Date(
      now.getTime() -
        CLOCK_SKEW_SECONDS * 1000,
    );

  const ttlExpiresAt =
    new Date(
      now.getTime() +
        TOKEN_TTL_SECONDS * 1000,
    );

  const expiresAt =
    ttlExpiresAt < window.closesAt
      ? ttlExpiresAt
      : window.closesAt;

  if (expiresAt <= now) {
    throw new TrainingAdmissionError(
      'training_room_closed',
      403,
      {
        joinOpensAt:
          window.opensAt.toISOString(),
        joinClosesAt:
          window.closesAt.toISOString(),
      },
    );
  }

  const trainingSlotId =
    String(assignment.trainingSlotId);

  const sessionKey =
    String(
      assignment.sessionKey ||
      'slot',
    );

  const roomId =
    roomIdForTrainingSlot(
      trainingSlotId,
    );

  const displayName =
    cleanText(
      assignment.name,
      240,
    ) ||
    'Training participant';

  const role =
    assignment.role as
      TrainingParticipantRole;

  const orgId =
    cleanText(
      assignment.scopeSnapshot?.orgId ||
      assignment.metadata?.orgId,
      240,
    );

  const jwt =
    await new SignJWT({
      kind: 'training_admission',
      admissionId,
      assignmentId:
        String(assignment.id),
      trainingSlotId,
      sessionKey,
      roomId,
      participantRole: role,
      uid,
      displayName,
      orgId,
      permissions:
        assignment.permissions ??
        [],
    })
      .setProtectedHeader({
        alg: 'HS256',
        typ: 'JWT',
      })
      .setIssuer(
        configuredIssuer(),
      )
      .setAudience(
        configuredAudience(),
      )
      .setSubject(subjectId)
      .setJti(jti)
      .setIssuedAt(
        issuedAtSeconds,
      )
      .setNotBefore(
        Math.floor(
          notBeforeAt.getTime() /
            1000,
        ),
      )
      .setExpirationTime(
        Math.floor(
          expiresAt.getTime() /
            1000,
        ),
      )
      .sign(signingKey());

  await db
    .clinicianTrainingAdmission
    .create({
      data: {
        id: admissionId,
        assignmentId:
          String(assignment.id),
        trainingSlotId,
        sessionKey,
        subjectId,
        role,
        uid,
        displayName,
        orgId,
        permissions:
          assignment.permissions ??
          [],
        jti,
        tokenHash:
          tokenHash(jwt),
        issuedAt: now,
        notBeforeAt,
        expiresAt,
        issuedByUserId:
          cleanText(
            input.issuedByUserId,
            240,
          ),
        userAgent:
          safeUserAgent(
            input.userAgent,
          ),
        ipHash:
          requestIpHash(
            input.ipAddress,
          ),
        metadata: {
          roomId,
          joinOpensAt:
            window.opensAt
              .toISOString(),
          joinClosesAt:
            window.closesAt
              .toISOString(),
        },
      },
    });

  return {
    admissionId,
    assignmentId:
      String(assignment.id),
    token: jwt,
    roomId,
    trainingSlotId,
    sessionKey,
    role,
    uid,
    displayName,
    notBeforeAt,
    expiresAt,
    joinOpensAt:
      window.opensAt,
    joinClosesAt:
      window.closesAt,
  };
}

export async function verifyTrainingAdmissionToken(
  tokenValue: string,
  expectedRoomId?: string | null,
): Promise<VerifiedTrainingAdmission> {
  const token =
    cleanText(
      tokenValue,
      12000,
    );

  if (!token) {
    throw new TrainingAdmissionError(
      'training_admission_required',
      401,
    );
  }

  let payload: any;

  try {
    const verified =
      await jwtVerify(
        token,
        signingKey(),
        {
          issuer:
            configuredIssuer(),
          audience:
            configuredAudience(),
          algorithms: ['HS256'],
          clockTolerance:
            CLOCK_SKEW_SECONDS,
        },
      );

    payload =
      verified.payload;
  }
  catch {
    throw new TrainingAdmissionError(
      'invalid_training_admission',
      401,
    );
  }

  if (
    payload.kind !==
      'training_admission' ||
    !payload.jti ||
    !payload.admissionId ||
    !payload.trainingSlotId ||
    !payload.roomId ||
    !payload.sub ||
    !payload.uid ||
    !isParticipantRole(
      payload.participantRole,
    )
  ) {
    throw new TrainingAdmissionError(
      'invalid_training_admission',
      401,
    );
  }

  const requestedRoomId =
    cleanText(
      expectedRoomId,
      400,
    );

  if (
    requestedRoomId &&
    requestedRoomId !==
      String(payload.roomId)
  ) {
    throw new TrainingAdmissionError(
      'training_room_mismatch',
      403,
    );
  }

  const db: any = prisma;

  const admission =
    await db
      .clinicianTrainingAdmission
      .findUnique({
        where: {
          id:
            String(
              payload.admissionId,
            ),
        },
        include: {
          assignment: true,
          trainingSlot: true,
        },
      });

  if (
    !admission ||
    admission.revokedAt ||
    admission.expiresAt <=
      new Date() ||
    String(admission.jti) !==
      String(payload.jti) ||
    String(admission.tokenHash) !==
      tokenHash(token)
  ) {
    throw new TrainingAdmissionError(
      'invalid_training_admission',
      401,
    );
  }

  if (
    String(
      admission.trainingSlotId,
    ) !==
      String(
        payload.trainingSlotId,
      ) ||
    String(admission.role) !==
      String(
        payload.participantRole,
      ) ||
    String(admission.uid) !==
      String(payload.uid)
  ) {
    throw new TrainingAdmissionError(
      'training_admission_claim_mismatch',
      401,
    );
  }

  if (
    admission.assignment &&
    (
      admission.assignment.status ===
        'revoked' ||
      admission.assignment.status ===
        'expired'
    )
  ) {
    throw new TrainingAdmissionError(
      'training_assignment_inactive',
      403,
    );
  }

  if (
    String(
      admission.trainingSlot?.status ||
      '',
    ).toLowerCase() ===
      'cancelled' ||
    admission.trainingSlot
      ?.cancelledAt
  ) {
    throw new TrainingAdmissionError(
      'training_slot_cancelled',
      409,
    );
  }

  await db
    .clinicianTrainingAdmission
    .update({
      where: {
        id:
          String(admission.id),
      },
      data: {
        lastUsedAt:
          new Date(),
      },
    });

  return {
    admissionId:
      String(admission.id),
    assignmentId:
      admission.assignmentId
        ? String(
            admission.assignmentId,
          )
        : null,
    trainingSlotId:
      String(
        admission.trainingSlotId,
      ),
    sessionKey:
      String(
        admission.sessionKey ||
        'slot',
      ),
    roomId:
      String(payload.roomId),
    subjectId:
      String(
        admission.subjectId,
      ),
    role:
      admission.role as
        TrainingParticipantRole,
    uid:
      String(admission.uid),
    displayName:
      String(
        admission.displayName,
      ),
    orgId:
      admission.orgId
        ? String(admission.orgId)
        : null,
    permissions:
      admission.permissions,
    expiresAt:
      new Date(
        admission.expiresAt,
      ),
  };
}
