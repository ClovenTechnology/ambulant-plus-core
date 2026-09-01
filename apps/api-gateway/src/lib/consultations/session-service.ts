import { ConsultationActorType, ConsultationSessionState, Prisma } from '@prisma/client';
import { prisma } from '@/src/lib/db';
import { emitEvent } from '@/src/lib/events';
import { evaluateSessionPolicy } from '@/src/lib/consultations/session-policy';

type IdentityLike = {
  role: string | null;
  uid: string | null;
  orgId?: string | null;
};

function mapRoleToActor(role: string | null | undefined): ConsultationActorType {
  switch ((role || '').toLowerCase()) {
    case 'patient':
      return 'PATIENT';
    case 'clinician':
      return 'CLINICIAN';
    case 'admin':
    case 'admin_staff':
      return 'ADMIN';
    default:
      return 'SYSTEM';
  }
}

function canStartFromState(state: ConsultationSessionState): boolean {
  return state === 'CREATED' || state === 'READY' || state === 'CHECKED_IN' || state === 'INTERRUPTED';
}

function canCompleteFromState(state: ConsultationSessionState): boolean {
  return state === 'ACTIVE' || state === 'INTERRUPTED';
}

function toMetaObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toInputJsonObject(value: unknown): Prisma.InputJsonObject {
  const normalized = JSON.parse(JSON.stringify(value ?? {}));
  return normalized && typeof normalized === 'object' && !Array.isArray(normalized)
    ? (normalized as Prisma.InputJsonObject)
    : {};
}

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function emitSessionEvent(input: {
  kind: string;
  session: {
    id: string;
    appointmentId: string;
    encounterId?: string | null;
    patientId: string;
    clinicianId: string;
    caseId: string;
    state?: string | null;
    outcome?: string | null;
  };
  payload?: Record<string, unknown>;
}) {
  emitEvent({
    kind: input.kind,
    encounterId: input.session.encounterId ?? null,
    patientId: input.session.patientId,
    clinicianId: input.session.clinicianId,
    targetPatientId: input.session.patientId,
    targetClinicianId: input.session.clinicianId,
    payload: {
      sessionId: input.session.id,
      appointmentId: input.session.appointmentId,
      caseId: input.session.caseId,
      state: input.session.state ?? null,
      outcome: input.session.outcome ?? null,
      ...(input.payload || {}),
    },
  });
}

export async function ensureSessionByAppointment(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appointment) {
    throw new Error(`Appointment not found: ${appointmentId}`);
  }

  const existing = await prisma.consultationSession.findUnique({
    where: { appointmentId },
  });

  if (existing) {
    if (!appointment.sessionId || appointment.sessionId !== existing.id) {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { sessionId: existing.id },
      });
    }
    return existing;
  }

  const created = await prisma.consultationSession.create({
    data: {
      appointmentId: appointment.id,
      encounterId: appointment.encounterId ?? null,
      caseId: appointment.caseId,
      clinicianId: appointment.clinicianId,
      patientId: appointment.patientId,
      hostUserId: appointment.hostUserId ?? null,
      visitMode: appointment.visitMode,
      roomId: appointment.roomId ?? null,
      state: 'READY',
      currency: appointment.currency || 'USD',
      amountAuthorizedMinor:
        typeof appointment.totalMinor === 'number'
          ? appointment.totalMinor
          : typeof appointment.amountMinor === 'number'
            ? appointment.amountMinor
            : typeof appointment.priceCents === 'number'
              ? appointment.priceCents
              : null,
      metadata: toInputJsonObject({
        ensuredAt: new Date().toISOString(),
      }),
    },
  });

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      sessionId: created.id,
    },
  });

  emitSessionEvent({
    kind: 'consultation.session.ensured',
    session: created,
  });

  return created;
}

export async function getSessionByAppointment(appointmentId: string) {
  const existing = await prisma.consultationSession.findUnique({
    where: { appointmentId },
  });
  if (existing) return existing;
  return ensureSessionByAppointment(appointmentId);
}

