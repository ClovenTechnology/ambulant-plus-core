export type CallablePartyKind =
  | 'STAFF'
  | 'PATIENT'
  | 'CLINICIAN'
  | 'PHLEB'
  | 'RIDER';

export type CallableParty = {
  kind: CallablePartyKind;
  id: string;
  displayName: string;
  subtitle?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  presence?: string | null;
  canMessage: boolean;
  canAudioCall: boolean;
  canVideoCall: boolean;
};

export const CALLABLE_PARTY_KINDS: Array<{
  kind: CallablePartyKind;
  label: string;
  enabled: boolean;
}> = [
  { kind: 'STAFF', label: 'Staff', enabled: true },
  { kind: 'PATIENT', label: 'Patients', enabled: false },
  { kind: 'CLINICIAN', label: 'Clinicians', enabled: false },
  { kind: 'PHLEB', label: 'Phlebs', enabled: false },
  { kind: 'RIDER', label: 'Riders', enabled: false },
];

export function staffAsCallableParty(item: any): CallableParty {
  const displayName = item?.name || item?.email || 'Staff member';

  return {
    kind: 'STAFF',
    id: String(item?.id || ''),
    displayName,
    subtitle:
      item?.designation?.name ||
      item?.department?.name ||
      'Ambulant+ staff',
    email: item?.email || null,
    avatarUrl:
      item?.photoUrl && item?.id
        ? `/api/admin/staff/${encodeURIComponent(item.id)}/avatar`
        : null,
    presence: item?.presence?.state || 'OFFLINE',
    canMessage: true,
    canAudioCall: true,
    canVideoCall: true,
  };
}
