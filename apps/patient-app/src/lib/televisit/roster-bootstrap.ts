import type { RoomParty } from '@/src/lib/rtc/roster-contract';
import {
  loadAppointmentParticipantHydration,
  mapAppointmentParticipantsToRoomParties,
} from '@/src/lib/appointment-participant-hydration';

type HydratedRosterRole =
  | RoomParty['role']
  | 'second_patient_participant';

function normalizeRoomPartyRole(role: HydratedRosterRole): RoomParty['role'] {
  switch (role) {
    case 'second_patient_participant':
      return 'dependent_patient';
    case 'lead_patient':
    case 'dependent_patient':
    case 'observer':
    case 'care_ally':
    case 'lead_clinician':
    case 'co_clinician':
    case 'advisor':
      return role;
    default:
      return 'observer';
  }
}

export async function bootstrapRosterFromAppointment(args: {
  appointmentId?: string | null;
  existingRoster?: RoomParty[];
}): Promise<RoomParty[]> {
  const existing = Array.isArray(args.existingRoster) ? args.existingRoster : [];

  if (!args.appointmentId) {
    return existing;
  }

  const hydrated = await loadAppointmentParticipantHydration({
    appointmentId: args.appointmentId,
  });

  const mapped = mapAppointmentParticipantsToRoomParties({
    participants: hydrated.participants,
    participantJoinLinks: hydrated.participantJoinLinks,
  });

  const byId = new Map<string, RoomParty>();

  for (const item of existing) {
    byId.set(item.partyId, item);
  }

  for (const item of mapped) {
    const prev = byId.get(item.partyId);
    const normalizedRole = normalizeRoomPartyRole(
      item.role as HydratedRosterRole
    );

    const party: RoomParty = {
      partyId: item.partyId,
      role: normalizedRole,
      displayName: item.displayName,
      required: item.required,
      patientId: item.patientId ?? null,
      clinicianId: item.clinicianId ?? null,
      specialty: item.specialty ?? null,
      state: prev?.state || 'invited',
      joinedAt: prev?.joinedAt,
      leftAt: prev?.leftAt,
      metadata: {
        ...(prev?.metadata || {}),
        joinPath: item.joinPath || null,
        bootstrap: true,
        sourceRole: item.role,
      },
    };

    byId.set(item.partyId, party);
  }

  return Array.from(byId.values());
}