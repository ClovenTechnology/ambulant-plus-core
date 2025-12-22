// apps/patient-app/app/orders/new/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '../../../components/toast';
import { getActiveEncounterId } from '../../../src/lib/active-enc';

type Draft = {
  drug: string;
  sig: string;
  qty?: number;
  refills?: number;
  note?: string;
};

export default function NewErxPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({ drug: '', sig: '', qty: 30, refills: 0, note: '' });
  const [busy, setBusy] = useState(false);

  function buildSummary(d: Draft) {
    const parts = [`New eRx: ${d.drug}” ${d.sig}`];
    if (d.qty) parts.push(`Qty ${d.qty}`);
    if (typeof d.refills === 'number') parts.push(`Refills ${d.refills}`);
    if (d.note?.trim()) parts.push(`Note: ${d.note.trim()}`);
    return parts.join(' ');
  }

  async function maybeDropNoteToActiveEncounter(summary: string) {
    try {
      const activeId = getActiveEncounterId();
      if (!activeId) return; // nothing to do
      const res = await fetch(`/api/encounters/${activeId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: summary, source: 'erx', ts: new Date().toISOString() }),
      });
      if (!res.ok) {
        // Non-fatal: just inform
        const j = await res.json().catch(() => ({}));
        toast(j?.error ?? 'Could not add note to encounter', { type: 'error' });
      } else {
        toast('eRx noted in encounter', { type: 'success' });
      }
    } catch {
      // silent: we already completed the primary eRx flow
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.drug.trim() || !draft.sig.trim()) {
      toast('Please enter drug and SIG', { type: 'error' });
      return;
    }
    try {
      setBusy(true);
      const res = await fetch('/api/erx', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          drug: draft.drug.trim(),
          sig: draft.sig.trim(),
          qty: Number(draft.qty ?? 0),
          refills: Number(draft.refills ?? 0),
          note: (draft.note ?? '').trim(),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) throw new Error(j?.error ?? 'Could not submit eRx');

      toast('eRx submitted', { type: 'success' });

      // Fire a best-effort note into the active encounter (non-blocking UX)
      const summary = buildSummary(draft);
      maybeDropNoteToActiveEncounter(summary);

      // small delay so toast is visible, then jump to printable summary
      setTimeout(() => router.push('/orders/print'), 150);
    } catch (err: any) {
      toast(err?.message ?? 'Could not submit eRx', { type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">New eRx</h1>
        <button
          onClick={() => router.push('/orders')}
          className="px-3 py-2 border rounded bg-white hover:bg-gray-50 text-sm"
        >
          Back to Orders
        </button>
      </header>

      <form onSubmit={onSubmit} className="p-4 border rounded bg-white space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-sm font-medium mb-1">Drug</div>
            <input
              value={draft.drug}
              onChange={e => setDraft({ ...draft, drug: e.target.value })}
              placeholder="e.g., Amoxicillin 500 mg capsule"
              className="w-full border rounded px-3 py-2"
              required
            />
          </label>
          <label className="block">
            <div className="text-sm font-medium mb-1">SIG</div>
            <input
              value={draft.sig}
              onChange={e => setDraft({ ...draft, sig: e.target.value })}
              placeholder="e.g., Take 1 capsule PO TID x 7 days"
              className="w-full border rounded px-3 py-2"
              required
            />
          </label>
          <label className="block">
            <div className="text-sm font-medium mb-1">Quantity</div>
            <input
              type="number"
              min={0}
              value={draft.qty ?? 0}
              onChange={e => setDraft({ ...draft, qty: Number(e.target.value) })}
              className="w-full border rounded px-3 py-2"
            />
          </label>
          <label className="block">
            <div className="text-sm font-medium mb-1">Refills</div>
            <input
              type="number"
              min={0}
              value={draft.refills ?? 0}
              onChange={e => setDraft({ ...draft, refills: Number(e.target.value) })}
              className="w-full border rounded px-3 py-2"
            />
          </label>
        </div>

        <label className="block">
          <div className="text-sm font-medium mb-1">Note (optional)</div>
          <textarea
            value={draft.note ?? ''}
            onChange={e => setDraft({ ...draft, note: e.target.value })}
            placeholder="Additional context for the pharmacy"
            className="w-full border rounded px-3 py-2 min-h-[90px]"
          />
        </label>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="px-3 py-2 border rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {busy ? 'Submitting...' : 'Submit eRx'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/orders')}
            className="px-3 py-2 border rounded bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}
