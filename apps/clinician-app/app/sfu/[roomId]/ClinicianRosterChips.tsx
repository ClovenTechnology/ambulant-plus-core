'use client';

import type { RoomParty } from '@/src/lib/rtc/roster-contract';

function roleLabel(role: RoomParty['role']) {
  switch (role) {
    case 'lead_patient':
      return 'Patient';
    case 'dependent_patient':
      return 'Dependant';
    case 'observer':
      return 'Observer';
    case 'care_ally':
      return 'Care ally';
    case 'lead_clinician':
      return 'Lead clinician';
    case 'co_clinician':
      return 'Co-clinician';
    case 'advisor':
      return 'Advisor';
    default:
      return role;
  }
}

function tone(state: RoomParty['state']) {
  switch (state) {
    case 'joined':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'accepted':
      return 'border-sky-200 bg-sky-50 text-sky-800';
    case 'invited':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'left':
      return 'border-slate-200 bg-slate-100 text-slate-600';
    case 'declined':
      return 'border-rose-200 bg-rose-50 text-rose-800';
    default:
      return 'border-slate-200 bg-white text-slate-700';
  }
}

export default function ClinicianRosterChips({
  roster,
}: {
  roster: RoomParty[];
}) {
  if (!roster.length) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {roster.map((party) => (
        <span
          key={party.partyId}
          className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${tone(
            party.state,
          )}`}
          title={`${roleLabel(party.role)} · ${party.state}${party.specialty ? ` · ${party.specialty}` : ''}`}
        >
          <span className="truncate max-w-[120px]">
            {party.displayName || roleLabel(party.role)}
          </span>
          <span className="opacity-70">{roleLabel(party.role)}</span>
          {party.required ? (
            <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em]">
              Required
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}