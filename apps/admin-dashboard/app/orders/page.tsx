//apps/admin-dashboard/app/orders/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Tooltip from '@/components/Tooltip';

/** ---------- Types ---------- */
type Row = {
  id: string;
  kind: 'pharmacy' | 'lab';
  encounterId: string;
  sessionId: string;
  caseId: string;
  createdAt?: string;
  title?: string;
  details?: string;
  priceZAR?: number;
  status?: 'pending' | 'in-progress' | 'done' | 'failed';
  site?: string; // useful for labs
};

/** ---------- Small chart primitives (inline, no deps) ---------- */
function Sparkline({ values }: { values: number[] }) {
  const w = 120,
    h = 36,
    pad = 2;
  const max = Math.max(...values, 1);
  const stepX = (w - pad * 2) / Math.max(1, values.length - 1);
  const pts = values
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = h - pad - (v / max) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-[120px] h-[36px]">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.2"
        strokeWidth="1"
        points={`${pad},${h - pad} ${w - pad},${h - pad}`}
      />
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        points={pts}
      />
      <title>Orders per time bucket (mock trend – real series later)</title>
    </svg>
  );
}

function Donut({ pct, label }: { pct: number; label: string }) {
  const r = 18,
    c = 24,
    size = 48,
    len = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = len * (1 - clamped / 100);
  return (
    <svg viewBox="0 0 48 48" className="w-12 h-12">
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.15"
        strokeWidth="6"
      />
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeDasharray={len}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${c} ${c})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize="10"
        fill="currentColor"
      >
        {clamped}%
      </text>
      <title>{label}</title>
    </svg>
  );
}

/** ---------- URL helper ---------- */
function writeParams(url: URL, obj: Record<string, string>) {
  Object.entries(obj).forEach(([k, v]) => {
    if (!v) url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  });
  return url;
}

/** ---------- Page ---------- */
type StatusFilter = 'all' | 'pending' | 'in-progress' | 'done' | 'failed';
type KindFilter = 'all' | 'pharmacy' | 'lab';

