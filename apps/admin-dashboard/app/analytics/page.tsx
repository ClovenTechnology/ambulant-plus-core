// apps/admin-dashboard/app/analytics/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

/* ---------- Types ---------- */

type Kpi = { label: string; value: string | number; sub?: string };

type RevenuePoint = {
  label: string; // e.g. "Jan", "Feb"
  total: number;
  careport: number;
  medreach: number;
  rx: number;
};

type MixItem = { label: string; value: number };

type GeoRow = {
  province: string;
  revenueZAR: number;
  patients: number;
  consults: number;
};

type CohortRow = {
  label: string;
  patients: number;
  sharePct: number;
};

type EntityRow = {
  label: string;
  kind: 'Pharmacy' | 'Lab' | 'Clinician';
  revenueZAR: number;
  orders: number;
  location?: string;
};

type OverviewPayload = {
  kpis: Kpi[];
  revenueSeries: RevenuePoint[];
  productMix: MixItem[];
  geo: GeoRow[];
  cohorts: CohortRow[];
  topEntities: EntityRow[];
};

/* 🔔 InsightCore alerts types (for risk KPI) */
type AlertSeverity = 'low' | 'moderate' | 'high' | 'critical';

type InsightAlert = {
  id: string;
  patientId?: string | null;
  patientName?: string | null;
  severity: AlertSeverity;
  ts: string;
};

/* ---------- Mock data (fallback until API is wired) ---------- */

const MOCK_OVERVIEW: OverviewPayload = {
  kpis: [
    {
      label: 'Total Revenue (LTM)',
      value: 'R 1,240,000',
      sub: '+12% vs prior 12m',
    },
    { label: 'Active Patients', value: 18_240, sub: '+4% MoM' },
    {
      label: 'Active Clinicians',
      value: 1_260,
      sub: 'A: 420 • B: 620 • C: 220',
    },
    { label: 'IoMT Devices', value: 9, sub: '7 streaming in last 24h' },
    { label: 'Rx Revenue', value: 'R 310,500', sub: 'eRx + renewals' },
    {
      label: 'Total Payout',
      value: 'R 870,000',
      sub: 'Clinicians + riders + phlebs',
    },
    {
      label: 'CarePort Revenue',
      value: 'R 182,400',
      sub: 'incl. riders',
    },
    {
      label: 'MedReach Revenue',
      value: 'R 226,900',
      sub: 'draws + lab rev share',
    },
    { label: '# Rider Payouts (CarePort)', value: 742, sub: 'avg R122/job' },
    { label: '# Phleb Payouts (MedReach)', value: 311, sub: 'avg R141/draw' },
    {
      label: 'Ambulant+ Earnings (net)',
      value: 'R 344,800',
      sub: 'after all payouts',
    },
    { label: 'Total Refunds', value: 'R 12,600', sub: '0.9% of GMV' },
  ],
  revenueSeries: [
    { label: 'Jan', total: 80, careport: 28, medreach: 22, rx: 30 },
    { label: 'Feb', total: 86, careport: 30, medreach: 24, rx: 32 },
    { label: 'Mar', total: 94, careport: 32, medreach: 26, rx: 36 },
    { label: 'Apr', total: 100, careport: 34, medreach: 28, rx: 38 },
    { label: 'May', total: 112, careport: 39, medreach: 32, rx: 41 },
    { label: 'Jun', total: 118, careport: 42, medreach: 34, rx: 42 },
    { label: 'Jul', total: 124, careport: 44, medreach: 36, rx: 44 },
    { label: 'Aug', total: 131, careport: 46, medreach: 38, rx: 47 },
    { label: 'Sep', total: 138, careport: 48, medreach: 40, rx: 50 },
    { label: 'Oct', total: 142, careport: 49, medreach: 42, rx: 51 },
    { label: 'Nov', total: 148, careport: 51, medreach: 44, rx: 53 },
    { label: 'Dec', total: 155, careport: 54, medreach: 46, rx: 55 },
  ],
  productMix: [
    { label: 'Rx & Consult', value: 38 },
    { label: 'CarePort (pharmacy)', value: 27 },
    { label: 'MedReach (lab)', value: 24 },
    { label: 'Other services', value: 11 },
  ],
  geo: [
    {
      province: 'Gauteng',
      revenueZAR: 520_000,
      patients: 8_400,
      consults: 11_200,
    },
    {
      province: 'Western Cape',
      revenueZAR: 280_000,
      patients: 4_200,
      consults: 6_700,
    },
    {
      province: 'KZN',
      revenueZAR: 170_000,
      patients: 2_900,
      consults: 4_100,
    },
    {
      province: 'Eastern Cape',
      revenueZAR: 80_000,
      patients: 1_400,
      consults: 1_900,
    },
    {
      province: 'Other provinces',
      revenueZAR: 190_000,
      patients: 3_340,
      consults: 4_600,
    },
  ],
  cohorts: [
    { label: '0–17 (Paeds)', patients: 2_100, sharePct: 12 },
    { label: '18–39 (Young adult)', patients: 7_900, sharePct: 43 },
    { label: '40–64 (Adult)', patients: 5_800, sharePct: 32 },
    { label: '65+ (Senior)', patients: 2_440, sharePct: 13 },
  ],
  topEntities: [
    {
      label: 'MedExpress — Sandton',
      kind: 'Pharmacy',
      revenueZAR: 142_300,
      orders: 980,
      location: 'Gauteng',
    },
    {
      label: 'Ambulant Labs — Cape Town',
      kind: 'Lab',
      revenueZAR: 126_900,
      orders: 610,
      location: 'Western Cape',
    },
    {
      label: 'Dr Naidoo (GP)',
      kind: 'Clinician',
      revenueZAR: 94_500,
      orders: 440,
      location: 'Gauteng',
    },
    {
      label: 'PathCare Sandton',
      kind: 'Lab',
      revenueZAR: 88_200,
      orders: 390,
      location: 'Gauteng',
    },
    {
      label: 'Dr Mbele (Physician)',
      kind: 'Clinician',
      revenueZAR: 82_700,
      orders: 360,
      location: 'KZN',
    },
    {
      label: 'CityMeds — CBD',
      kind: 'Pharmacy',
      revenueZAR: 76_100,
      orders: 340,
      location: 'Western Cape',
    },
  ],
};

