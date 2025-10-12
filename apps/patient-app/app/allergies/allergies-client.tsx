'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from '../../components/toast';
import { formatDate } from '../../src/lib/date';

type Allergy = {
  id: string;
  substance: string;
  reaction: string;
  severity: 'Mild' | 'Moderate' | 'Severe';
  status: 'Active' | 'Resolved';
  notedAt: string;
};

export default function AllergiesClient({ initial }: { initial?: Allergy[] }) {
  const [rows, setRows] = useState<Allergy[] | null>(initial ?? null);
  const [loading, setLoading] = useState(false);

  // form state
  const [substance, setSubstance] = useState('');
  const [reaction, setReaction] = useState('');
  const [severity, setSeverity] = useState<'Mild'|'Moderate'|'Severe'>('Mild');

  async function load() {
    try {
      const r = await fetch('/api/allergies', { cache: 'no-store' });
      const d: Allergy[] = await r.json();
      setRows(d);
    } catch {
      setRows([]);
    }
  }

  useEffect(() => {
    if (rows == null) load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeCount = useMemo(
    () => (rows ?? []).filter(a => a.status === 'Active').length,
    [rows]
  );

  async function addAllergy() {
    if (!substance.trim() || !reaction.trim()) {
      return toast('Please enter substance and reaction', { type: 'error' });
    }
    setLoading(true);
    try {
      const r = await fetch('/api/allergies', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ substance: substance.trim(), reaction: reaction.trim(), severity }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error ?? 'Could not add allergy');
      toast('Allergy added', { type: 'success' });
      setSubstance(''); setReaction(''); setSeverity('Mild');
      load();
    } catch (e: any) {
      toast(e?.message ?? 'Could not add allergy', { type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus(a: Allergy) {
    try {
      const next = a.status === 'Active' ? 'Resolved' : 'Active';
      const r = await fetch('/api/allergies', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: a.id, status: next }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error ?? 'Could not update');
      toast('Status updated', { type: 'success' });
      setRows(prev => prev ? prev.map(x => x.id === a.id ? { ...x, status: next } : x) : prev);
    } catch (e: any) {
      toast(e?.message ?? 'Could not update', { type: 'error' });
    }
  }

  return (
    <div className="space-y-6">
      {/* quick stats */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-white border rounded-lg">
          <div className="text-xs text-gray-500">Active</div>
          <div className="text-xl font-semibold">{activeCount}</div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="text-xs text-gray-500">Total</div>
          <div className="text-xl font-semibold">{rows?.length ?? 0}</div>
        </div>
      </section>

      {/* add form */}
      <section className="p-4 bg-white border rounded-lg space-y-3">
        <h2 className="font-semibold">Add Allergy</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <input
            value={substance}
            onChange={e => setSubstance(e.target.value)}
            placeholder="Substance (e.g., Penicillin)"
            className="border rounded px-2 py-2"
          />
          <input
            value={reaction}
            onChange={e => setReaction(e.target.value)}
            placeholder="Reaction (e.g., Rash)"
            className="border rounded px-2 py-2"
          />
          <select
            value={severity}
            onChange={e => setSeverity(e.target.value as any)}
            className="border rounded px-2 py-2"
          >
            <option value="Mild">Mild</option>
            <option value="Moderate">Moderate</option>
            <option value="Severe">Severe</option>
          </select>
          <button
            onClick={addAllergy}
            disabled={loading}
            className="border rounded px-3 py-2 bg-white hover:bg-gray-50 disabled:opacity-60"
          >
            {loading ? 'Savingâ€¦' : 'Add'}
          </button>
        </div>
      </section>

      {/* list */}
      <section className="p-4 bg-white border rounded-lg">
        <h2 className="font-semibold mb-3">Allergy List</h2>
        {(!rows || rows.length === 0) ? (
          <div className="text-sm text-gray-500">No allergies recorded.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">Substance</th>
                <th className="py-2">Reaction</th>
                <th className="py-2">Severity</th>
                <th className="py-2">Status</th>
                <th className="py-2">Noted</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(a => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="py-2 font-medium">{a.substance}</td>
                  <td className="py-2">{a.reaction}</td>
                  <td className="py-2">{a.severity}</td>
                  <td className="py-2">{a.status}</td>
                  <td className="py-2">{formatDate(a.notedAt)}</td>
                  <td className="py-2">
                    <button
                      onClick={() => toggleStatus(a)}
                      className="text-xs px-2 py-1 border rounded bg-white hover:bg-gray-50"
                    >
                      Mark {a.status === 'Active' ? 'Resolved' : 'Active'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
