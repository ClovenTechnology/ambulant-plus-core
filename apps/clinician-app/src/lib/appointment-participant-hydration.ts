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

export type ParticipantJoinLink = {
  participantId: string;
  participantRole: string;
  required: boolean;
  joinPath: string;
  televisitJoinPath?: string;
};

export type AppointmentParticipantHydration = {
  appointment: Record<string, unknown> | null;
  participants: PersistedAppointmentParticipant[];
  participantJoinLinks: ParticipantJoinLink[];
};

export async function loadAppointmentParticipantHydration(args: {
  appointmentId?: string | null;
}): Promise<AppointmentParticipantHydration> {
  if (!args.appointmentId) {
    return { appointment: null, participants: [], participantJoinLinks: [] };
  }

  const res = await fetch(`/api/appointments/${encodeURIComponent(args.appointmentId)}`, {
    cache: 'no-store',
  });

  const js = await res.json().catch(() => ({} as any));
  if (!res.ok || js.ok === false) {
    return { appointment: null, participants: [], participantJoinLinks: [] };
  }

  return {
    appointment:
      js.appointment && typeof js.appointment === 'object' ? js.appointment : null,
    participants: Array.isArray(js.participants) ? js.participants : [],
    participantJoinLinks: Array.isArray(js.participantJoinLinks)
      ? js.participantJoinLinks
      : [],
  };
}

export type HydratedRoomParty = {
  partyId: string;
  role:
    | 'lead_patient'
    | 'dependent_patient'
    | 'observer'
    | 'care_ally'
    | 'second_patient_participant'
    | 'lead_clinician'
    | 'co_clinician'
    | 'advisor';
  displayName: string;
  required: boolean;
  patientId?: string | null;
  clinicianId?: string | null;
  specialty?: string | null;
  state: 'invited' | 'accepted' | 'declined' | 'joined';
  joinPath?: string | null;
};

function toRoomRole(
  role: PersistedAppointmentParticipant['role'],
): HydratedRoomParty['role'] {
  switch (role) {
    case 'PRIMARY_PATIENT':
      return 'lead_patient';
    case 'DEPENDANT_PATIENT':
      return 'dependent_patient';
    case 'OBSERVER':
      return 'observer';
    case 'CARE_ALLY':
      return 'care_ally';
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

function fallbackDisplayName(p: PersistedAppointmentParticipant) {
  return (
    p.name ||
    p.specialty ||
    p.email ||
    p.phone ||
    p.patientId ||
    p.clinicianId ||
    p.partyId
  );
}

export function mapAppointmentParticipantsToRoomParties(args: {
  participants: PersistedAppointmentParticipant[];
  participantJoinLinks?: ParticipantJoinLink[];
}): HydratedRoomParty[] {
  const links = Array.isArray(args.participantJoinLinks)
    ? args.participantJoinLinks
    : [];

  return args.participants.map((p) => {
    const join = links.find((x) => x.participantId === p.partyId) || null;

    return {
      partyId: p.partyId,
      role: toRoomRole(p.role),
      displayName: fallbackDisplayName(p),
      required: p.required !== false,
      patientId: p.patientId ?? null,
      clinicianId: p.clinicianId ?? null,
      specialty: p.specialty ?? null,
      state: 'invited',
      joinPath: join?.joinPath || null,
    };
  });
}

export function computeRequiredParticipantReadiness(parties: HydratedRoomParty[]) {
  const required = parties.filter((p) => p.required);
  const unresolved = required.filter(
    (p) => !['accepted', 'joined'].includes(p.state),
  );

  return {
    requiredCount: required.length,
    readyCount: required.length - unresolved.length,
    unresolved,
    allRequiredReady: unresolved.length === 0,
  };
}