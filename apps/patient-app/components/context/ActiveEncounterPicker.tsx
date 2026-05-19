// apps/patient-app/components/context/ActiveEncounterPicker.tsx
'use client';

import { useActiveEncounter } from './ActiveEncounterContext';

function labelForEncounter(encounter: {
  id: string;
  name?: string;
  title?: string;
  patientName?: string;
  clinicianName?: string;
}) {
  return (
    encounter.name ||
    encounter.title ||
    encounter.patientName ||
    encounter.clinicianName ||
    `Encounter ${encounter.id.slice(0, 8)}`
  );
}

export default function ActiveEncounterPicker() {
  const {
    encounters,
    activeEncounter,
    setActiveEncounter,
    loading,
    error,
  } = useActiveEncounter();

  /**
   * Production-clean behaviour:
   * - Do not show a red global warning in the app chrome.
   * - Do not show mock/fallback encounter text.
   * - If there is no authenticated profile, no encounters, or the endpoint is
   *   temporarily unavailable, the top bar simply omits the picker.
   */
  if (loading || error || encounters.length === 0) {
    return null;
  }

  if (encounters.length === 1) {
    const only = encounters[0];

    return (
      <div className="hidden items-center rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm sm:flex">
        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span className="max-w-[180px] truncate">{labelForEncounter(only)}</span>
      </div>
    );
  }

  return (
    <select
      value={activeEncounter?.id ?? ''}
      onChange={(event) => {
        const encounter =
          encounters.find((item) => item.id === event.target.value) ?? null;

        setActiveEncounter(encounter);
      }}
      className="hidden max-w-[220px] rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 sm:block"
      aria-label="Active encounter"
    >
      {encounters.map((encounter) => (
        <option key={encounter.id} value={encounter.id}>
          {labelForEncounter(encounter)}
        </option>
      ))}
    </select>
  );
}