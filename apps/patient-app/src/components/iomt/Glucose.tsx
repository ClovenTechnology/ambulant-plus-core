// apps/patient-app/src/components/iomt/vitals/Glucose.tsx
'use client';

import React, { useMemo, useState } from 'react';

type Props = {
  onSave?: (rec: {
    glucose: number;
    unit: 'mg/dL' | 'mmol/L';
    stripCode?: string;
    testType?: string;
    fasting?: boolean | null;
    note?: string;
    timestamp: string;
  }) => void | Promise<void>;
  initialHistory?: Array<{ t: string; v: number; unit: 'mg/dL' | 'mmol/L' }>;
};

export default function Glucose({ onSave, initialHistory = [] }: Props) {
  const [unit, setUnit] = useState<'mg/dL' | 'mmol/L'>('mmol/L');
  const [glucose, setGlucose] = useState(8.2);
  const [fasting, setFasting] = useState<boolean | null>(null);
  const [note, setNote] = useState('');
  const [hist, setHist] = useState(initialHistory);

  const converted = useMemo(() => {
    if (unit === 'mmol/L') return { mmol: glucose, mg: glucose * 18 };
    return { mg: glucose, mmol: glucose / 18 };
  }, [glucose, unit]);

  async function save() {
    const rec = {
      glucose,
      unit,
      stripCode: '000',
      testType: fasting ? 'fasting' : 'random',
      fasting,
      note,
      timestamp: new Date().toISOString(),
    };
    await onSave?.(rec);
    setHist([{ t: rec.timestamp, v: rec.glucose, unit: rec.unit }, ...hist].slice(0, 20));
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div className="p-3 rounded-xl border space-y-2">
        <div className="text-xs text-slate-500">Glucose</div>
        <input
          type="number"
          value={glucose}
          onChange={(e) => setGlucose(Number(e.target.value || 0))}
          className="w-full p-2 border rounded"
          step="0.1"
        />
        <select value={unit} onChange={(e) => setUnit(e.target.value as any)} className="w-full p-2 border rounded">
          <option value="mg/dL">mg/dL</option>
          <option value="mmol/L">mmol/L</option>
        </select>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={!!fasting} onChange={(e) => setFasting(e.target.checked ? true : null)} />
          Fasting
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full p-2 border rounded text-sm"
          placeholder="Note"
        />
        <button onClick={save} className="px-3 py-2 rounded-xl border bg-slate-900 text-white w-full">
          Save reading
        </button>
        <div className="text-xs text-slate-500">
          {unit === 'mmol/L'
            ? `≈ ${converted.mg.toFixed(0)} mg/dL`
            : `≈ ${converted.mmol.toFixed(1)} mmol/L`}
        </div>
      </div>

      <div className="p-3 rounded-xl border md:col-span-2">
        <div className="text-sm font-medium mb-2">Recent readings</div>
        {hist.length === 0 ? (
          <div className="text-sm text-slate-600">No history in stub.</div>
        ) : (
          <ul className="space-y-1 text-sm">
            {hist.map((h, i) => (
              <li key={i} className="flex items-center justify-between">
                <span className="tabular-nums">{new Date(h.t).toLocaleString()}</span>
                <span className="tabular-nums">
                  {h.v} {h.unit}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
