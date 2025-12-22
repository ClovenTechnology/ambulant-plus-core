// apps/admin-dashboard/app/settings/insightcore/simulator/page.tsx
'use client';

import { useEffect, useState } from 'react';

type Alert = {
  id: string;
  patient: string;
  type: string;
  score: number;
  ts: string;
  note?: string;
};

function severityColor(score: number): string {
  if (!Number.isFinite(score)) return 'bg-gray-200 text-gray-700';
  if (score >= 0.85) return 'bg-red-100 text-red-800';
  if (score >= 0.7) return 'bg-amber-100 text-amber-800';
  return 'bg-emerald-100 text-emerald-800';
}

export default function AlertSimulator() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [patient, setPatient] = useState('Thandi Mokoena');
  const [type, setType] = useState('Heart risk');
  const [score, setScore] = useState(0.72);
  const [note, setNote] = useState('Persistent tachycardia over threshold');
  const [pushing, setPushing] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      const d = await fetch('/api/insightcore/alerts', {
        cache: 'no-store',
      }).then((r) => r.json());
      setAlerts(Array.isArray(d.alerts) ? d.alerts : []);
    } catch (e: any) {
      console.error('load alerts failed', e);
      setErr(e?.message || 'Failed to load recent alerts');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function push() {
    try {
      setPushing(true);
      setErr(null);
      const res = await fetch('/api/insightcore/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient,
          type,
          score,
          note,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (e: any) {
      console.error('push alert failed', e);
      setErr(e?.message || 'Failed to create alert');
    } finally {
      setPushing(false);
    }
  }

  const orderedAlerts = alerts.slice().sort((a, b) =>
    a.ts < b.ts ? 1 : -1,
  );

  return (
    <main className="space-y-5">
      {/* Header */}
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            InsightCore — alert simulator
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Generate synthetic alerts to test routing, triage queues and
            notifications without touching live patients.
          </p>
        </div>
        <div className="text-[11px] text-gray-500">
          Hitting <code className="rounded bg-gray-100 px-1">POST
          /api/insightcore/alerts</code> behind the scenes.
        </div>
      </header>

      {err && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {err}
        </div>
      )}

      {/* Form + preview */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1 rounded-2xl border bg-white p-4 space-y-3 shadow-sm text-sm">
          <div className="text-sm font-medium text-gray-900">
            Compose test alert
          </div>
          <div className="grid gap-3">
            <label className="text-xs space-y-1">
              <span className="text-gray-700">Patient</span>
              <input
                className="w-full rounded border px-2 py-1 text-sm"
                value={patient}
                onChange={(e) => setPatient(e.target.value)}
              />
            </label>

            <label className="text-xs space-y-1">
              <span className="text-gray-700">Alert type</span>
              <input
                className="w-full rounded border px-2 py-1 text-sm"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="e.g. Heart risk, SpO₂ low, BP spike"
              />
            </label>

            <label className="text-xs space-y-1">
              <span className="text-gray-700">Risk score (0–1)</span>
              <input
                type="number"
                step="0.01"
                min={0}
                max={1}
                className="w-32 rounded border px-2 py-1 text-sm"
                value={score}
                onChange={(e) =>
                  setScore(
                    Math.max(
                      0,
                      Math.min(1, parseFloat(e.target.value || '0')),
                    ),
                  )
                }
              />
            </label>

            <label className="text-xs space-y-1">
              <span className="text-gray-700">Note</span>
              <textarea
                className="w-full rounded border px-2 py-1 text-sm"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>

            <button
              onClick={push}
              disabled={pushing}
              className="mt-1 inline-flex items-center rounded-md border border-black bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pushing ? 'Generating…' : 'Generate alert'}
            </button>
          </div>
        </div>

        {/* Recent alerts timeline */}
        <div className="lg:col-span-2 rounded-2xl border bg-white p-4 shadow-sm text-sm">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-900">
                Recent synthetic alerts
              </div>
              <div className="text-[11px] text-gray-500">
                Most recent first. Use this to verify queues, SLAs and channel
                routing.
              </div>
            </div>
            {loading && (
              <div className="text-[11px] text-gray-400">
                Loading alerts…
              </div>
            )}
          </div>

          <ul className="divide-y text-sm">
            {orderedAlerts.length === 0 && !loading && (
              <li className="py-3 text-xs text-gray-500">
                No alerts yet. Create one on the left to test InsightCore.
              </li>
            )}
            {orderedAlerts.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {a.type}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${severityColor(
                        a.score,
                      )}`}
                    >
                      score {a.score.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-600">
                    {a.patient} • {a.ts}
                  </div>
                  {a.note && (
                    <div className="text-[11px] text-gray-700">
                      {a.note}
                    </div>
                  )}
                </div>
                <div className="mt-1 text-[11px] text-gray-500 sm:mt-0">
                  Synthetic • {a.id}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
