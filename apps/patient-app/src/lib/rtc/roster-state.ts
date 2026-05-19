import type { RosterEnvelope, RoomParty } from '@/src/lib/rtc/roster-contract';

export function upsertRosterParty(
  prev: RoomParty[],
  party: RoomParty,
): RoomParty[] {
  const others = prev.filter((p) => p.partyId !== party.partyId);
  return [...others, party];
}

export function setRosterPartyState(
  prev: RoomParty[],
  partyIds: string[],
  state: RoomParty['state'],
  ts?: number,
): RoomParty[] {
  return prev.map((party) => {
    if (!partyIds.includes(party.partyId)) return party;

    if (state === 'left') {
      return {
        ...party,
        state,
        leftAt: ts ?? party.leftAt ?? null,
      };
    }

    if (state === 'joined' || state === 'accepted') {
      return {
        ...party,
        state,
        joinedAt: ts ?? party.joinedAt ?? null,
      };
    }

    return {
      ...party,
      state,
    };
  });
}

export function applyRosterEvent(
  prev: RoomParty[],
  evt: RosterEnvelope,
): RoomParty[] {
  if (evt.type === 'roster.snapshot') {
    return Array.isArray(evt.parties) ? evt.parties : [];
  }

  if (evt.type === 'roster.party.invited') {
    return upsertRosterParty(prev, evt.party);
  }

  if (evt.type === 'roster.party.joined') {
    return upsertRosterParty(prev, evt.party);
  }

  if (evt.type === 'roster.party.left') {
    return setRosterPartyState(prev, [evt.partyId], 'left', evt.ts);
  }

  return prev;
}