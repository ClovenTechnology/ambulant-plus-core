// apps/patient-app/app/encounters/[id]/encounter-client.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '../../../components/toast';
import { formatDateTime } from '../../../src/lib/date';

type Note = { id: string; ts: string; text: string; source?: string };
type Encounter = {
  id: string;
  status: 'Triage' | 'Consult' | 'Completed';
  startedAt: string;
  updatedAt: string;
  summary?: string;
  notes: Note[];
};

export default function EncounterClient({
  id,
  initial,
}: {
  id: string;
  initial: Encounter;
}) {
  const router = useRouter();
  const [enc, setEnc] = useState<Encounter>(initial);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  async function addNote() {
    const text = draft.trim();
    if (!text) return toast('Write a note first', { type: 'error' });

    try {
      setBusy(true);
      const res = await fetch(`/api/encounters/${id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, source: 'clinician' }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) throw new Error(j?.error ?? 'Could not add note');

      setDraft('');
      toast('Note added', { type: 'success' });
      setEnc(j.encounter);
    } catch (e: any) {
      toast(e?.message ?? 'Could not add note', { type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: Encounter['status']) {
    try {
      setBusy(true);
      const res = await fetch(`/api/encounters/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) throw new Error(j?.error ?? 'Could not update status');

      toast(`Status → ${status}`, { type: 'success' });
      setEnc(j.encounter);
    } catch (e: any) {
      toast(e?.message ?? 'Could not update status', { type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="p-4 bg-white border rounded space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-500">Status:</span>
        <div className="flex gap-2">
          {(['Triage', 'Consult', 'Completed'] as const).map(s => (
            <button
              key={s}
              disabled={busy || enc.status === s}
              onClick={() => setStatus(s)}
              className={
                'px-2 py-1 border rounded text-xs ' +
                (enc.status === s
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white hover:bg-gray-50')
              }
            >
              {s}
            </button>
          ))}
        </div>
        <div className="ml-auto text-xs text-gray-500">
          Updated {formatDateTime(enc.updatedAt)}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Add note</label>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type encounter note…"
          className="w-full border rounded p-2 min-h-[90px]"
        />
        <div className="mt-2 flex gap-2">
          <button
            onClick={addNote}
            disabled={busy}
            className="px-3 py-2 border rounded bg-white hover:bg-gray-50"
          >
            {busy ? 'Saving…' : 'Save Note'}
          </button>
          <button
            onClick={() => router.refresh()}
            className="px-3 py-2 border rounded bg-white hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {enc.notes?.length ? (
        <div>
          <h3 className="font-semibold mb-2 text-sm">Recent notes</h3>
          <ul className="divide-y">
            {enc.notes.map(n => (
              <li key={n.id} className="py-3">
                <div className="text-xs text-gray-500 mb-1">
                  {formatDateTime(n.ts)} {n.source ? `• ${n.source}` : ''}
                </div>
                <div className="whitespace-pre-wrap text-sm">{n.text}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
