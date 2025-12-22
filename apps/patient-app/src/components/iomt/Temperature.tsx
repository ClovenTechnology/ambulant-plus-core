// apps/patient-app/src/components/iomt/vitals/Temperature.tsx
'use client';

import React, { useState } from 'react';

type Props = {
  defaultTab?: 'capture' | 'history' | 'thresholds' | 'devices';
  onSave?: (rec: { celsius: number; fahrenheit?: number; timestamp?: string; raw?: { simulated?: boolean } }) => void | Promise<void>;
};

export default function Temperature({ defaultTab = 'capture', onSave }: Props) {
  const [tab, setTab] = useState<Props['defaultTab']>(defaultTab);
  const [c, setC] = useState(36.8);

  async function save() {
    const f = c * 9/5 + 32;
    await onSave?.({
      celsius: c,
      fahrenheit: +f.toFixed(1),
      timestamp: new Date().toISOString(),
      raw: { simulated: true },
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1" role="tablist" aria-label="Temp tabs">
        {(['capture', 'history', 'thresholds', 'devices'] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-xl border text-sm ${tab === k ? 'bg-slate-900 text-white' : 'bg-white'}`}
          >
            {k[0].toUpperCase() + k.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'capture' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl border">
            <div className="text-xs text-slate-500 mb-1">Temperature (°C)</div>
            <input type="number" value={c} onChange={(e) => setC(Number(e.target.value || 0))} className="w-full p-2 border rounded" />
          </div>
          <div className="p-3 rounded-xl border flex items-end">
            <button onClick={save} className="px-3 py-2 rounded-xl border bg-slate-900 text-white">Save reading</button>
          </div>
        </div>
      )}

      {tab !== 'capture' && <div className="p-3 rounded-xl border text-sm text-slate-600">Stub content</div>}
    </div>
  );
}
