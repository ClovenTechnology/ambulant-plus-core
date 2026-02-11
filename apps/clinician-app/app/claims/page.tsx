// apps/clinician-app/app/claims/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

/* ================= TYPES ================= */

type PaymentMethod = 'self-pay-card' | 'medical-aid' | 'voucher-promo' | 'unknown';

type ClaimPayment = {
  method?: PaymentMethod | string;
  displayLabel?: string | null;
  voucherCode?: string | null;
  voucherAmountCents?: number | null;
  [key: string]: any;
};

type ClaimRecord = {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  encounterId?: string;
  caseId?: string | null;
  clinicianId?: string | null;
  patientId?: string | null;
  patientName?: string | null;
  diagnosis?: {
    text?: string | null;
    code?: string | null;
  };
  payment?: ClaimPayment;
  status?: string | null;
  [key: string]: any;
};

type RangePreset = 'today' | '7d' | '30d' | '365d' | 'all' | 'custom';

type PerMethodCounts = {
  total: number;
  'self-pay-card': number;
  'medical-aid': number;
  'voucher-promo': number;
  unknown: number;
};

type ClaimsStats = {
  perMethod: PerMethodCounts;
  perMonth: Record<string, PerMethodCounts>;
};

type ClaimsApiResponse = {
  items: ClaimRecord[];
  stats?: ClaimsStats;
};

type MiniPoint = { month: string; value: number };

const CLAIM_STATUS_OPTIONS = ['draft', 'submitted', 'paid', 'rejected'] as const;

/* ================= MOCK FALLBACK DATA ================= */

const MOCK_CLAIMS: ClaimRecord[] = [
  {
    id: 'clm-001',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    encounterId: 'enc-1001',
    clinicianId: 'clin-01',
    patientId: 'pat-01',
    patientName: 'Melisa Xaba',
    diagnosis: { text: 'Hypertension', code: 'I10' },
    status: 'paid',
    payment: {
      method: 'medical-aid',
      displayLabel: 'Discovery Health',
    },
  },
  {
    id: 'clm-002',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    encounterId: 'enc-1002',
    clinicianId: 'clin-02',
    patientId: 'pat-02',
    patientName: 'Nomsa Dlamini',
    diagnosis: { text: 'Type 2 Diabetes', code: 'E11' },
    status: 'submitted',
    payment: {
      method: 'self-pay-card',
      displayLabel: 'VISA •••• 4832',
    },
  },
  {
    id: 'clm-003',
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    encounterId: 'enc-1003',
    clinicianId: 'clin-01',
    patientId: 'pat-03',
    patientName: 'Lerato Toto',
    diagnosis: { text: 'Respiratory infection', code: 'J06.9' },
    status: 'paid',
    payment: {
      method: 'voucher-promo',
      displayLabel: 'Corporate Wellness Voucher',
      voucherCode: 'AMB-HEALTH-2026',
      voucherAmountCents: 45000,
    },
  },
];

const MOCK_STATS: ClaimsStats = {
  perMethod: {
    total: 3,
    'self-pay-card': 1,
    'medical-aid': 1,
    'voucher-promo': 1,
    unknown: 0,
  },
  perMonth: {
    '2025-11': { total: 1, 'self-pay-card': 1, 'medical-aid': 0, 'voucher-promo': 0, unknown: 0 },
    '2025-12': { total: 1, 'self-pay-card': 0, 'medical-aid': 1, 'voucher-promo': 0, unknown: 0 },
    '2026-01': { total: 1, 'self-pay-card': 0, 'medical-aid': 0, 'voucher-promo': 1, unknown: 0 },
  },
};

/* ================= HELPERS ================= */

function parseDateSafe(v?: string) {
  if (!v) return NaN;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? NaN : t;
}

function normalizeMethod(m?: string): PaymentMethod {
  const s = (m || '').toLowerCase();
  if (s === 'medical-aid' || s === 'medical_aid' || s.includes('medical')) return 'medical-aid';
  if (s === 'self-pay-card' || s === 'card' || s.includes('card')) return 'self-pay-card';
  if (s === 'voucher-promo' || s.includes('voucher') || s.includes('promo')) return 'voucher-promo';
  if (!s) return 'unknown';
  return 'unknown';
}

