// apps/patient-app/src/components/iomt/vitals/ECG.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';

type Props = {
  onSave?: (rec: {
    durationSec: number;
    rhr?: number;
    rawSummary?: string;
    timestamp?: string;
  }) => void | Promise<void>;
  patientId?: string;
};

export default function ECG({ onSave }: Props) {
  const [recording, setRecording] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const [rhr, setRhr] = useState(72);

  useEffect(() => {
    return () => {
      // cleanup when unmounting a running "recording"
      startedAtRef.current = null;
    };
  }, []);

  function startStop() {
    if (!recording) {
      startedAtRef.current = Date.now();
      setRecording(true);
    } else {
      const dur = startedAtRef.current ? Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)) : 30;
      startedAtRef.current = null;
      setRecording(false);
      onSave?.({
        durationSec: dur,
        rhr,
        rawSummary: 'Stub ECG session',
        timestamp: new Date().toISOString(),
      });
    }
  }

  return (
    <div className="p-3 rounded-xl border space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={startStop}
          className={`px-3 py-2 rounded-xl border ${recording ? 'bg-red-600 text-white border-red-600' : 'bg-slate-900 text-white'}`}
        >
          {recording ? 'Stop' : 'Start'} ECG
        </button>
        <div className="text-sm text-slate-600">
          {recording ? 'Recording…' : 'Idle'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl border md:col-span-3">
          <div className="text-xs text-slate-500 mb-1">Lead preview (stub)</div>
          <div className="h-32 bg-slate-50 rounded border-dashed border" />
        </div>
        <div className="p-3 rounded-xl border">
          <div className="text-xs text-slate-500 mb-1">Resting HR (bpm)</div>
          <input type="number" value={rhr} onChange={(e) => setRhr(Number(e.target.value || 0))} className="w-full p-2 border rounded" />
        </div>
      </div>
    </div>
  );
}
