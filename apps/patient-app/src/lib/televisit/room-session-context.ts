export type RoomSessionContext = {
  roomId: string;
  appointmentId?: string | null;
  encounterId?: string | null;
  visitId?: string | null;
  patientId?: string | null;
  patientName?: string | null;
  clinicianId?: string | null;
  clinicianName?: string | null;
  reason?: string | null;
  startsAt?: string | null;
  visitMode?: string | null;
};

export function readRoomSessionContext(
  search:
    | URLSearchParams
    | {
        get(name: string): string | null;
      },
  roomId: string,
): RoomSessionContext {
  return {
    roomId,
    appointmentId:
      search.get('appointmentId') ||
      search.get('appointment') ||
      search.get('appt') ||
      null,
    encounterId:
      search.get('encounterId') ||
      search.get('encounter') ||
      search.get('enc') ||
      null,
    visitId:
      search.get('visitId') ||
      search.get('visit') ||
      search.get('v') ||
      null,
    patientId: search.get('patientId') || null,
    patientName: search.get('patientName') || null,
    clinicianId: search.get('clinicianId') || null,
    clinicianName: search.get('clinicianName') || null,
    reason: search.get('reason') || null,
    startsAt:
      search.get('startsAt') ||
      search.get('scheduledStartAt') ||
      search.get('start') ||
      null,
    visitMode: search.get('visitMode') || null,
  };
}