export async function checkInSession(params: {
  sessionId: string;
  actor: ConsultationActorType;
}) {
  const session = await prisma.consultationSession.findUnique({
    where: { id: params.sessionId },
  });
  if (!session) throw new Error('Session not found');

  if (
    session.state === 'COMPLETED' ||
    session.state === 'CANCELLED' ||
    session.state === 'NO_SHOW' ||
    session.state === 'ABORTED'
  ) {
    return session;
  }

  const update: {
    state?: ConsultationSessionState;
    patientCheckedInAt?: Date;
    clinicianCheckedInAt?: Date;
    metadata?: Prisma.InputJsonObject;
  } = {
    metadata: toInputJsonObject({
      ...toMetaObject(session.metadata),
      lastCheckInAt: new Date().toISOString(),
      lastCheckInActor: params.actor,
    }),
  };

  if (params.actor === 'PATIENT' && !session.patientCheckedInAt) {
    update.patientCheckedInAt = new Date();
  }
  if (params.actor === 'CLINICIAN' && !session.clinicianCheckedInAt) {
    update.clinicianCheckedInAt = new Date();
  }

  if (session.state === 'CREATED' || session.state === 'READY') {
    update.state = 'CHECKED_IN';
  }

  const updated = await prisma.consultationSession.update({
    where: { id: session.id },
    data: update,
  });

  await prisma.appointment.update({
    where: { id: session.appointmentId },
    data: {
      checkedInAt: new Date(),
    },
  });

  emitSessionEvent({
    kind: 'consultation.session.checked_in',
    session: updated,
    payload: { actor: params.actor },
  });

  return updated;
}

export async function startSession(params: {
  sessionId: string;
  identity: IdentityLike;
  mediaConnected?: boolean;
  roomId?: string | null;
}) {
  const session = await prisma.consultationSession.findUnique({
    where: { id: params.sessionId },
  });
  if (!session) throw new Error('Session not found');

  if (session.state === 'ACTIVE') return session;
  if (!canStartFromState(session.state)) return session;

  const actor = mapRoleToActor(params.identity.role);
  if (!(actor === 'CLINICIAN' || actor === 'ADMIN')) {
    throw new Error('Only clinician/admin can start consultation session');
  }

  const mediaRequired = session.visitMode === 'TELEVISIT';
  if (mediaRequired && !params.mediaConnected) {
    throw new Error('TELEVISIT session requires media readiness before start');
  }

  const startedAt = session.startedAt ?? new Date();

  const updated = await prisma.consultationSession.update({
    where: { id: session.id },
    data: {
      state: 'ACTIVE',
      startedAt,
      roomId: params.roomId ?? session.roomId,
      metadata: toInputJsonObject({
        ...toMetaObject(session.metadata),
        startedByUserId: params.identity.uid ?? null,
        mediaConnected: Boolean(params.mediaConnected),
        lastStartAt: startedAt.toISOString(),
      }),
    },
  });

  await prisma.appointment.update({
    where: { id: session.appointmentId },
    data: {
      startedAt,
      status: 'in_progress',
    },
  });

  if (session.encounterId) {
    await prisma.encounter.update({
      where: { id: session.encounterId },
      data: {
        sessionId: session.id,
        visitMode: session.visitMode,
        consultationStartedAt: startedAt,
        status: 'active',
      },
    });
  }

  emitSessionEvent({
    kind: 'consultation.session.started',
    session: updated,
    payload: {
      startedByUserId: params.identity.uid ?? null,
      mediaConnected: Boolean(params.mediaConnected),
      roomId: updated.roomId ?? null,
    },
  });

  return updated;
}

