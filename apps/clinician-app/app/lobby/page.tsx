'use client';

import { useMemo, useState } from 'react';

function makeLinks(roomId: string) {
  if (typeof window === 'undefined') {
    return {
      clinician: `http://localhost:3001/sfu/${encodeURIComponent(roomId)}`,
      patient:   `http://localhost:3000/sfu/${encodeURIComponent(roomId)}`,
    };
  }
  const here = new URL(window.location.href);
  const clinician = `${here.origin.replace(/\/lobby\/?$/, '')}/sfu/${encodeURIComponent(roomId)}`;

  const patientURL = new URL(here.href);
  patientURL.port = '3000';
  patientURL.pathname = `/sfu/${encodeURIComponent(roomId)}`;
  patientURL.search = '';
  patientURL.hash = '';
  const patient = patientURL.toString();

  return { clinician, patient };
}

export default function Lobby() {
  const [roomId, setRoomId] = useState('dev');
  const links = useMemo(() => makeLinks(roomId), [roomId]);

  const copy = async (txt: string) => {
    try { await navigator.clipboard.writeText(txt); alert('Copied!'); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = txt; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove(); alert('Copied!');
    }
  };

  return (
    <main className="p-6 max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Clinician Lobby</h1>

      <div className="rounded border p-4 space-y-3 bg-white">
        <label className="block text-sm text-gray-600">Room ID</label>
        <input
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className="border rounded px-3 py-2 w-full"
          placeholder="e.g. dev, call-123"
        />
        <div className="flex flex-wrap gap-2">
          <a href={`/sfu/${encodeURIComponent(roomId)}`} className="px-3 py-2 border rounded hover:bg-gray-100">
            Open Clinician SFU
          </a>
          <a href={links.patient} target="_blank" rel="noreferrer" className="px-3 py-2 border rounded hover:bg-gray-100">
            Open Patient (new tab)
          </a>
        </div>
      </div>

      <div className="rounded border p-4 space-y-3 bg-white">
        <div className="font-medium">Invite Links</div>
        <div className="text-sm text-gray-600">Share these with participants.</div>

        <div className="space-y-2">
          <div className="text-xs text-gray-500">Clinician</div>
          <div className="flex gap-2">
            <input readOnly value={links.clinician} className="border rounded px-2 py-1 flex-1" />
            <button onClick={() => copy(links.clinician)} className="px-3 py-1 border rounded">Copy</button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs text-gray-500">Patient</div>
          <div className="flex gap-2">
            <input readOnly value={links.patient} className="border rounded px-2 py-1 flex-1" />
            <button onClick={() => copy(links.patient)} className="px-3 py-1 border rounded">Copy</button>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={() => copy(`Clinician: ${links.clinician}\nPatient: ${links.patient}`)}
            className="px-3 py-2 border rounded w-full"
          >
            Copy Both
          </button>
        </div>
      </div>
    </main>
  );
}
