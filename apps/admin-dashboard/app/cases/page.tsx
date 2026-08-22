"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type CaseRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  updatedAt: string;
  openedAt: string;
  encounterCount: number;
  patientId: string;
  patient?: { name?: string | null; mrn?: string | null } | null;
  leadClinician?: { displayName?: string | null; specialty?: string | null } | null;
};

export default function ClinicalCasesPage() {
  const [items, setItems] = useState<CaseRow[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      if (q.trim()) qs.set('q', q.trim());
      if (status !== 'all') qs.set('status', status);
      qs.set('limit', '250');
      const response = await fetch(`/api/admin/cases?${qs.toString()}`, {
        cache: 'no-store',
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`);
      setItems(Array.isArray(body?.items) ? body.items : []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load Clinical Cases.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // Initial authoritative register load only. Search applies on submit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCount = useMemo(
    () => items.filter((item) => ['open', 'active', 'in_progress'].includes(item.status)).length,
    [items],
  );

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
          Longitudinal clinical continuity
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
          Clinical Cases
        </h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-gray-600">
          Persistent patient-centred Cases. Each Case can span multiple encounters,
          prescriptions, investigations, results, orders and follow-up activity.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
          <span className="rounded-full border bg-slate-50 px-3 py-1">{items.length} loaded</span>
          <span className="rounded-full border bg-slate-50 px-3 py-1">{openCount} open / active</span>
        </div>
      </header>

      <form
        className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-[1fr_220px_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search patient, MRN, case ID, title or clinician reference"
          className="rounded-xl border px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-xl border px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="active">Active</option>
          <option value="in_progress">In progress</option>
          <option value="closed">Closed</option>
          <option value="archived">Archived</option>
        </select>
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-slate-950 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Search'}
        </button>
      </form>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        {loading && !items.length ? (
          <div className="p-6 text-sm text-slate-500">Loading the Case register…</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">
            No Clinical Cases match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Case / patient</th>
                  <th className="px-4 py-3">Lead clinician</th>
                  <th className="px-4 py-3">State</th>
                  <th className="px-4 py-3">Encounters</th>
                  <th className="px-4 py-3">Last activity</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-950">{item.title || 'Clinical case'}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.patient?.name || item.patientId}
                        {item.patient?.mrn ? ` • MRN ${item.patient.mrn}` : ''}
                      </div>
                      <div className="mt-1 font-mono text-[10px] text-slate-400">{item.id}</div>
                    </td>
                    <td className="px-4 py-4">
                      {item.leadClinician?.displayName || '—'}
                      <div className="text-xs text-slate-500">{item.leadClinician?.specialty || ''}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full border bg-slate-50 px-2 py-1 text-xs">{item.status}</span>
                      <div className="mt-1 text-xs text-slate-500">{item.priority}</div>
                    </td>
                    <td className="px-4 py-4">{item.encounterCount}</td>
                    <td className="px-4 py-4 text-xs text-slate-600">
                      {new Date(item.updatedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/cases/${encodeURIComponent(item.id)}`}
                        className="font-semibold text-teal-700"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