const PROVINCES = [
  'All',
  'Gauteng',
  'KZN',
  'Western Cape',
  'Eastern Cape',
  'Free State',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Limpopo',
];
const GENDERS = ['All', 'Male', 'Female', 'Other'];
const AGE_BANDS = ['All', '0–17', '18–39', '40–64', '65+'] as const;

type RangeKey = '7d' | '30d' | '90d' | '12m';

/* ---------- Tiny UI primitives ---------- */

function MetricCard({ label, value, sub }: Kpi) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {sub && <div className="mt-1 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

function Donut({ items }: { items: MixItem[] }) {
  const size = 170;
  const stroke = 30;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const total = Math.max(items.reduce((s, i) => s + i.value, 0), 1);
  let acc = 0;

  const colors = ['#4f46e5', '#0f766e', '#f97316', '#6b7280'];

  const top = items[0];

  return (
    <div className="flex items-center gap-4">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-[180px] w-[180px]">
        <circle cx={c} cy={c} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        {items.map((seg, idx) => {
          const segLen = (seg.value / total) * circ;
          const offset = circ - acc - segLen;
          acc += segLen;
          return (
            <circle
              key={seg.label}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={colors[idx % colors.length]}
              strokeWidth={stroke}
              strokeDasharray={`${segLen} ${circ - segLen}`}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform={`rotate(-90 ${c} ${c})`}
            >
              <title>
                {seg.label}: {Math.round((seg.value / total) * 100)}%
              </title>
            </circle>
          );
        })}
        <text
          x="50%"
          y="45%"
          textAnchor="middle"
          className="fill-gray-900 text-[20px] font-semibold"
        >
          {Math.round((top.value / total) * 100)}%
        </text>
        <text
          x="50%"
          y="60%"
          textAnchor="middle"
          className="fill-gray-500 text-[11px]"
        >
          {top.label}
        </text>
      </svg>
      <div className="space-y-2 text-xs">
        {items.map((seg, idx) => {
          const pct = Math.round((seg.value / total) * 100);
          return (
            <div key={seg.label} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: colors[idx % colors.length] }}
                />
                <span className="text-gray-700">{seg.label}</span>
              </div>
              <span className="tabular-nums text-gray-500">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GeoBar({ row, max }: { row: GeoRow; max: number }) {
  const pct = max ? (row.revenueZAR / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-800">{row.province}</span>
        <span className="tabular-nums text-gray-500">R {row.revenueZAR.toLocaleString()}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100">
        <div className="h-2 rounded-full bg-gray-900" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between text-[11px] text-gray-500">
        <span>{row.patients.toLocaleString()} pts</span>
        <span>{row.consults.toLocaleString()} consults</span>
      </div>
    </div>
  );
}

function CohortRowView({ row }: { row: CohortRow }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="space-y-0.5">
        <div className="font-medium text-gray-800">{row.label}</div>
        <div className="text-gray-500">{row.patients.toLocaleString()} patients</div>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-24 rounded-full bg-gray-100">
          <div className="h-1.5 rounded-full bg-gray-900" style={{ width: `${row.sharePct}%` }} />
        </div>
        <span className="tabular-nums text-gray-600">{row.sharePct}%</span>
      </div>
    </div>
  );
}

function EntityTable({ rows }: { rows: EntityRow[] }) {
  return (
    <table className="w-full text-xs">
      <thead className="border-b bg-gray-50 text-gray-500">
        <tr className="text-left">
          <th className="px-3 py-2 font-medium">Entity</th>
          <th className="px-3 py-2 font-medium">Type</th>
          <th className="px-3 py-2 font-medium">Location</th>
          <th className="px-3 py-2 font-medium text-right">Orders</th>
          <th className="px-3 py-2 font-medium text-right">Revenue</th>
        </tr>
      </thead>
      <tbody>
        {rows.length ? (
          rows.map((r) => (
            <tr key={r.label} className="border-b last:border-0">
              <td className="px-3 py-2 text-sm text-gray-900">{r.label}</td>
              <td className="px-3 py-2 text-[11px] text-gray-600">{r.kind}</td>
              <td className="px-3 py-2 text-[11px] text-gray-500">{r.location || '—'}</td>
              <td className="px-3 py-2 text-right text-sm text-gray-800 tabular-nums">
                {r.orders.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right text-sm text-gray-800 tabular-nums">
                R {r.revenueZAR.toLocaleString()}
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={5} className="px-3 py-4 text-center text-xs text-gray-500">
              No entities found for this view.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/* ---------- Canvas revenue chart ---------- */

function drawRevenueChart(canvas: HTMLCanvasElement, points: RevenuePoint[]) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !points.length) return;

  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || 600;
  const cssHeight = 260;

  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  ctx.scale(dpr, dpr);

  const w = cssWidth;
  const h = cssHeight;
  const padLeft = 40;
  const padRight = 16;
  const padTop = 24;
  const padBottom = 32;

  ctx.clearRect(0, 0, w, h);

  const totals = points.map((p) => p.total);
  const maxVal = Math.max(...totals, 1);
  const stepX = points.length === 1 ? 0 : (w - padLeft - padRight) / (points.length - 1);

  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padLeft, h - padBottom);
  ctx.lineTo(w - padRight, h - padBottom);
  ctx.stroke();

  ctx.fillStyle = '#9ca3af';
  ctx.font = '10px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  [0, 0.5, 1].forEach((f) => {
    const y = h - padBottom - f * (h - padTop - padBottom);
    const val = Math.round(maxVal * f);
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(w - padRight, y);
    ctx.strokeStyle = f === 0 ? '#e5e7eb' : '#f3f4f6';
    ctx.stroke();
    ctx.fillText(`R ${val}k`, 4, y + 3);
  });

  function lineFor(extract: (p: RevenuePoint) => number, color: string) {
    ctx.beginPath();
    points.forEach((p, idx) => {
      const x = padLeft + idx * stepX;
      const y = h - padBottom - (extract(p) / maxVal) * (h - padTop - padBottom);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  lineFor((p) => p.total, '#111827');
  lineFor((p) => p.careport, '#4f46e5');
  lineFor((p) => p.medreach, '#0f766e');
  lineFor((p) => p.rx, '#f97316');

  ctx.fillStyle = '#9ca3af';
  ctx.textAlign = 'center';
  points.forEach((p, idx) => {
    const x = padLeft + idx * stepX;
    const y = h - padBottom + 14;
    ctx.fillText(p.label, x, y);
  });
}

function RevenueChart({ points }: { points: RevenuePoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (canvasRef.current && points.length) {
      drawRevenueChart(canvasRef.current, points);
    }
  }, [points]);

  return <canvas ref={canvasRef} className="h-[260px] w-full" />;
}

/* ---------- Page ---------- */

export default function AnalyticsOverviewPage() {
  const [range, setRange] = useState<RangeKey>('30d');
  const [province, setProvince] = useState<string>('All');
  const [gender, setGender] = useState<string>('All');
  const [ageBand, setAgeBand] = useState<(typeof AGE_BANDS)[number]>('All');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [data, setData] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 🔢 Risk stats from InsightCore alerts
  const [riskStats, setRiskStats] = useState<{
    highRiskPatients: number; // unique patients with >= moderate alerts in 7d
    totalAlertsConsidered: number;
  } | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const params = new URLSearchParams();
        if (range !== '30d') params.set('range', range);
        if (province !== 'All') params.set('province', province);
        if (gender !== 'All') params.set('gender', gender);
        if (ageBand !== 'All') params.set('ageBand', ageBand);
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        if (search.trim()) params.set('q', search.trim());

        const qs = params.toString();
        const url = '/api/analytics/overview' + (qs ? `?${qs}` : '');
        const res = await fetch(url, { cache: 'no-store' });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as OverviewPayload;
        if (!mounted) return;
        setData(json);
      } catch (e: any) {
        if (!mounted) return;
        setErr(
          e?.message ||
            'Using mock analytics snapshot until /api/analytics/overview is wired.',
        );
        setData(MOCK_OVERVIEW);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [range, province, gender, ageBand, from, to, search]);

  // 🔔 Separate effect: compute 7-day high-risk patient share from InsightCore alerts
  useEffect(() => {
    let cancelled = false;

    async function loadRiskStats() {
      try {
        const res = await fetch('/api/insightcore/alerts?limit=500', {
          cache: 'no-store',
        });
        const data = await res.json().catch(() => ({ alerts: [] }));
        if (cancelled) return;

        const raw = (data.alerts || []) as any[];
        if (!Array.isArray(raw) || raw.length === 0) {
          setRiskStats(null);
          return;
        }

        const now = Date.now();
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

        const recent: InsightAlert[] = raw
          .map((a: any) => ({
            id: String(a.id || `${a.patientId || a.patientName || ''}:${a.ts || ''}`),
            patientId: a.patientId ?? null,
            patientName: a.patientName ?? null,
            severity: (a.severity as AlertSeverity) || 'low',
            ts: a.ts || a.timestamp || new Date().toISOString(),
          }))
          .filter((a) => {
            const t = Date.parse(a.ts);
            return Number.isFinite(t) && t >= sevenDaysAgo;
          });

        if (recent.length === 0) {
          setRiskStats(null);
          return;
        }

        const severe = recent.filter((a) => {
          const sev = (a.severity || 'low').toLowerCase();
          return sev === 'moderate' || sev === 'high' || sev === 'critical';
        });

        const uniquePatients = new Set<string>();
        for (const a of severe) {
          const key =
            (a.patientId && String(a.patientId)) ||
            (a.patientName && String(a.patientName)) ||
            '';
          if (key) uniquePatients.add(key);
        }

        setRiskStats({
          highRiskPatients: uniquePatients.size,
          totalAlertsConsidered: recent.length,
        });
      } catch (e) {
        if (cancelled) return;
        console.error('Failed to load InsightCore risk stats', e);
        setRiskStats(null);
      }
    }

    loadRiskStats();
  }, []);

  const d = data ?? MOCK_OVERVIEW;

  const maxGeoRev = useMemo(
    () => Math.max(...d.geo.map((g) => g.revenueZAR), 1),
    [d.geo],
  );

  const filteredEntities = useMemo(() => {
    if (!search.trim()) return d.topEntities;
    const q = search.toLowerCase();
    return d.topEntities.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        (e.location ?? '').toLowerCase().includes(q),
    );
  }, [d.topEntities, search]);

  function resetFilters() {
    setRange('30d');
    setProvince('All');
    setGender('All');
    setAgeBand('All');
    setSearch('');
    setFrom('');
    setTo('');
  }

  // Compute KPI: % patients with >= moderate risk alerts in last 7 days
  let riskKpi: Kpi | null = null;
  const activePatientsKpi = d.kpis.find((k) => k.label === 'Active Patients');
  const activePatients =
    typeof activePatientsKpi?.value === 'number'
      ? activePatientsKpi.value
      : null;

  if (
    riskStats &&
    activePatients != null &&
    activePatients > 0 &&
    riskStats.highRiskPatients > 0
  ) {
    const pct = Math.round(
      (riskStats.highRiskPatients / activePatients) * 100,
    );

    riskKpi = {
      label: '% patients ≥ moderate risk (7d)',
      value: `${pct}%`,
      sub: `${riskStats.highRiskPatients.toLocaleString()} of ${activePatients.toLocaleString()} active patients`,
    };
  }

  return (
    <main className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Analytics — Overview
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Cross-platform view across CarePort, MedReach, Rx and InsightCore — revenue,
            patient growth and partner performance.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="inline-flex rounded-full border bg-white overflow-hidden text-xs">
            <Link
              href="/analytics"
              className="px-3 py-1.5 border-r bg-gray-900 text-white"
            >
              Overview
            </Link>
            <Link
              href="/analytics/monthly"
              className="px-3 py-1.5 border-r hover:bg-gray-50"
            >
              Monthly
            </Link>
            <Link
              href="/analytics/daily"
              className="px-3 py-1.5 border-r hover:bg-gray-50"
            >
              Daily
            </Link>
            <Link
              href="/analytics/clinician-payouts"
              className="px-3 py-1.5 hover:bg-gray-50"
            >
              Clinician payouts
            </Link>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            <Link
              href="/orders/analytics"
              className="rounded border bg-white px-2.5 py-1 hover:bg-gray-50"
            >
              Orders analytics
            </Link>
            <Link
              href="/careport/analytics"
              className="rounded border bg-white px-2.5 py-1 hover:bg-gray-50"
            >
              CarePort analytics
            </Link>
            <Link
              href="/medreach/analytics"
              className="rounded border bg-white px-2.5 py-1 hover:bg-gray-50"
            >
              MedReach analytics
            </Link>
          </div>
        </div>
      </header>

      {err && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {err}
        </div>
      )}
      {loading && (
        <div className="text-xs text-gray-500">
          Loading overview analytics…
        </div>
      )}

      {/* FILTER BAR */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-500">Range:</span>
            <div className="inline-flex rounded-full border bg-white overflow-hidden">
              {(['7d', '30d', '90d', '12m'] as RangeKey[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1 border-r last:border-r-0 ${
                    range === r
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {r === '7d'
                    ? 'Last 7d'
                    : r === '30d'
                    ? 'Last 30d'
                    : r === '90d'
                    ? 'Last 90d'
                    : 'Last 12m'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search partner / site"
              className="w-48 rounded border px-2 py-1 text-xs"
            />
            <button
              type="button"
              onClick={resetFilters}
              className="rounded border px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-5">
          <select
            className="rounded border px-2 py-1 text-xs"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
          >
            {PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            className="rounded border px-2 py-1 text-xs"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
          >
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <select
            className="rounded border px-2 py-1 text-xs"
            value={ageBand}
            onChange={(e) =>
              setAgeBand(e.target.value as (typeof AGE_BANDS)[number])
            }
          >
            {AGE_BANDS.map((a) => (
              <option key={a} value={a}>
                Age: {a}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="rounded border px-2 py-1 text-xs"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            type="date"
            className="rounded border px-2 py-1 text-xs"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </section>

      {/* KPI GRID */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
        {/* New KPI from InsightCore risk stats */}
        {riskKpi && (
          <MetricCard
            key={riskKpi.label}
            label={riskKpi.label}
            value={riskKpi.value}
            sub={riskKpi.sub}
          />
        )}
        {d.kpis.map((k) => (
          <MetricCard
            key={k.label}
            label={k.label}
            value={k.value}
            sub={k.sub}
          />
        ))}
      </section>

      {/* REVENUE / PRODUCT MIX ROW */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border bg-white p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-gray-900">
                Revenue trend (by product)
              </h2>
              <p className="text-[11px] text-gray-500">
                Total monthly revenue split across CarePort, MedReach and Rx.
              </p>
            </div>
            <div className="hidden text-[11px] text-gray-500 sm:flex sm:flex-col sm:items-end">
              <span>Lines: Total • CarePort • MedReach • Rx</span>
            </div>
          </div>
          <RevenueChart points={d.revenueSeries} />
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-medium text-gray-900">
            Product mix (revenue)
          </h2>
          <p className="text-[11px] text-gray-500">
            Share of total platform revenue by product family for the selected range.
          </p>
          <Donut items={d.productMix} />
        </div>
      </section>

      {/* GEO + COHORTS ROW */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-medium text-gray-900">
            Geography performance
          </h2>
          <p className="text-[11px] text-gray-500">
            Revenue, patients and consult volumes by province.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {d.geo.map((row) => (
              <GeoBar key={row.province} row={row} max={maxGeoRev} />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-medium text-gray-900">
            Patient cohorts
          </h2>
          <p className="text-[11px] text-gray-500">
            Age-band view of active patients in the selected range.
          </p>
          <div className="space-y-2">
            {d.cohorts.map((c) => (
              <CohortRowView key={c.label} row={c} />
            ))}
          </div>
        </div>
      </section>

      {/* TOP ENTITIES */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-medium text-gray-900">
              Top earning partners
            </h2>
            <p className="text-[11px] text-gray-500">
              Highest revenue pharmacies, labs and clinicians in this view.
            </p>
          </div>
          <div className="text-[11px] text-gray-500">
            {filteredEntities.length} of {d.topEntities.length} rows shown
            {search.trim() && ' (search applied)'}.
          </div>
        </div>
        <EntityTable rows={filteredEntities} />
      </section>
    </main>
  );
}
