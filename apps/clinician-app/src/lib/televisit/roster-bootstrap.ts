import type { RoomParty } from '@/src/lib/rtc/roster-contract';
import {
  loadAppointmentParticipantHydration,
  mapAppointmentParticipantsToRoomParties,
} from '@/src/lib/appointment-participant-hydration';

export async function bootstrapRosterFromAppointment(args: {
  appointmentId?: string | null;
  existingRoster?: RoomParty[];
}): Promise<RoomParty[]> {
  const existing = Array.isArray(args.existingRoster) ? args.existingRoster : [];
  if (!args.appointmentId) return existing;

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
    byId.set(item.partyId, {
      partyId: item.partyId,
      role: item.role,
      displayName: item.displayName,
      required: item.required,
      patientId: item.patientId ?? null,
      clinicianId: item.clinicianId ?? null,
      specialty: item.specialty ?? null,
      state: prev?.state || 'invited',
      joinedAt: prev?.joinedAt,
      metadata: {
        ...(prev?.metadata || {}),
        joinPath: item.joinPath || null,
        bootstrap: true,
      },
    });
  }

  return Array.from(byId.values());
}