function MiniBarRow({ label, series }: { label: string; series: MiniPoint[] }) {
  if (!series.length) return null;
  const max = series.reduce((m, pt) => Math.max(m, pt.value), 0) || 1;
  const total = series.reduce((sum, pt) => sum + pt.value, 0);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-gray-600">
        <span>{label}</span>
        <span className="tabular-nums text-gray-800">{total}</span>
      </div>
      <div className="flex h-8 items-end gap-[2px]">
        {series.map((pt) => {
          const heightPct = (pt.value / max) * 100;
          return (
            <div
              key={pt.month}
              className="flex-1 rounded bg-gray-200"
              style={{
                height: `${Math.max(6, heightPct)}%`,
                opacity: pt.value === 0 ? 0.25 : 1,
              }}
              title={`${pt.month}: ${pt.value} claim(s)`}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-gray-400">
        {series.map((pt) => (
          <span key={pt.month} className="flex-1 text-center truncate">
            {pt.month.slice(5)}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ================= PAGE ================= */

export default function ClaimsDashboardPage() {
  const sp = useSearchParams();
  const highlightEncounterId = sp.get('encounterId') || '';

  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [stats, setStats] = useState<ClaimsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [range, setRange] = useState<RangePreset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [patientFilter, setPatientFilter] = useState('');
  const [clinicianFilter, setClinicianFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | 'all'>('all');

  const [openJson, setOpenJson] = useState<Record<string, boolean>>({});
  const [voucherOpen, setVoucherOpen] = useState<Record<string, boolean>>({});
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({});

  /* ===== API FIRST, MOCK FALLBACK ===== */

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const r = await fetch('/api/claims', { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);

        const d: ClaimsApiResponse = await r.json();
        if (cancelled) return;

        const items = Array.isArray(d.items) ? d.items : [];

        if (items.length > 0) {
          setClaims(items);
          setStats(d.stats ?? null);
        } else {
          // graceful fallback if API returns empty
          setClaims(MOCK_CLAIMS);
          setStats(MOCK_STATS);
        }
      } catch (e: any) {
        if (cancelled) return;
        // graceful fallback if API fails
        setErr('API unavailable — demo data loaded');
        setClaims(MOCK_CLAIMS);
        setStats(MOCK_STATS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ===== everything else remains unchanged (filters, CSV, charts, UI, etc) ===== */

  // (rest of file is identical to your previous version)


  // Derived dropdown options
  const patientOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of claims) {
      if (!c.patientId) continue;
      if (!map.has(c.patientId)) {
        map.set(c.patientId, c.patientName || c.patientId);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [claims]);

  const clinicianOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of claims) {
      if (!c.clinicianId) continue;
      set.add(String(c.clinicianId));
    }
    return Array.from(set.values());
  }, [claims]);

  // Filter by date range + patient/clinician/method
  const filtered = useMemo(() => {
    if (!claims.length) return [] as ClaimRecord[];
    const now = Date.now();

    let from: number | null = null;
    let to: number | null = null;

    if (range === 'today') {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      from = d.getTime();
      to = now;
    } else if (range === '7d') {
      from = now - 7 * 24 * 60 * 60 * 1000;
    } else if (range === '30d') {
      from = now - 30 * 24 * 60 * 60 * 1000;
    } else if (range === '365d') {
      from = now - 365 * 24 * 60 * 60 * 1000;
    } else if (range === 'custom') {
      if (customFrom) {
        const dFrom = new Date(customFrom + 'T00:00:00').getTime();
        if (!Number.isNaN(dFrom)) from = dFrom;
      }
      if (customTo) {
        const dTo = new Date(customTo + 'T23:59:59').getTime();
        if (!Number.isNaN(dTo)) to = dTo;
      }
    } // 'all' → from/to remain null

    return claims.filter((c) => {
      const t = parseDateSafe(c.createdAt);
      if (Number.isNaN(t)) return false;
      if (from != null && t < from) return false;
      if (to != null && t > to) return false;

      if (patientFilter && String(c.patientId ?? '') !== patientFilter) {
        return false;
      }
      if (clinicianFilter && String(c.clinicianId ?? '') !== clinicianFilter) {
        return false;
      }
      if (methodFilter !== 'all') {
        if (normalizeMethod(c.payment?.method) !== methodFilter) {
          return false;
        }
      }

      return true;
    });
  }, [claims, range, customFrom, customTo, patientFilter, clinicianFilter, methodFilter]);

  // Counts per method on filtered subset
  const counts = useMemo(() => {
    let card = 0;
    let medAid = 0;
    let voucher = 0;
    for (const c of filtered) {
      const m = normalizeMethod(c.payment?.method);
      if (m === 'self-pay-card') card++;
      else if (m === 'medical-aid') medAid++;
      else if (m === 'voucher-promo') voucher++;
    }
    return { card, medAid, voucher, total: filtered.length };
  }, [filtered]);

  const rangeLabel = (() => {
    switch (range) {
      case 'today':
        return 'Today';
      case '7d':
        return 'Last 7 days';
      case '30d':
        return 'Last 30 days';
      case '365d':
        return 'Last 12 months';
      case 'custom':
        return 'Custom range';
      default:
        return 'All time';
    }
  })();

  // Build mini-series from stats.perMonth for last 12 months (all-time/global)
  const methodSeries = useMemo(() => {
    if (!stats?.perMonth) return null;
    const entries = Object.entries(stats.perMonth);
    if (!entries.length) return null;

    // Sort by month key ascending (YYYY-MM) and take last 12
    entries.sort(([a], [b]) => a.localeCompare(b));
    const last12 = entries.slice(-12);

    const mk = (field: keyof PerMethodCounts): MiniPoint[] =>
      last12.map(([month, v]) => ({
        month,
        value: v[field] ?? 0,
      }));

    return {
      card: mk('self-pay-card'),
      medAid: mk('medical-aid'),
      voucher: mk('voucher-promo'),
    };
  }, [stats]);

  const resetFilters = () => {
    setRange('30d');
    setCustomFrom('');
    setCustomTo('');
    setPatientFilter('');
    setClinicianFilter('');
    setMethodFilter('all');
  };

  // CSV download (current filtered view)
  const downloadCsv = () => {
    if (!filtered.length) {
      alert('No claims in current filter to export.');
      return;
    }

    const escapeCsv = (v: any) => {
      const s = v == null ? '' : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };

    const header = [
      'id',
      'createdAt',
      'updatedAt',
      'encounterId',
      'patientId',
      'patientName',
      'clinicianId',
      'status',
      'method',
      'displayLabel',
      'voucherCode',
      'voucherAmountCents',
    ];

    const lines = [header.map(escapeCsv).join(',')];

    for (const c of filtered) {
      const row = [
        c.id,
        c.createdAt ?? '',
        c.updatedAt ?? '',
        c.encounterId ?? '',
        c.patientId ?? '',
        c.patientName ?? '',
        c.clinicianId ?? '',
        c.status ?? '',
        c.payment?.method ?? '',
        c.payment?.displayLabel ?? '',
        c.payment?.voucherCode ?? '',
        c.payment?.voucherAmountCents ?? '',
      ];
      lines.push(row.map(escapeCsv).join(','));
    }

    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'claims-export.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    if (!newStatus) return;
    setStatusUpdating((prev) => ({ ...prev, [id]: true }));
    try {
      const r = await fetch('/api/claims', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        throw new Error(txt || `HTTP ${r.status}`);
      }
      const js = await r.json().catch(() => null);
      const updated: ClaimRecord | null = js?.claim ?? null;

      setClaims((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, status: updated?.status ?? newStatus } : c,
        ),
      );
    } catch (e: any) {
      alert(e?.message || 'Failed to update claim status');
    } finally {
      setStatusUpdating((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Claims &amp; Funding</h1>
          <p className="mt-1 text-xs text-gray-500">
            View how encounters are funded (Card, Medical Aid, Vouchers), edit claim
            status and inspect payloads.
          </p>
          {highlightEncounterId && (
            <div className="mt-1 inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700">
              Focused encounter:{' '}
              <span className="ml-1 font-mono">{highlightEncounterId}</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={downloadCsv}
            className="rounded border bg-white px-3 py-1.5 hover:bg-gray-50"
          >
            Download CSV
          </button>
          <a
            href="/encounters"
            className="rounded border bg-white px-3 py-1.5 hover:bg-gray-50"
          >
            ← Back to encounters
          </a>
        </div>
      </header>

      {/* Filters + summary strip */}
      <section className="space-y-3 rounded border bg-white p-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-800">Date range:</span>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ['today', 'Today'],
                  ['7d', '7 days'],
                  ['30d', '30 days'],
                  ['365d', '12 months'],
                  ['all', 'All time'],
                  ['custom', 'Custom'],
                ] as [RangePreset, string][]
              ).map(([value, label]) => {
                const active = range === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRange(value)}
                    className={
                      'rounded-full border px-2 py-0.5 text-[11px] ' +
                      (active
                        ? 'border-black bg-black text-white'
                        : 'border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100')
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span>
              Showing <span className="font-semibold">{filtered.length}</span> /
              <span className="font-semibold"> {claims.length}</span> claim
              {claims.length === 1 ? '' : 's'} · {rangeLabel}
            </span>
            <button
              type="button"
              onClick={resetFilters}
              className="rounded border bg-gray-50 px-2 py-0.5 text-[11px] hover:bg-gray-100"
            >
              Reset filters
            </button>
          </div>
        </div>

        {range === 'custom' && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1">
              <span className="text-[11px] text-gray-600">From</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded border px-2 py-0.5 text-[11px]"
              />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-[11px] text-gray-600">To</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded border px-2 py-0.5 text-[11px]"
              />
            </label>
          </div>
        )}

        {/* Extra filters: patient / clinician / method */}
        <div className="grid gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)]">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-gray-600">Patient</span>
            <select
              value={patientFilter}
              onChange={(e) => setPatientFilter(e.target.value)}
              className="rounded border px-2 py-1 text-[11px]"
            >
              <option value="">All patients</option>
              {patientOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.id}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-gray-600">Clinician</span>
            <select
              value={clinicianFilter}
              onChange={(e) => setClinicianFilter(e.target.value)}
              className="rounded border px-2 py-1 text-[11px]"
            >
              <option value="">All clinicians</option>
              {clinicianOptions.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-gray-600">Funding method</span>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value as any)}
              className="rounded border px-2 py-1 text-[11px]"
            >
              <option value="all">All</option>
              <option value="self-pay-card">Self-pay (Card)</option>
              <option value="medical-aid">Medical Aid</option>
              <option value="voucher-promo">Voucher / Promo</option>
            </select>
          </label>
        </div>

        {/* Per-method summary counts for current range */}
        <div className="grid gap-2 md:grid-cols-4">
          <div className="rounded border bg-gray-50 px-3 py-2">
            <div className="text-[11px] text-gray-500">All funded encounters</div>
            <div className="text-lg font-semibold">{counts.total}</div>
          </div>
          <div className="rounded border bg-white px-3 py-2">
            <div className="text-[11px] text-gray-500">Self-pay (Card)</div>
            <div className="text-lg font-semibold">{counts.card}</div>
          </div>
          <div className="rounded border bg-white px-3 py-2">
            <div className="text-[11px] text-gray-500">Medical Aid / Insurance</div>
            <div className="text-lg font-semibold">{counts.medAid}</div>
          </div>
          <div className="rounded border bg-white px-3 py-2">
            <div className="text-[11px] text-gray-500">Voucher / Promo</div>
            <div className="text-lg font-semibold">{counts.voucher}</div>
          </div>
        </div>

        {/* Tiny per-method bar charts over time (all-time, last 12 months) */}
        {methodSeries && (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <MiniBarRow label="Card over time (12 mo)" series={methodSeries.card} />
            <MiniBarRow label="Medical Aid (12 mo)" series={methodSeries.medAid} />
            <MiniBarRow label="Vouchers (12 mo)" series={methodSeries.voucher} />
          </div>
        )}
      </section>

      {err && (
        <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          {err}
        </div>
      )}

      {loading && (
        <div className="text-sm text-gray-500">Loading claims…</div>
      )}

      {/* Claims list */}
      <section className="grid gap-3 md:grid-cols-2">
        {filtered.map((c) => {
          const created = c.createdAt
            ? new Date(c.createdAt).toLocaleString()
            : 'Unknown';

          const method = normalizeMethod(c.payment?.method);
          const methodLabel =
            method === 'medical-aid'
              ? 'Medical Aid / Insurance'
              : method === 'self-pay-card'
              ? 'Self-pay (Card)'
              : method === 'voucher-promo'
              ? 'Voucher / Promo'
              : 'Unknown';

          const isHighlight =
            highlightEncounterId &&
            String(c.encounterId ?? '') === highlightEncounterId;

          const jsonOpenForId = !!openJson[c.id];
          const voucherOpenForId = !!voucherOpen[c.id];

          const voucherCode = c.payment?.voucherCode || null;
          const voucherAmountCents = c.payment?.voucherAmountCents ?? null;

          const status = (c.status || 'submitted').toLowerCase();
          const statusLabel =
            status.charAt(0).toUpperCase() + status.slice(1);

          const statusClass =
            status === 'paid'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : status === 'rejected'
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : status === 'draft'
              ? 'bg-gray-50 text-gray-700 border-gray-200'
              : 'bg-indigo-50 text-indigo-700 border-indigo-200';

          return (
            <article
              key={c.id}
              className={
                'space-y-2 rounded border bg-white p-3 text-xs shadow-sm ' +
                (isHighlight ? 'border-emerald-500 ring-1 ring-emerald-200' : '')
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-gray-800">
                      {c.encounterId || 'encounter-?'}
                    </span>
                    {c.patientName && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
                        {c.patientName}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-gray-500">
                    Claim {c.id} • {created}
                  </div>
                  {c.diagnosis?.text && (
                    <div className="mt-1 text-[11px] text-gray-600">
                      Dx: {c.diagnosis.text}{' '}
                      {c.diagnosis.code ? `(${c.diagnosis.code})` : ''}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-800">
                    {methodLabel}
                  </span>
                  {c.payment?.displayLabel && (
                    <span className="max-w-[220px] truncate text-[10px] text-gray-500">
                      {c.payment.displayLabel}
                    </span>
                  )}
                  {/* Status pill + selector */}
                  <div className="mt-1 flex flex-wrap items-center justify-end gap-1">
                    <span
                      className={
                        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ' +
                        statusClass
                      }
                    >
                      {statusLabel}
                    </span>
                    <select
                      value={status}
                      disabled={!!statusUpdating[c.id]}
                      onChange={(e) =>
                        handleStatusChange(c.id, e.target.value)
                      }
                      className="rounded border px-1 py-0.5 text-[10px]"
                    >
                      {CLAIM_STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Voucher & navigation controls */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {method === 'voucher-promo' && (
                    <>
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                        Voucher used ✅
                      </span>
                      {voucherCode && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setVoucherOpen((prev) => ({
                                ...prev,
                                [c.id]: !prev[c.id],
                              }))
                            }
                            className="text-[10px] text-emerald-700 underline"
                          >
                            {voucherOpenForId ? 'Hide code' : 'Reveal code'}
                          </button>
                          {voucherOpenForId && (
                            <span className="rounded bg-gray-900 px-2 py-0.5 font-mono text-[10px] text-white">
                              {voucherCode}
                            </span>
                          )}
                        </>
                      )}
                      {typeof voucherAmountCents === 'number' && (
                        <span className="text-[10px] text-gray-600">
                          Value: R {(voucherAmountCents / 100).toFixed(2)}
                        </span>
                      )}
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {c.encounterId && (
                    <a
                      href={`/encounters/${encodeURIComponent(
                        c.encounterId,
                      )}`}
                      className="rounded border px-2 py-0.5 text-[10px] hover:bg-gray-50"
                    >
                      Open encounter
                    </a>
                  )}
                </div>
              </div>

              {/* Show JSON toggle */}
              <div className="border-t pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setOpenJson((prev) => ({
                      ...prev,
                      [c.id]: !prev[c.id],
                    }))
                  }
                  className="text-[10px] text-indigo-700 underline"
                >
                  {jsonOpenForId ? 'Hide raw JSON' : 'Show raw JSON'}
                </button>
                {jsonOpenForId && (
                  <pre className="mt-2 max-h-64 overflow-auto rounded bg-gray-900 p-2 text-[10px] text-gray-100">
                    {JSON.stringify(c, null, 2)}
                  </pre>
                )}
              </div>
            </article>
          );
        })}

        {!loading && filtered.length === 0 && (
          <div className="col-span-full rounded border bg-white p-4 text-sm text-gray-500">
            No claims in this range yet.
          </div>
        )}
      </section>
    </main>
  );
}