export async function completeSession(params: {
  sessionId: string;
  identity: IdentityLike;
  encounterStatus?: 'completed' | 'referred' | 'cancelled' | 'closed';
  encounterReachedClinicalThreshold?: boolean;
  summaryPayload?: Record<string, unknown> | null;
}) {
  const session = await prisma.consultationSession.findUnique({
    where: { id: params.sessionId },
  });
  if (!session) throw new Error('Session not found');

  if (session.state === 'COMPLETED') return session;
  if (!canCompleteFromState(session.state)) return session;

  const actor = mapRoleToActor(params.identity.role);
  if (!(actor === 'CLINICIAN' || actor === 'ADMIN')) {
    throw new Error('Only clinician/admin can complete consultation session');
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: session.appointmentId },
  });
  if (!appointment) throw new Error('Appointment not found');

  const appointmentMeta = toMetaObject(appointment.meta);
  const bookingSource = String(appointment.bookingSource || '').toLowerCase();
  const billingMode = String(appointmentMeta.billingMode || '').toLowerCase();
  const metadataSource = String(appointmentMeta.source || '').toLowerCase();
  const roomId = String(appointment.roomId || session.roomId || '');
  const isSimulation =
    bookingSource === 'admin_simulation' ||
    appointmentMeta.simulation === true ||
    billingMode === 'simulation' ||
    metadataSource === 'admin.simulation' ||
    roomId.startsWith('simulation-');

  const decision = isSimulation
    ? {
        outcome: 'COMPLETED' as const,
        refundType: 'NONE' as const,
        refundTarget: 'NONE' as const,
        payoutState: 'ZERO' as const,
        claimState: 'SUPPRESS' as const,
        reasonCode: 'SIMULATION_COMPLETED',
        policyVersion: 'session-policy-v1-simulation',
      }
    : evaluateSessionPolicy({
        visitMode: session.visitMode,
        startsAt: session.startedAt ?? new Date(),
        sessionStarted: Boolean(session.startedAt),
        encounterReachedClinicalThreshold: params.encounterReachedClinicalThreshold ?? true,
        referred: params.encounterStatus === 'referred',
      });

  const endedAt = session.endedAt ?? new Date();

  const updated = await prisma.consultationSession.update({
    where: { id: session.id },
    data: {
      state: 'COMPLETED',
      endedAt,
      outcome: decision.outcome,
      refundType: decision.refundType,
      refundTarget: decision.refundTarget,
      payoutState: decision.payoutState,
      claimState: decision.claimState,
      reasonCode: decision.reasonCode,
      policyVersion: decision.policyVersion,
      metadata: toInputJsonObject({
        ...toMetaObject(session.metadata),
        completedByUserId: params.identity.uid ?? null,
        completedAt: endedAt.toISOString(),
        ...(isSimulation
          ? {
              simulation: true,
              billingMode: 'simulation',
              source: appointmentMeta.source || 'admin.simulation',
              nonBillable: true,
            }
          : {}),
      }),
    },
  });

  await prisma.appointment.update({
    where: { id: session.appointmentId },
    data: {
      completedAt: endedAt,
      status: params.encounterStatus === 'referred' ? 'referred' : 'completed',
    },
  });

  if (session.encounterId) {
    const encounter = await prisma.encounter.findUnique({
      where: { id: session.encounterId },
      select: { summaryPayload: true },
    });
    const existingSummary = toMetaObject(encounter?.summaryPayload);
    const incomingSummary = toMetaObject(params.summaryPayload);
    const mergedSummary = {
      ...existingSummary,
      ...incomingSummary,
      ...(isSimulation
        ? {
            simulation: true,
            billingMode: 'simulation',
            source: existingSummary.source || appointmentMeta.source || 'admin.simulation',
            sessionNumber: existingSummary.sessionNumber ?? appointmentMeta.sessionNumber ?? null,
            nonBillable: true,
          }
        : {}),
    };

    await prisma.encounter.update({
      where: { id: session.encounterId },
      data: {
        status: params.encounterStatus ?? 'completed',
        consultationEndedAt: endedAt,
        settlementSnapshot: toInputJsonObject({
          outcome: decision.outcome,
          refundType: decision.refundType,
          refundTarget: decision.refundTarget,
          payoutState: decision.payoutState,
          claimState: decision.claimState,
          reasonCode: decision.reasonCode,
          policyVersion: decision.policyVersion,
          ...(isSimulation
            ? {
                simulation: true,
                billingMode: 'simulation',
                nonBillable: true,
                coverageDecision: 'simulation_not_billable',
              }
            : {}),
        }),
        ...(params.summaryPayload || isSimulation
          ? { summaryPayload: toInputJsonValue(isSimulation ? mergedSummary : params.summaryPayload) }
          : {}),
      },
    });
  }

  emitSessionEvent({
    kind: 'consultation.session.completed',
    session: updated,
    payload: {
      completedByUserId: params.identity.uid ?? null,
      encounterStatus: params.encounterStatus ?? 'completed',
    },
  });

  return updated;
}

