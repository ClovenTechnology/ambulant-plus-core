// apps/clinician-app/app/record/page.tsx
'use client';

import { useState } from 'react';

type EgressResp = {
  egressId?: string;
  status?: string;
  roomName?: string;
  [k: string]: any;
};

export default function RecordPage() {
  const [roomName, setRoomName] = useState('dev');
  const [egressId, setEgressId] = useState<string>('');
  const [log, setLog] = useState<string>('');

  const addLog = (line: string) =>
    setLog((l) => `${new Date().toLocaleTimeString()}  ${line}\n${l}`);

  const start = async () => {
    try {
      const r = await fetch('/api/record', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'start', roomName }),
      });
      const j: EgressResp = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      if (j.egressId) setEgressId(j.egressId);
      addLog(`Started egress: ${j.egressId || 'unknown'}`);
    } catch (e: any) {
      addLog(`Start failed: ${e?.message || e}`);
    }
  };

  const stop = async () => {
    try {
      if (!egressId) {
        addLog('No egressId to stop.');
        return;
      }
      const r = await fetch('/api/record', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'stop', egressId }),
      });
      const j: EgressResp = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      addLog(`Stopped egress: ${egressId}`);
    } catch (e: any) {
      addLog(`Stop failed: ${e?.message || e}`);
    }
  };

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Recording Control</h1>

      <div className="flex flex-col sm:flex-row gap-2 items-start">
        <input
          className="border rounded px-3 py-2"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          placeholder="room name"
        />
        <button onClick={start} className="px-3 py-2 border rounded bg-emerald-600 text-white">Start Room Composite</button>
        <button onClick={stop} className="px-3 py-2 border rounded">Stop</button>
      </div>

      <div>
        <div className="text-sm text-gray-600">egressId</div>
        <div className="font-mono text-sm">{egressId || '—'}</div>
      </div>

      <div>
        <div className="text-sm text-gray-600 mb-1">Log</div>
        <textarea className="w-full h-48 border rounded p-2 font-mono text-xs" readOnly value={log} />
      </div>

      <p className="text-sm text-gray-500">
        Tip: make sure your docker compose maps <code>/output</code> to <code>./recordings</code> so files appear locally.
      </p>
    </main>
  );
}
