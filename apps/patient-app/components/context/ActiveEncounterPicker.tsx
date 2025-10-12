// apps/patient-app/components/ActiveEncounterPicker.tsx
'use client';

import { useActiveEncounter } from './context/ActiveEncounterContext';

export default function ActiveEncounterPicker() {
  const { encounters, activeEncounter, setActiveEncounter } = useActiveEncounter();

  if (!encounters || encounters.length === 0) {
    return <span className="text-gray-500 text-sm">No encounters yet</span>;
  }

  return (
    <select
      value={activeEncounter?.id || ''}
      onChange={(e) => {
        const enc = encounters.find((enc) => enc.id === e.target.value) || null;
        setActiveEncounter(enc);
      }}
      className="border rounded px-2 py-1 text-sm"
    >
      {encounters.map((enc) => (
        <option key={enc.id} value={enc.id}>
          {enc.name}
        </option>
      ))}
    </select>
  );
}
