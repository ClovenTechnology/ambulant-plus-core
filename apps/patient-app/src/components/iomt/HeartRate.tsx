// apps/patient-app/src/components/iomt/vitals/HeartRate.tsx
'use client';

import React, { useState } from 'react';

type Props = {
  onSave?: (rec: { hr: number; timestamp?: string; source?: string }) => void | Promise<void>;
};

export default function HeartRate({ onSave }: Props) {
  const [hr, setHr] = useState(74);
  async function save() {
    await onSave?.({ hr, timestamp: new Date().toISOString(), source: 'sim' });
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div className="p-3 rounded-xl border">
        <div className="text-xs text-slate-500 mb-1">Heart rate (bpm)</div>
        <input type="number" value={hr} onChange={(e) => setHr(Number(e.target.value || 0))} className="w-full p-2 border rounded" />
      </div>
      <div className="p-3 rounded-xl border flex items-end">
        <button onClick={save} className="px-3 py-2 rounded-xl border bg-slate-900 text-white">Save reading</button>
      </div>
    </div>
  );
}