export default function OrdersMerged() {
  const router = useRouter();
  const search = useSearchParams();

  // shareable query string (for /orders <-> /orders/analytics links)
  const qs = search.toString();
  const analyticsHref = qs ? `/orders/analytics?${qs}` : '/orders/analytics';

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // filters – initial state hydrated from query params
  const [status, setStatus] = useState<StatusFilter>(
    () => (search.get('status') as StatusFilter) || 'all',
  );
  const [kind, setKind] = useState<KindFilter>(
    () => (search.get('kind') as KindFilter) || 'all',
  );
  const [q, setQ] = useState(() => search.get('q') || '');
  const [dateFrom, setDateFrom] = useState(() => search.get('from') || '');
  const [dateTo, setDateTo] = useState(() => search.get('to') || '');

  // SLA values are not used on this page,
  // but we read + round-trip them so analytics view stays perfectly in sync.
  const [pharmSlaH] = useState(() => {
    const raw = search.get('phSLA');
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 4;
  });
  const [labSlaH] = useState(() => {
    const raw = search.get('lbSLA');
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 48;
  });

  // keep URL query params in sync with filter state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = writeParams(new URL(window.location.href), {
      q,
      status,
      kind,
      from: dateFrom,
      to: dateTo,
      phSLA: String(pharmSlaH),
      lbSLA: String(labSlaH),
    });
    router.replace(url.pathname + url.search, { scroll: false });
  }, [q, status, kind, dateFrom, dateTo, pharmSlaH, labSlaH, router]);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch('/api/orders/index?scope=all', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setRows(Array.isArray(j) ? j : []);
    } catch (e: any) {
      // demo fallback so the page is still useful
      setRows([
        {
          id: 'rx-10021',
          kind: 'pharmacy',
          encounterId: 'enc-za-001',
          sessionId: 'sess-01',
          caseId: 'case-01',
          createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
          title: 'Amlodipine 5mg',
          details: '1 tab daily × 30',
          priceZAR: 142.5,
          status: 'done',
        },
        {
          id: 'lab-33222',
          kind: 'lab',
          encounterId: 'enc-za-004',
          sessionId: 'sess-05',
          caseId: 'case-12',
          createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
          title: 'HbA1c',
          details: 'Glycated hemoglobin',
          priceZAR: 180,
          status: 'in-progress',
          site: 'Ambulant Labs — Cape Town',
        },
      ]);
      setErr(e?.message || 'Fell back to demo data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let list = rows.slice();
    if (status !== 'all') list = list.filter((r) => (r.status ?? 'pending') === status);
    if (kind !== 'all') list = list.filter((r) => r.kind === kind);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.id.toLowerCase().includes(needle) ||
          r.encounterId.toLowerCase().includes(needle) ||
          (r.title || '').toLowerCase().includes(needle) ||
          (r.details || '').toLowerCase().includes(needle),
      );
    }
    if (dateFrom)
      list = list.filter(
        (r) => !r.createdAt || new Date(r.createdAt) >= new Date(dateFrom),
      );
    if (dateTo)
      list = list.filter(
        (r) =>
          !r.createdAt ||
          new Date(r.createdAt) <= new Date(dateTo + 'T23:59:59'),
      );
    return list;
  }, [rows, status, kind, q, dateFrom, dateTo]);

  /** KPIs */
  const kpis = useMemo(() => {
    const total = filtered.length;
    const done = filtered.filter((r) => r.status === 'done').length;
    const inprog = filtered.filter((r) => r.status === 'in-progress').length;
    const pharm = filtered.filter((r) => r.kind === 'pharmacy').length;
    const labs = filtered.filter((r) => r.kind === 'lab').length;
    const rev = filtered.reduce((s, r) => s + (r.priceZAR || 0), 0);
    return { total, done, inprog, pharm, labs, rev };
  }, [filtered]);

  const sparkVals = useMemo(() => {
    // simple mock trend for now
    return Array.from({ length: 12 }, (_, i) =>
      Math.round(20 + Math.sin(i / 2) * 10 + Math.random() * 10),
    );
  }, [rows.length]);

  const completionPct = kpis.total
    ? Math.round((kpis.done / kpis.total) * 100)
    : 0;

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Orders — Merged</h1>
          <p className="text-sm text-gray-500 mt-1">
            Unified view across CarePort (pharmacy) and MedReach (lab) orders
            with fast filters and deep links.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            href={analyticsHref}
            className="inline-flex items-center rounded-lg border bg-white px-3 py-2 hover:bg-gray-50"
          >
            Analytics
          </Link>
          <Link
            href="/careport"
            className="inline-flex items-center rounded-lg border bg-white px-3 py-2 hover:bg-gray-50"
          >
            Open CarePort
          </Link>
          <Link
            href="/medreach"
            className="inline-flex items-center rounded-lg border bg-white px-3 py-2 hover:bg-gray-50"
          >
            Open MedReach
          </Link>
        </div>
      </header>

      {/* KPIs */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs text-gray-500">Total Orders</div>
          <div className="text-2xl font-semibold">{kpis.total}</div>
          <div className="mt-2 text-gray-700">
            <Tooltip label="Relative trend of orders over recent periods (mocked until backend exposes a proper series).">
              <span>
                <Sparkline values={sparkVals} />
              </span>
            </Tooltip>
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500">Completion</div>
              <div className="text-2xl font-semibold">{completionPct}%</div>
            </div>
            <Tooltip label="Completed vs total orders in this filtered view.">
              <span>
                <Donut pct={completionPct} label="Completion" />
              </span>
            </Tooltip>
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            {kpis.done} done • {kpis.inprog} in progress
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs text-gray-500">Pharmacy</div>
          <div className="text-2xl font-semibold">{kpis.pharm}</div>
          <div className="text-[11px] text-gray-500 mt-1">
            <Link href="/careport/orders" className="underline">
              Rider timelines →
            </Link>
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs text-gray-500">Lab</div>
          <div className="text-2xl font-semibold">{kpis.labs}</div>
          <div className="text-[11px] text-gray-500 mt-1">
            <Link href="/medreach/orders" className="underline">
              Phleb timelines →
            </Link>
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs text-gray-500">Est. Revenue</div>
          <div className="text-2xl font-semibold">
            R {kpis.rev.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            Sum of listed order prices
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs text-gray-500">Quality</div>
          <div className="text-2xl font-semibold">OK</div>
          <div className="text-[11px] text-gray-500 mt-1">
            No critical incidents reported
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="rounded-2xl border bg-white p-4">
        <div className="grid md:grid-cols-6 gap-2">
          <div className="md:col-span-2">
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="Search by ID, encounter, title…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            className="border rounded px-2 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
          >
            {['all', 'pending', 'in-progress', 'done', 'failed'].map((s) => (
              <option key={s} value={s}>
                {s === 'in-progress'
                  ? 'In progress'
                  : s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <select
            className="border rounded px-2 py-2 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as KindFilter)}
          >
            {['all', 'pharmacy', 'lab'].map((k) => (
              <option key={k} value={k}>
                {k[0].toUpperCase() + k.slice(1)}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="border rounded px-2 py-2 text-sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <input
            type="date"
            className="border rounded px-2 py-2 text-sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={load}
            className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50 text-sm"
          >
            Refresh
          </button>
          <button
            onClick={() => {
              setQ('');
              setStatus('all');
              setKind('all');
              setDateFrom('');
              setDateTo('');
            }}
            className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50 text-sm"
          >
            Clear
          </button>
        </div>
      </section>

      {/* Table */}
      <section className="rounded-2xl border overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="p-2 text-left">ID</th>
              <th className="p-2 text-left">Kind</th>
              <th className="p-2 text-left">Title</th>
              <th className="p-2 text-left">Encounter</th>
              <th className="p-2 text-left">Session</th>
              <th className="p-2 text-left">Created</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2 font-mono text-xs">{r.id}</td>
                <td className="p-2 text-xs capitalize">{r.kind}</td>
                <td className="p-2">
                  <div className="text-sm">{r.title || '-'}</div>
                  {(r.details || r.site) && (
                    <div className="text-xs text-gray-500 truncate max-w-xs">
                      {[r.details, r.site].filter(Boolean).join(' • ')}
                    </div>
                  )}
                </td>
                <td className="p-2 text-xs">{r.encounterId}</td>
                <td className="p-2 text-xs">{r.sessionId}</td>
                <td className="p-2 text-xs">
                  {r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}
                </td>
                <td className="p-2 text-xs space-x-2">
                  <Link
                    href={`/cases/${r.encounterId}`}
                    className="underline text-gray-700"
                  >
                    Case
                  </Link>
                  {r.kind === 'pharmacy' ? (
                    <Link
                      href="/careport/orders"
                      className="underline text-indigo-700"
                    >
                      CarePort
                    </Link>
                  ) : (
                    <Link
                      href="/medreach/orders"
                      className="underline text-teal-700"
                    >
                      MedReach
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr>
                <td className="p-4 text-center text-gray-500" colSpan={7}>
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {err && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
          {err}
        </div>
      )}
    </main>
  );
}
