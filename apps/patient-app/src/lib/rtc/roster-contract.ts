export const TOPIC_ROSTER = 'roster' as const;
export const TOPIC_CONTROL = 'control' as const;
export const TOPIC_CHAT = 'chat' as const;
export const TOPIC_VITALS = 'vitals' as const;

export type RoomPartyRole =
  | 'lead_patient'
  | 'dependent_patient'
  | 'observer'
  | 'care_ally'
  | 'lead_clinician'
  | 'co_clinician'
  | 'advisor';

export type RoomPartyState =
  | 'invited'
  | 'accepted'
  | 'joined'
  | 'left'
  | 'declined';

export type RoomParty = {
  partyId: string;
  identity?: string | null;
  role: RoomPartyRole;
  displayName: string;
  required: boolean;
  participantId?: string | null;
  patientId?: string | null;
  clinicianId?: string | null;
  specialty?: string | null;
  state: RoomPartyState;
  joinedAt?: number | null;
  leftAt?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type RosterSnapshotEnvelope = {
  type: 'roster.snapshot';
  roomId: string;
  version: number;
  parties: RoomParty[];
  ts: number;
};

export type RosterJoinEnvelope = {
  type: 'roster.party.joined';
  roomId: string;
  party: RoomParty;
  ts: number;
};

export type RosterLeaveEnvelope = {
  type: 'roster.party.left';
  roomId: string;
  partyId: string;
  ts: number;
};

export type RosterInviteEnvelope = {
  type: 'roster.party.invited';
  roomId: string;
  party: RoomParty;
  ts: number;
};

export type RosterEnvelope =
  | RosterSnapshotEnvelope
  | RosterJoinEnvelope
  | RosterLeaveEnvelope
  | RosterInviteEnvelope;

export function isRosterEnvelope(v: unknown): v is RosterEnvelope {
  if (!v || typeof v !== 'object') return false;
  const t = (v as Record<string, unknown>).type;
  return (
    t === 'roster.snapshot' ||
    t === 'roster.party.joined' ||
    t === 'roster.party.left' ||
    t === 'roster.party.invited'
  );
}

export type UnifiedControlKey =
  | 'overlay'
  | 'captions'
  | 'vitals'
  | 'vitalsOverlay'
  | 'recording'
  | 'xr'
  | 'screenshare'
  | 'hand'
  | 'export';

export type UnifiedControlValue = boolean | string;

export type UnifiedControlEnvelope = {
  type: UnifiedControlKey;
  value: UnifiedControlValue;
  from: 'patient' | 'clinician' | 'system';
  ts: number;
};

export function isUnifiedControlKey(v: unknown): v is UnifiedControlKey {
  return (
    v === 'overlay' ||
    v === 'captions' ||
    v === 'vitals' ||
    v === 'vitalsOverlay' ||
    v === 'recording' ||
    v === 'xr' ||
    v === 'screenshare' ||
    v === 'hand' ||
    v === 'export'
  );
}