// apps/patient-app/components/MedicationsBlockWrapper.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, PauseCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import ExportMedButton from './ExportMedButton';

type Medication = {
  id: string;
  name: string;
  dose?: string;
  frequency?: string;
  route?: string;
  started?: string;
  lastFilled?: string;
  status?: string;
  orderId?: string | null;
};

function normaliseMedication(item: any, index: number): Medication | null {
  if (!item || typeof item !== 'object') return null;
  const id = String(item.id ?? item.medicationId ?? item.orderId ?? '').trim();
  const name = String(item.name ?? item.drug ?? item.display ?? item.title ?? '').trim();
  if (!id || !name) return null;

  return {
    id,
    name,
    dose: item.dose == null ? undefined : String(item.dose),
    frequency: item.frequency == null ? undefined : String(item.frequency),
    route: item.route == null ? undefined : String(item.route),
    started: item.started == null ? item.startedAt == null ? undefined : String(item.startedAt) : String(item.started),
    lastFilled: item.lastFilled == null ? undefined : String(item.lastFilled),
    status: item.status == null ? undefined : String(item.status),
    orderId: item.orderId == null ? null : String(item.orderId),
  };
}

function statusClasses(status?: string) {
  const raw = String(status || '').toLowerCase();
  if (raw.includes('complete') || raw.includes('taken') || raw.includes('active')) {
    return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  }
  if (raw.includes('hold') || raw.includes('pause')) {
    return 'border-amber-100 bg-amber-50 text-amber-700';
  }
  if (raw.includes('miss') || raw.includes('stop')) {
    return 'border-rose-100 bg-rose-50 text-rose-700';
  }
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function dateLabel(value?: string) {
  if (!value) return 'Start date not recorded';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Start date not recorded';
  return `Started ${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export default function MedicationsBlockWrapper({ initialMeds }: { initialMeds?: Medication[] }) {
  const [meds, setMeds] = useState<Medication[]>(() =>
    Array.isArray(initialMeds) ? initialMeds.filter((m) => m?.id && m?.name) : [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/medications', { cache: 'no-store' });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
      }

      const raw = Array.isArray(data)
        ? data
        : Array.isArray(data?.meds)
          ? data.meds
          : Array.isArray(data?.medications)
            ? data.medications
            : Array.isArray(data?.items)
              ? data.items
              : [];

      setMeds(raw.map(normaliseMedication).filter(Boolean) as Medication[]);
    } catch (err: any) {
      setError(err?.message || 'Medication plan could not be refreshed.');
      if (!initialMeds?.length) setMeds([]);
    } finally {
      setLoading(false);
    }
  }, [initialMeds?.length]);

  useEffect(() => {
    if (!initialMeds?.length) void load();
  }, [initialMeds?.length, load]);

  const activeCount = useMemo(
    () => meds.filter((m) => !String(m.status || '').toLowerCase().includes('hold')).length,
    [meds],
  );

  async function handleUpdateStatus(id: string, status: string) {
    try {
      const res = await fetch('/api/medications', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Update failed');

      setMeds((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
      return data;
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Medication plan
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {activeCount > 0 ? `${activeCount} active item${activeCount === 1 ? '' : 's'}` : 'No active item recorded'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportMedButton />
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3 text-sm leading-6 text-amber-800">
          Medication data was not refreshed. The latest visible plan remains available.
        </div>
      ) : null}

      {loading && meds.length === 0 ? (
        <div className="space-y-2">
          <div className="h-16 animate-pulse rounded-2xl bg-slate-100/80" />
          <div className="h-16 animate-pulse rounded-2xl bg-slate-100/60" />
        </div>
      ) : null}

      {!loading && meds.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-slate-200 bg-white/72 p-4 text-sm leading-6 text-slate-600">
          <div className="font-semibold text-slate-900">No active medication plan</div>
          <p className="mt-1">Add medicines or prescriptions to track adherence and improve your care picture.</p>
        </div>
      ) : null}

      {meds.length > 0 ? (
        <ul className="space-y-2.5">
          {meds.slice(0, 4).map((m) => (
            <li key={m.id} className="rounded-[22px] border border-white/75 bg-white/88 p-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {m.name}
                    {m.dose ? <span className="font-medium text-slate-500"> • {m.dose}</span> : null}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    {[m.frequency, m.route].filter(Boolean).join(' • ') || 'Directions not recorded'}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">{dateLabel(m.started)}</div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusClasses(m.status)}`}>
                    {m.status || 'Recorded'}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => void handleUpdateStatus(m.id, 'Completed')}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
                      aria-label={`Mark ${m.name} as completed`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleUpdateStatus(m.id, String(m.status).toLowerCase().includes('hold') ? 'Active' : 'On Hold')}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-100 bg-amber-50 text-amber-700 transition hover:bg-amber-100"
                      aria-label={`Toggle hold for ${m.name}`}
                    >
                      <PauseCircle className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
