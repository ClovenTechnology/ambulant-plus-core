// apps/patient-app/app/insights/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

const APIGW = process.env.NEXT_PUBLIC_APIGW_BASE ?? 'http://localhost:3010';

type InboxItem = {
  id: string;
  ts: string | number;
  kind: string;
  encounterId?: string | null;
  payload?: any; // could be object or string
};

function getUid() {
  if (typeof window === 'undefined') return 'server-user';
  const key = 'ambulant_uid';
  let v = localStorage.getItem(key);
  if (!v) {
    v = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + '-u';
    localStorage.setItem(key, v);
  }
  return v;
}

function safeJsonParse(x: any) {
  if (!x) return null;
  if (typeof x === 'object') return x;
  if (typeof x === 'string') {
    try { return JSON.parse(x); } catch { return { raw: x }; }
  }
  return { raw: String(x) };
}

function fmtTime(ts: any) {
  try {
    const n = typeof ts === 'string' ? Number(ts) : ts;
    const d = new Date(Number.isFinite(n) ? n : ts);
    return d.toLocaleString();
  } catch {
    return String(ts);
  }
}

export default function PatientInsightsPage() {
  const [patientId, setPatientId] = useState<string>(''); // defaults to uid
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all'|'steth'|'ecg'|'ppg'|'image'|'other'>('all');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const uid = getUid();
    setPatientId(uid);
  }, []);

  async function load() {
    if (!patientId) return;
    setLoading(true);
    setErr(null);

    try {
      const url = new URL(`${APIGW}/api/events/inbox`);
      url.searchParams.set('patientId', patientId);

      // optional: your inbox endpoint may support kinds; if not, harmless
      url.searchParams.set('kinds', 'insight.ai.steth,insight.ai.ecg,insight.ai.ppg,insight.ai.image,insight.ai.other');

      const res = await fetch(url.toString(), {
        cache: 'no-store',
        headers: {
          'x-role': 'patient',
          'x-uid': patientId,
        },
      });

      const data = await res.json().catch(() => ({}));
      const arr: any[] =
        (Array.isArray(data) ? data : null) ||
        (Array.isArray(data.items) ? data.items : null) ||
        (Array.isArray(data.events) ? data.events : null) ||
        [];

      const normalized: InboxItem[] = arr.map((e: any) => ({
        id: String(e.id ?? e.eventId ?? crypto.randomUUID()),
        ts: e.ts ?? e.createdAt ?? Date.now(),
        kind: String(e.kind ?? ''),
        encounterId: e.encounterId ?? null,
        payload: e.payload,
      }));

      // newest first
      normalized.sort((a, b) => Number(b.ts) - Number(a.ts));
      setItems(normalized);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (patientId) load(); /* eslint-disable-next-line */ }, [patientId]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((it) => {
      if (!it.kind.startsWith('insight.ai.')) return false;

      const mod = it.kind.split('.').pop() || 'other';
      if (filter !== 'all' && mod !== filter) return false;

      if (!needle) return true;
      const p = safeJsonParse(it.payload);
      const text = JSON.stringify({ kind: it.kind, payload: p }).toLowerCase();
      return text.includes(needle);
    });
  }, [items, q, filter]);

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-5">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Insights</h1>
          <p className="text-sm text-gray-500 mt-1">
            Your AI insights from consultations and device streams (persisted via events).
          </p>
        </div>

        <div className="flex gap-2 items-center">
          <button
            onClick={load}
            className="px-3 py-2 rounded border hover:bg-gray-50 text-sm"
            disabled={loading}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      <section className="bg-white border rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex gap-2 items-center">
            <label className="text-xs text-gray-500">Filter</label>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
            >
              <option value="all">All</option>
              <option value="steth">Steth (audio)</option>
              <option value="ecg">ECG</option>
              <option value="ppg">PPG</option>
              <option value="image">Image/Video</option>
              <option value="other">Other</option>
            </select>
          </div>

          <input
            className="border rounded px-3 py-2 text-sm w-full sm:w-[360px]"
            placeholder="Search insights (label, modelVersion, text...)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {err && <div className="text-sm text-rose-600">Error: {err}</div>}

        <div className="divide-y">
          {filtered.map((it) => {
            const p = safeJsonParse(it.payload);
            const ann = p?.annotation ?? p?.payload?.annotation ?? p?.raw?.annotation ?? null;
            const label = ann?.label ?? p?.annotation?.label ?? p?.label ?? '—';
            const conf = typeof ann?.conf === 'number' ? ann.conf : undefined;
            const modelVersion = ann?.modelVersion ?? p?.modelVersion ?? '—';
            const modality = it.kind.split('.').pop() || 'other';

            return (
              <div key={it.id} className="py-3 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded-full border bg-gray-50">
                        {modality}
                      </span>
                      <span className="font-medium">{label}</span>
                      {conf !== undefined && (
                        <span className="text-xs text-gray-500">conf {conf.toFixed(2)}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {fmtTime(it.ts)} • model {modelVersion}
                      {it.encounterId ? ` • encounter ${it.encounterId}` : ''}
                    </div>
                  </div>

                  <details className="text-xs">
                    <summary className="cursor-pointer text-gray-500 hover:text-gray-700 select-none">
                      Details
                    </summary>
                    <pre className="mt-2 p-2 bg-slate-50 border rounded overflow-auto max-h-64">
{JSON.stringify(p, null, 2)}
                    </pre>
                  </details>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-6 text-sm text-gray-500 text-center">
              No insights yet. Generate one from a consultation/device stream, then refresh.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
