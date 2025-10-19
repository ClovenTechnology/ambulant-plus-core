// apps/patient-app/components/TodaysPills.tsx
'use client';

import React, { useState } from 'react';

interface Pill {
  id: string;
  name: string;
  dose: string;
  time: string;
  status: 'Pending' | 'Taken' | 'Missed';
}

interface TodaysPillsProps {
  pills: Pill[];
  onAdherenceUpdate?: (adherencePct: number) => void; // optional callback
}

export default function TodaysPills({ pills, onAdherenceUpdate }: TodaysPillsProps) {
  const [pillState, setPillState] = useState<Pill[]>(pills);

  const computeAdherence = (list: Pill[]) => {
    const total = list.length;
    if (total === 0) return 100;
    const taken = list.filter(p => p.status === 'Taken').length;
    return Math.round((taken / total) * 100);
  };

  const handleConfirm = async (index: number) => {
    const pill = pillState[index];
    const updatedList = [...pillState];
    updatedList[index] = { ...pill, status: 'Taken' };
    setPillState(updatedList);

    // Update adherence callback
    onAdherenceUpdate?.(computeAdherence(updatedList));

    try {
      // PATCH pill status
      await fetch(`/api/medications`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pill.id, status: 'Taken' }),
      });

      // Send analytics event
      fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'pill_taken', props: { pillName: pill.name, pillId: pill.id }, ts: Date.now() }),
      });
    } catch (err) {
      console.error('Failed to confirm pill', err);
      // revert local state on failure
      setPillState(prev => {
        const copy = [...prev];
        copy[index] = { ...pill, status: 'Pending' };
        return copy;
      });
      onAdherenceUpdate?.(computeAdherence(pillState));
    }
  };

  const handleSnooze = (index: number) => {
    const pill = pillState[index];
    console.log('Snoozed', pill);
    // Could integrate backend snooze later
  };

  return (
    <div className="space-y-2">
      {pillState.map((m, i) => (
        <div key={m.id} className="flex justify-between items-center p-3 border rounded-lg bg-white shadow-sm">
          <div>
            <div className="font-medium">{m.name}</div>
            <div className="text-sm text-gray-500">{m.dose} • {m.time}</div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              m.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
              m.status === 'Taken' ? 'bg-emerald-100 text-emerald-800' :
              'bg-red-100 text-red-800'
            }`}>
              {m.status}
            </span>

            {m.status === 'Pending' && (
              <>
                <button onClick={() => handleConfirm(i)} className="px-2 py-1 rounded bg-emerald-600 text-white text-xs hover:bg-emerald-700">✅</button>
                <button onClick={() => handleSnooze(i)} className="px-2 py-1 rounded bg-gray-200 text-gray-700 text-xs hover:bg-gray-300">⏰</button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
