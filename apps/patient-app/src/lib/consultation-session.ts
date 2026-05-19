export type ConsultationSession = {
  id: string;
  appointmentId: string;
  encounterId: string | null;
  caseId: string;
  clinicianId: string;
  patientId: string;
  hostUserId?: string | null;
  visitMode: 'TELEVISIT' | 'IN_PERSON' | 'HYBRID';
  roomId: string | null;
  state:
    | 'CREATED'
    | 'READY'
    | 'CHECKED_IN'
    | 'ACTIVE'
    | 'INTERRUPTED'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'NO_SHOW'
    | 'ABORTED';
  startedAt: string | null;
  endedAt: string | null;
  outcome: string | null;
  currency: string;
};

async function j<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  const data = await res.json().catch(() => ({} as T & { error?: string; ok?: boolean; session?: T }));
  if (!res.ok) {
    const msg =
      typeof (data as { error?: unknown })?.error === 'string'
        ? (data as { error: string }).error
        : `HTTP ${res.status}`;
    throw new Error(msg);
  }

  if ((data as { ok?: boolean; session?: T }).ok && (data as { session?: T }).session) {
    return (data as { session: T }).session;
  }

  return data as T;
}

export function getSessionByAppointment(appointmentId: string) {
  return j<ConsultationSession>(`/api/consultation-sessions/by-appointment/${appointmentId}`);
}

export function patientCheckIn(sessionId: string) {
  return j<ConsultationSession>(`/api/consultation-sessions/${sessionId}/check-in`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function cancelConsultationSession(sessionId: string, reason?: string | null) {
  return j<ConsultationSession>(`/api/consultation-sessions/${sessionId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason ?? null }),
  });
}