export async function cancelSession(params: {
  sessionId: string;
  identity: IdentityLike;
  reason?: string | null;
}) {
  const session = await prisma.consultationSession.findUnique({
    where: { id: params.sessionId },
  });
  if (!session) throw new Error('Session not found');

  if (session.state === 'CANCELLED') return session;

  const actor = mapRoleToActor(params.identity.role);
  if (!(actor === 'PATIENT' || actor === 'CLINICIAN' || actor === 'ADMIN')) {
    throw new Error('Only patient/clinician/admin can cancel consultation session');
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: session.appointmentId },
  });
  if (!appointment) throw new Error('Appointment not found');

  const cancelledAt = new Date();

  const decision = evaluateSessionPolicy({
    visitMode: session.visitMode,
    startsAt: appointment.startsAt,
    cancelledAt,
    cancelledBy: actor,
    sessionStarted: Boolean(session.startedAt),
    encounterReachedClinicalThreshold: false,
    referred: false,
  });

  const updated = await prisma.consultationSession.update({
    where: { id: session.id },
    data: {
      state: 'CANCELLED',
      cancelledAt,
      cancelledBy: actor,
      cancelReason: params.reason ?? null,
      outcome: decision.outcome,
      refundType: decision.refundType,
      refundTarget: decision.refundTarget,
      payoutState: decision.payoutState,
      claimState: decision.claimState,
      reasonCode: decision.reasonCode,
      policyVersion: decision.policyVersion,
    },
  });

  await prisma.appointment.update({
    where: { id: session.appointmentId },
    data: {
      cancelledAt,
      cancelledByUserId: params.identity.uid ?? null,
      cancelReason: params.reason ?? null,
      status: 'cancelled',
    },
  });

  if (session.encounterId) {
    await prisma.encounter.update({
      where: { id: session.encounterId },
      data: {
        status: 'cancelled',
        consultationEndedAt: cancelledAt,
        settlementSnapshot: toInputJsonObject({
          outcome: decision.outcome,
          refundType: decision.refundType,
          refundTarget: decision.refundTarget,
          payoutState: decision.payoutState,
          claimState: decision.claimState,
          reasonCode: decision.reasonCode,
          policyVersion: decision.policyVersion,
        }),
      },
    });
  }

  emitSessionEvent({
    kind: 'consultation.session.cancelled',
    session: updated,
    payload: {
      cancelledByUserId: params.identity.uid ?? null,
      actor,
      reason: params.reason ?? null,
    },
  });

  return updated;
}

export async function markNoShow(params: {
  sessionId: string;
  identity: IdentityLike;
  noShowActor: ConsultationActorType;
}) {
  const session = await prisma.consultationSession.findUnique({
    where: { id: params.sessionId },
  });
  if (!session) throw new Error('Session not found');

  if (session.state === 'NO_SHOW') return session;

  const actor = mapRoleToActor(params.identity.role);
  if (!(actor === 'CLINICIAN' || actor === 'ADMIN')) {
    throw new Error('Only clinician/admin can mark no-show');
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: session.appointmentId },
  });
  if (!appointment) throw new Error('Appointment not found');

  const markedAt = new Date();

  const decision = evaluateSessionPolicy({
    visitMode: session.visitMode,
    startsAt: appointment.startsAt,
    noShowActor: params.noShowActor,
    sessionStarted: Boolean(session.startedAt),
    encounterReachedClinicalThreshold: false,
    referred: false,
  });

  const updated = await prisma.consultationSession.update({
    where: { id: session.id },
    data: {
      state: 'NO_SHOW',
      noShowMarkedAt: markedAt,
      noShowActor: params.noShowActor,
      outcome: decision.outcome,
      refundType: decision.refundType,
      refundTarget: decision.refundTarget,
      payoutState: decision.payoutState,
      claimState: decision.claimState,
      reasonCode: decision.reasonCode,
      policyVersion: decision.policyVersion,
    },
  });

  await prisma.appointment.update({
    where: { id: session.appointmentId },
    data: {
      status: 'no_show',
    },
  });

  if (session.encounterId) {
    await prisma.encounter.update({
      where: { id: session.encounterId },
      data: {
        status: 'cancelled',
        consultationEndedAt: markedAt,
        settlementSnapshot: toInputJsonObject({
          outcome: decision.outcome,
          refundType: decision.refundType,
          refundTarget: decision.refundTarget,
          payoutState: decision.payoutState,
          claimState: decision.claimState,
          reasonCode: decision.reasonCode,
          policyVersion: decision.policyVersion,
        }),
      },
    });
  }

  emitSessionEvent({
    kind: 'consultation.session.no_show',
    session: updated,
    payload: {
      markedByUserId: params.identity.uid ?? null,
      noShowActor: params.noShowActor,
    },
  });

  return updated;
}