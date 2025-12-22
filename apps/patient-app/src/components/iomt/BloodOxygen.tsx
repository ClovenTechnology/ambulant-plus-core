// apps/patient-app/src/components/iomt/vitals/BloodOxygen.tsx
'use client';

import React, { useState } from 'react';

type Props = {
  patientId?: string;
  onSave?: (rec: { spo2: number; pulse?: number; perfIndex?: number; timestamp?: string; source?: string }) => void | Promise<void>;
};

export default function BloodOxygen({ onSave }: Props) {
  const [spo2, setSpo2] = useState(97);
  const [pulse, setPulse] = useState(74);
  const [pi, setPi] = useState(4.3);

  async function save() {
    await onSave?.({
      spo2,
      pulse,
      perfIndex: pi,
      timestamp: new Date().toISOString(),
      source: 'sim',
    });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div className="p-3 rounded-xl border">
        <div className="text-xs text-slate-500 mb-1">SpO₂ (%)</div>
        <input type="number" value={spo2} onChange={(e) => setSpo2(Number(e.target.value || 0))} className="w-full p-2 border rounded" />
      </div>
      <div className="p-3 rounded-xl border">
        <div className="text-xs text-slate-500 mb-1">Pulse (bpm)</div>
        <input type="number" value={pulse} onChange={(e) => setPulse(Number(e.target.value || 0))} className="w-full p-2 border rounded" />
      </div>
      <div className="p-3 rounded-xl border">
        <div className="text-xs text-slate-500 mb-1">Perfusion Index</div>
        <input type="number" value={pi} onChange={(e) => setPi(Number(e.target.value || 0))} className="w-full p-2 border rounded" />
      </div>
      <div className="md:col-span-3">
        <button onClick={save} className="px-3 py-2 rounded-xl border bg-slate-900 text-white">Save reading</button>
      </div>
    </div>
  );
}
