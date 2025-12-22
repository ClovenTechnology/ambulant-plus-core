// apps/patient-app/src/components/iomt/vitals/BloodPressure.tsx
'use client';

import React, { useMemo, useState } from 'react';

type Props = {
  defaultTab?: 'capture' | 'history' | 'thresholds' | 'devices';
  batteryPct?: number | null;
  rssi?: number | null;
  onSave?: (rec: {
    systolic: number;
    diastolic: number;
    pulse?: number;
    timestamp?: string;
    cuffStatus?: string;
    raw?: { simulated?: boolean };
  }) => void | Promise<void>;
};

export default function BloodPressure({ defaultTab = 'capture', batteryPct, rssi, onSave }: Props) {
  const [sys, setSys] = useState(122);
  const [dia, setDia] = useState(78);
  const [pulse, setPulse] = useState(72);
  const [tab, setTab] = useState<Props['defaultTab']>(defaultTab);
  const zone = useMemo(() => {
    if (sys >= 140 || dia >= 90) return 'Stage 2';
    if ((sys >= 130 && sys <= 139) || (dia >= 80 && dia <= 89)) return 'Stage 1';
    if (sys >= 120 && sys <= 129 && dia < 80) return 'Elevated';
    return 'Normal';
  }, [sys, dia]);

  async function save() {
    await onSave?.({
      systolic: sys,
      diastolic: dia,
      pulse,
      timestamp: new Date().toISOString(),
      cuffStatus: 'OK',
      raw: { simulated: true },
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1" role="tablist" aria-label="BP tabs">
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl border">
            <div className="text-xs text-slate-500 mb-1">Systolic (mmHg)</div>
            <input
              type="number"
              value={sys}
              onChange={(e) => setSys(parseInt(e.target.value || '0', 10))}
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="p-3 rounded-xl border">
            <div className="text-xs text-slate-500 mb-1">Diastolic (mmHg)</div>
            <input
              type="number"
              value={dia}
              onChange={(e) => setDia(parseInt(e.target.value || '0', 10))}
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="p-3 rounded-xl border">
            <div className="text-xs text-slate-500 mb-1">Pulse (bpm)</div>
            <input
              type="number"
              value={pulse}
              onChange={(e) => setPulse(parseInt(e.target.value || '0', 10))}
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="p-3 rounded-xl border flex flex-col justify-between">
            <div>
              <div className="text-xs text-slate-500">Status</div>
              <div className="text-sm font-medium">{zone}</div>
            </div>
            <button onClick={save} className="mt-3 px-3 py-2 rounded-xl border bg-slate-900 text-white">
              Save reading
            </button>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="p-3 rounded-xl border text-sm text-slate-600">No history in stub.</div>
      )}
      {tab === 'thresholds' && (
        <div className="p-3 rounded-xl border text-sm text-slate-600">Thresholds editor stub.</div>
      )}
      {tab === 'devices' && (
        <div className="p-3 rounded-xl border text-sm text-slate-600 space-y-1">
          <div>Battery: {batteryPct ?? '—'}%</div>
          <div>RSSI: {rssi ?? '—'} dBm</div>
          <div>Device channel is simulated in this stub.</div>
        </div>
      )}
    </div>
  );
}
