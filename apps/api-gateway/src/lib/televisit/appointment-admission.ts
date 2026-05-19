import { prisma } from '@/src/lib/db';

export type PersistedAppointmentParticipant = {
  partyId: string;
  role:
    | 'PRIMARY_PATIENT'
    | 'DEPENDANT_PATIENT'
    | 'OBSERVER'
    | 'CARE_ALLY'
    | 'SECOND_PATIENT_PARTICIPANT'
    | 'LEAD_CLINICIAN'
    | 'CO_CLINICIAN'
    | 'ADVISOR';
  patientId?: string | null;
  clinicianId?: string | null;
  relationshipId?: string | null;
  hostUserId?: string | null;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  specialty?: string | null;
  required?: boolean;
  source?: 'implicit' | 'requested';
  access?: {
    canJoinTelevisit?: boolean;
    canViewHealth?: boolean;
    canBookAppointments?: boolean;
  };
};

export type AdmissionRole = 'patient' | 'clinician' | 'staff' | 'observer' | 'admin';

export type ParticipantAdmission = {
  appointmentId: string;
  participant: PersistedAppointmentParticipant;
  rtcRole: AdmissionRole;
  participantRole:
    | 'lead_patient'
    | 'dependent_patient'
    | 'observer'
    | 'care_ally'
    | 'lead_clinician'
    | 'co_clinician'
    | 'advisor'
    | 'second_patient_participant';
};

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function parseParticipants(meta: unknown): PersistedAppointmentParticipant[] {
  const obj = asObj(meta);
  const raw = Array.isArray(obj?.participants) ? obj?.participants : [];
  return raw.filter(Boolean) as PersistedAppointmentParticipant[];
}

function toRtcRole(role: PersistedAppointmentParticipant['role']): AdmissionRole {
  switch (role) {
    case 'OBSERVER':
      return 'observer';
    case 'LEAD_CLINICIAN':
    case 'CO_CLINICIAN':
    case 'ADVISOR':
      return 'clinician';
    default:
      return 'patient';
  }
}

function toParticipantRole(role: PersistedAppointmentParticipant['role']): ParticipantAdmission['participantRole'] {
  switch (role) {
    case 'PRIMARY_PATIENT':
      return 'lead_patient';
    case 'DEPENDANT_PATIENT':
      return 'dependent_patient';
    case 'CARE_ALLY':
      return 'care_ally';
    case 'OBSERVER':
      return 'observer';
    case 'SECOND_PATIENT_PARTICIPANT':
      return 'second_patient_participant';
    case 'LEAD_CLINICIAN':
      return 'lead_clinician';
    case 'CO_CLINICIAN':
      return 'co_clinician';
    case 'ADVISOR':
      return 'advisor';
    default:
      return 'observer';
  }
}

export function buildJoinPath(args: {
  roomId: string;
  visitId?: string | null;
  appointmentId: string;
  participantId: string;
  participantRole: string;
}) {
  const qs = new URLSearchParams();
  qs.set('appointmentId', args.appointmentId);
  qs.set('participantId', args.participantId);
  qs.set('participantRole', args.participantRole);
  if (args.visitId) qs.set('visitId', args.visitId);
  return `/televisit/${encodeURIComponent(args.roomId)}?${qs.toString()}`;
}

export async function getAppointmentParticipantsForAdmission(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      clinicianId: true,
      patientId: true,
      subjectPatientId: true,
      roomId: true,
      meta: true,
    },
  });

  if (!appointment) {
    throw new Error('appointment_not_found');
  }

  const participants = parseParticipants(appointment.meta);
  return { appointment, participants };
}

export async function resolveParticipantAdmission(args: {
  appointmentId: string;
  participantId?: string | null;
  role?: string | null;
}) {
  const { appointment, participants } = await getAppointmentParticipantsForAdmission(args.appointmentId);

  const participantId = String(args.participantId || '').trim();
  if (!participantId) {
    throw new Error('participant_id_required');
  }

  const participant = participants.find((p) => p.partyId === participantId);
  if (!participant) {
    throw new Error('participant_not_authorized');
  }

  if (participant.access?.canJoinTelevisit === false) {
    throw new Error('participant_join_not_allowed');
  }

  const rtcRole = toRtcRole(participant.role);
  const participantRole = toParticipantRole(participant.role);

  const requestedRole = String(args.role || '').trim();
  if (requestedRole && requestedRole !== rtcRole) {
    throw new Error('participant_role_mismatch');
  }

  return {
    appointmentId: appointment.id,
    participant,
    rtcRole,
    participantRole,
  } satisfies ParticipantAdmission;
}