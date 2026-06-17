import type { RoomParty } from '@/src/lib/rtc/roster-contract';

type ParticipantMetadata = {
  appointmentId?: string | null;
  participantId?: string | null;
  participantRole?:
    | 'lead_patient'
    | 'dependent_patient'
    | 'observer'
    | 'care_ally'
    | 'lead_clinician'
    | 'co_clinician'
    | 'advisor'
    | 'second_patient_participant'
    | null;
  rtcRole?: 'patient' | 'clinician' | 'observer' | 'staff' | 'admin' | null;
  visitId?: string | null;
  patientId?: string | null;
  clinicianId?: string | null;
  displayName?: string | null;
  specialty?: string | null;
  required?: boolean | null;
};

function normalizeIdentity(identity?: string | null) {
  return String(identity || '').trim();
}

function safeJsonParse<T>(raw?: string | null): T | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function inferPartyRole(identity: string): RoomParty['role'] | null {
  const id = normalizeIdentity(identity).toLowerCase();

  if (!id) return null;
  if (id.startsWith('clin-')) return 'co_clinician';
  if (id.startsWith('patient-')) return 'lead_patient';
  if (id.startsWith('pat-')) return 'lead_patient';
  if (id.includes('observer')) return 'observer';
  if (id.includes('care_ally')) return 'care_ally';
  if (id.includes('advisor')) return 'advisor';

  return null;
}

function mapMetadataRole(
  role?: ParticipantMetadata['participantRole'],
): RoomParty['role'] | null {
  switch (role) {
    case 'lead_patient':
      return 'lead_patient';
    case 'dependent_patient':
      return 'dependent_patient';
    case 'observer':
      return 'observer';
    case 'care_ally':
      return 'care_ally';
    case 'lead_clinician':
      return 'lead_clinician';
    case 'co_clinician':
      return 'co_clinician';
    case 'advisor':
      return 'advisor';
    case 'second_patient_participant':
      return 'second_patient_participant';
    default:
      return null;
  }
}

function fallbackDisplayName(identity: string) {
  return identity || 'Participant';
}

function normalizeMetadata(
  identity?: string | null,
  metadataRaw?: string | null,
): {
  partyId: string;
  role: RoomParty['role'] | null;
  displayName: string;
  patientId?: string | null;
  clinicianId?: string | null;
  specialty?: string | null;
  required: boolean;
} {
  const identityText = normalizeIdentity(identity);
  const md = safeJsonParse<ParticipantMetadata>(metadataRaw);

  const partyId = String(md?.participantId || identityText).trim();
  const role = mapMetadataRole(md?.participantRole) || inferPartyRole(identityText);

  return {
    partyId,
    role,
    displayName:
      String(md?.displayName || '').trim() ||
      String(md?.specialty || '').trim() ||
      fallbackDisplayName(identityText),
    patientId: md?.patientId ?? null,
    clinicianId: md?.clinicianId ?? null,
    specialty: md?.specialty ?? null,
    required: md?.required !== false,
  };
}

export function reconcileParticipantConnected(args: {
  prev: RoomParty[];
  identity?: string | null;
  metadata?: string | null;
  joinedAt?: number;
}) {
  const normalized = normalizeMetadata(args.identity, args.metadata);
  if (!normalized.partyId) return args.prev;

  const existing = args.prev.find((p) => p.partyId === normalized.partyId);
  if (existing) {
    return args.prev.map((p) =>
      p.partyId === normalized.partyId
        ? {
            ...p,
            role: normalized.role || p.role,
            displayName: normalized.displayName || p.displayName,
            patientId: normalized.patientId ?? p.patientId ?? null,
            clinicianId: normalized.clinicianId ?? p.clinicianId ?? null,
            specialty: normalized.specialty ?? p.specialty ?? null,
            required: normalized.required ?? p.required,
            state: 'joined',
            joinedAt: args.joinedAt ?? Date.now(),
          }
        : p,
    );
  }

  if (!normalized.role) return args.prev;

  return [
    ...args.prev,
    {
      partyId: normalized.partyId,
      role: normalized.role,
      displayName: normalized.displayName,
      required: normalized.required,
      patientId: normalized.patientId ?? null,
      clinicianId: normalized.clinicianId ?? null,
      specialty: normalized.specialty ?? null,
      state: 'joined',
      joinedAt: args.joinedAt ?? Date.now(),
    } satisfies RoomParty,
  ];
}

export function reconcileParticipantDisconnected(args: {
  prev: RoomParty[];
  identity?: string | null;
  metadata?: string | null;
  leftAt?: number;
}) {
  const normalized = normalizeMetadata(args.identity, args.metadata);
  if (!normalized.partyId) return args.prev;

  return args.prev.map((p) =>
    p.partyId === normalized.partyId
      ? {
          ...p,
          state: 'left',
          leftAt: args.leftAt ?? Date.now(),
        }
      : p,
  );
}