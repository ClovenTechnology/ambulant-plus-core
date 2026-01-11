// apps/patient-app/app/reports/stress/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { generateHealthReport } from '@/src/analytics/report';
import { toast } from '@/components/ToastMount';
import { usePlan } from '@/components/context/PlanContext';

type RangeKey = '7d' | '30d' | '90d' | '1y';

type StressDayPoint = {
  dateISO: string; // YYYY-MM-DD
  score: number; // 0-100
  hrvMs?: number | null;
  restingHr?: number | null;
  sleepHours?: number | null;
  steps?: number | null;
  note?: string | null;
};

type StressReportData = {
  ok: boolean;
  userId?: string;
  range: RangeKey;
  generatedAtISO: string;
  points: StressDayPoint[];
  // Optional server-provided insights (if available)
  insights?: {
    headline?: string;
    drivers?: Array<{ title: string; level: 'high' | 'med' | 'low'; detail?: string }>;
    recommendations?: Array<{ title: string; detail: string }>;
  };
};

const LS_DISCREET = 'ambulant.reports.discreet';
const LS_HIDE_SENSITIVE = 'ambulant.reports.hideSensitive';

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function fmtDatePretty(dateISO: string) {
  const d = new Date(dateISO + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: '2-digit' });
}

function fmtNumber(n: number, digits = 0) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(n);
}

function scoreLabel(score: number) {
  if (score >= 75) return { label: 'High', tone: 'text-rose-300', badge: 'bg-rose-500/15 border-rose-400/25' };
  if (score >= 45) return { label: 'Moderate', tone: 'text-amber-300', badge: 'bg-amber-500/15 border-amber-400/25' };
  return { label: 'Low', tone: 'text-emerald-300', badge: 'bg-emerald-500/15 border-emerald-400/25' };
}

function computeSummary(points: StressDayPoint[]) {
  const valid = points.filter((p) => Number.isFinite(p.score));
  const n = valid.length || 1;

  const avg = valid.reduce((s, p) => s + p.score, 0) / n;
  const last = valid[valid.length - 1]?.score ?? avg;

  const first = valid[0]?.score ?? avg;
  const trendPct = first === 0 ? 0 : ((last - first) / first) * 100;

  const highDays = valid.filter((p) => p.score >= 75).length;

  const best = [...valid].sort((a, b) => a.score - b.score)[0];
  const worst = [...valid].sort((a, b) => b.score - a.score)[0];

  return {
    avg: clamp(avg, 0, 100),
    last: clamp(last, 0, 100),
    trendPct: Number.isFinite(trendPct) ? trendPct : 0,
    highDays,
    bestDayISO: best?.dateISO ?? '',
    worstDayISO: worst?.dateISO ?? '',
  };
}

function smoothRand(seed: number) {
  // Deterministic-ish pseudo-random based on seed (no crypto), good enough for UI mock
  let t = seed % 2147483647;
  return () => {
    t = (t * 48271) % 2147483647;
    return (t & 0xfffffff) / 0xfffffff;
  };
}

function makeMockReport(range: RangeKey, userId = 'patient-123'): StressReportData {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const rnd = smoothRand(seed);

  // Build a gently varying stress baseline with occasional spikes
  let baseline = 45 + (rnd() * 10 - 5);
  const points: StressDayPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);

    baseline += rnd() * 4 - 2; // drift
    baseline = clamp(baseline, 25, 70);

    const spike = rnd() > 0.92 ? rnd() * 25 : 0;
    const dip = rnd() > 0.93 ? rnd() * 18 : 0;

    const score = clamp(baseline + spike - dip, 15, 92);

    const hrvMs = clamp(45 + (70 - score) * 0.35 + (rnd() * 8 - 4), 18, 110);
    const restingHr = clamp(58 + score * 0.18 + (rnd() * 4 - 2), 50, 92);
    const sleepHours = clamp(7.2 - score * 0.02 + (rnd() * 0.8 - 0.4), 4.2, 9.3);
    const steps = Math.round(clamp(6500 + (rnd() * 2500 - 1200) - score * 18, 1200, 14000));

    const dateISO = d.toISOString().slice(0, 10);

    points.push({
      dateISO,
      score: Math.round(score),
      hrvMs: Math.round(hrvMs),
      restingHr: Math.round(restingHr),
      sleepHours: Math.round(sleepHours * 10) / 10,
      steps,
      note: rnd() > 0.9 ? 'Heavier workload day' : null,
    });
  }

  const summary = computeSummary(points);
  const headline =
    summary.last >= 75
      ? 'Your recent stress load is elevated. Focus on recovery blocks.'
      : summary.last >= 45
      ? 'Your stress is moderate. Small recovery tweaks can improve stability.'
      : 'Your stress is low. Keep protecting the habits that are working.';

  const drivers: StressReportData['insights'] extends { drivers: infer D } ? D : any = [
    {
      title: 'Sleep consistency',
      level: summary.last >= 65 ? 'high' : 'med',
      detail: 'Late nights correlate with your higher-stress days.',
    },
    {
      title: 'Recovery balance (HRV)',
      level: summary.last >= 75 ? 'high' : 'med',
      detail: 'Lower HRV tends to precede spikes in your stress score.',
    },
    {
      title: 'Activity pacing',
      level: 'low',
      detail: 'Short walks on busy days help reduce the next-day score.',
    },
  ];

  const recommendations: StressReportData['insights'] extends { recommendations: infer R } ? R : any = [
    {
      title: 'Recovery block (10–15 min)',
      detail: 'Try one short breathing or mindfulness block after your busiest hour.',
    },
    {
      title: 'Protect sleep window',
      detail: 'Aim for a consistent bedtime ±45 minutes, especially on weekdays.',
    },
    {
      title: 'Light movement',
      detail: 'A 12–20 minute walk can reduce next-day stress load for many people.',
    },
  ];

  return {
    ok: true,
    userId,
    range,
    generatedAtISO: new Date().toISOString(),
    points,
    insights: { headline, drivers, recommendations },
  };
}

/* ------------------------------
   Tiny inline chart (SVG sparkline)
--------------------------------*/
function Sparkline({
  values,
  height = 56,
  discreet,
  ariaLabel,
}: {
  values: number[];
  height?: number;
  discreet?: boolean;
  ariaLabel?: string;
}) {
  const w = 260;
  const pad = 6;

  const vmin = Math.min(...values);
  const vmax = Math.max(...values);
  const span = Math.max(1, vmax - vmin);

  const pts = values
    .map((v, i) => {
      const x = pad + (i * (w - pad * 2)) / Math.max(1, values.length - 1);
      const y = pad + ((vmax - v) * (height - pad * 2)) / span;
      return [x, y] as const;
    })
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ');

  // Fill path for a subtle area look
  const area = `${pts} ${w - pad},${height - pad} ${pad},${height - pad}`;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${w} ${height}`}
      role="img"
      aria-label={ariaLabel || 'Trend chart'}
      className="block"
    >
      <defs>
        <linearGradient id="sparkFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      <path d={`M ${area}`} fill="url(#sparkFill)" />
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {!discreet && (
        <>
          <circle cx={w - pad} cy={Number(pts.split(' ').at(-1)?.split(',')[1] ?? 0)} r="3.2" fill="currentColor" opacity="0.9" />
        </>
      )}
    </svg>
  );
}

function Pill({
  active,
  children,
  onClick,
  title,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={[
        'px-3 py-1.5 rounded-full border text-sm transition',
        active
          ? 'bg-white/10 border-white/20 text-white'
          : 'bg-transparent border-white/10 text-white/75 hover:text-white hover:bg-white/5',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function StatCard({
  label,
  value,
  sub,
  discreet,
}: {
  label: string;
  value: string;
  sub?: string;
  discreet?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
      <div className="text-xs text-white/60">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{discreet ? '•••' : value}</div>
      {sub ? <div className="mt-1 text-xs text-white/55">{sub}</div> : null}
    </div>
  );
}

export default function StressReportPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { plan, isPremium } = usePlan();

  const range = useMemo<RangeKey>(() => {
    const r = (sp.get('range') || '30d') as RangeKey;
    if (r === '7d' || r === '30d' || r === '90d' || r === '1y') return r;
    return '30d';
  }, [sp]);

  // Keep range canonical in URL
  useEffect(() => {
    const current = sp.get('range');
    if (!current) {
      const qs = new URLSearchParams(Array.from(sp.entries()));
      qs.set('range', range);
      router.replace(`/reports/stress?${qs.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patientId = useMemo(() => sp.get('patientId') || 'patient-123', [sp]);

  const [discreet, setDiscreet] = useState(false);
  const [hideSensitive, setHideSensitive] = useState(false);

  // Data
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StressReportData | null>(null);
  const [usingMock, setUsingMock] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // PDF state (on-demand)
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFilename, setPdfFilename] = useState<string>('stress_report.pdf');
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const lastObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    // Load persisted toggles
    try {
      setDiscreet((localStorage.getItem(LS_DISCREET) || '0') === '1');
      setHideSensitive((localStorage.getItem(LS_HIDE_SENSITIVE) || '0') === '1');
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_DISCREET, discreet ? '1' : '0');
    } catch {}
  }, [discreet]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_HIDE_SENSITIVE, hideSensitive ? '1' : '0');
    } catch {}
  }, [hideSensitive]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErrMsg(null);

      // Revoke previous preview URL when changing range / reloading
      if (lastObjectUrlRef.current) {
        try {
          URL.revokeObjectURL(lastObjectUrlRef.current);
        } catch {}
        lastObjectUrlRef.current = null;
      }
      setPdfUrl(null);
      setShowPdfPreview(false);

      try {
        // Real-ready endpoint (optional). If you don’t have it yet, mock fallback kicks in.
        const res = await fetch(`/api/reports/stress?range=${encodeURIComponent(range)}`, { method: 'GET' });
        const json = (await res.json().catch(() => null)) as StressReportData | null;

        if (!alive) return;

        if (res.ok && json && json.ok && Array.isArray(json.points) && json.points.length) {
          setData({ ...json, range, userId: json.userId || patientId });
          setUsingMock(false);
        } else {
          // fallback
          const mock = makeMockReport(range, patientId);
          setData(mock);
          setUsingMock(true);
        }
      } catch (e) {
        if (!alive) return;
        const mock = makeMockReport(range, patientId);
        setData(mock);
        setUsingMock(true);
        setErrMsg('Could not load live data. Showing demo data.');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [range, patientId]);

  useEffect(() => {
    // Cleanup object URL on unmount
    return () => {
      if (lastObjectUrlRef.current) {
        try {
          URL.revokeObjectURL(lastObjectUrlRef.current);
        } catch {}
      }
    };
  }, []);

  const points = data?.points ?? [];
  const summary = useMemo(() => computeSummary(points), [points]);
  const lastLabel = useMemo(() => scoreLabel(Math.round(summary.last)), [summary.last]);
  const chartValues = useMemo(() => points.map((p) => clamp(p.score, 0, 100)), [points]);

  async function ensurePdfGenerated() {
    if (pdfUrl) return true;

    setPdfBusy(true);
    try {
      const { blob, filename } = await generateHealthReport(patientId, { stress: true });
      const url = URL.createObjectURL(blob);

      // revoke old
      if (lastObjectUrlRef.current) {
        try {
          URL.revokeObjectURL(lastObjectUrlRef.current);
        } catch {}
      }
      lastObjectUrlRef.current = url;

      setPdfUrl(url);
      setPdfFilename(filename || 'stress_report.pdf');
      return true;
    } catch (e) {
      console.error(e);
      toast('Could not generate PDF right now.', { type: 'error' });
      return false;
    } finally {
      setPdfBusy(false);
    }
  }

  async function handleDownloadPdf() {
    const ok = await ensurePdfGenerated();
    if (!ok || !pdfUrl) return;

    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = pdfFilename || 'stress_report.pdf';
    a.click();
    toast('Download started.', { type: 'success' });
  }

  async function handleSharePdf() {
    const ok = await ensurePdfGenerated();
    if (!ok || !pdfUrl) return;

    try {
      const res = await fetch(pdfUrl);
      const blob = await res.blob();
      const file = new File([blob], pdfFilename || 'stress_report.pdf', { type: 'application/pdf' });

      if ((navigator as any).share && (navigator as any).canShare?.({ files: [file] })) {
        await (navigator as any).share({
          title: 'Stress Report',
          text: 'Here is my stress report.',
          files: [file],
        });
      } else {
        toast('Sharing is not supported on this device/browser.', { type: 'info' });
      }
    } catch (e) {
      console.error(e);
      toast('Could not share the PDF.', { type: 'error' });
    }
  }

  function setRange(next: RangeKey) {
    const qs = new URLSearchParams(Array.from(sp.entries()));
    qs.set('range', next);
    router.push(`/reports/stress?${qs.toString()}`);
  }

  const generatedAtText = useMemo(() => {
    const iso = data?.generatedAtISO || new Date().toISOString();
    const d = new Date(iso);
    return d.toLocaleString();
  }, [data?.generatedAtISO]);

  return (
    <main className="min-h-[calc(100vh-0px)] bg-gradient-to-b from-slate-950 via-slate-950 to-black text-white">
      {/* Top bar */}
      <div className="mx-auto w-full max-w-6xl px-4 pt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/reports"
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white/80 hover:text-white hover:bg-white/[0.06]"
            >
              ← Reports
            </Link>

            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">Stress Report</h1>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-white/70">
                {range.toUpperCase()}
              </span>

              {!isPremium ? (
                <span className="rounded-full border border-fuchsia-400/25 bg-fuchsia-500/10 px-2 py-0.5 text-xs text-fuchsia-200">
                  Premium preview
                </span>
              ) : (
                <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-200">
                  Premium
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Pill active={discreet} onClick={() => setDiscreet((v) => !v)} title="Hide numbers across the report">
              Discreet
            </Pill>
            <Pill active={hideSensitive} onClick={() => setHideSensitive((v) => !v)} title="Hide notes and sensitive details">
              Hide sensitive
            </Pill>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          {/* Range */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs text-white/55">Range</div>
            <Pill active={range === '7d'} onClick={() => setRange('7d')}>
              7D
            </Pill>
            <Pill active={range === '30d'} onClick={() => setRange('30d')}>
              30D
            </Pill>
            <Pill active={range === '90d'} onClick={() => setRange('90d')}>
              90D
            </Pill>
            <Pill active={range === '1y'} onClick={() => setRange('1y')}>
              1Y
            </Pill>

            {usingMock ? (
              <span className="ml-2 rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
                Demo data
              </span>
            ) : null}
            {errMsg ? <span className="text-xs text-white/55">{errMsg}</span> : null}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                const ok = await ensurePdfGenerated();
                if (!ok) return;
                setShowPdfPreview((v) => !v);
              }}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/80 hover:text-white hover:bg-white/[0.07] disabled:opacity-60"
              disabled={pdfBusy}
            >
              {pdfBusy ? 'Preparing…' : showPdfPreview ? 'Hide PDF preview' : 'Preview PDF'}
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/80 hover:text-white hover:bg-white/[0.07] disabled:opacity-60"
              disabled={pdfBusy}
            >
              Download PDF
            </button>

            <button
              type="button"
              onClick={handleSharePdf}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/80 hover:text-white hover:bg-white/[0.07] disabled:opacity-60"
              disabled={pdfBusy}
            >
              Share
            </button>
          </div>
        </div>

        <div className="mt-2 text-xs text-white/50">
          Generated: {generatedAtText}
          {plan ? <span className="ml-2">• Plan: {plan}</span> : null}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6">
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-white/75">
            Loading stress report…
          </div>
        ) : !data ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-white/75">
            Could not load the report.
          </div>
        ) : (
          <>
            {/* Hero */}
            <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] via-white/[0.03] to-transparent p-6 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm text-white/70">Current status</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <div className="text-3xl font-semibold tracking-tight">
                      {discreet ? '•••' : fmtNumber(Math.round(summary.last))} <span className="text-white/60 text-base">/ 100</span>
                    </div>
                    <span
                      className={[
                        'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs',
                        lastLabel.badge,
                        lastLabel.tone,
                      ].join(' ')}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                      {lastLabel.label}
                    </span>

                    <span className="text-xs text-white/55">
                      {summary.trendPct >= 0 ? '▲' : '▼'} {discreet ? '•••' : `${fmtNumber(Math.abs(summary.trendPct), 1)}%`}{' '}
                      <span className="text-white/45">vs start of range</span>
                    </span>
                  </div>

                  <div className="mt-3 max-w-2xl text-sm text-white/70">
                    {data.insights?.headline ||
                      'Stress score is a composite indicator. Use trends over time, not a single day, to guide habits.'}
                  </div>
                </div>

                <div className="w-full md:w-[320px]">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-white/60">Trend</div>
                      <div className="text-xs text-white/55">{points.length} days</div>
                    </div>
                    <div className="mt-2 text-white/80" style={{ color: 'rgba(255,255,255,0.85)' }}>
                      <Sparkline
                        values={chartValues.length ? chartValues : [50, 52, 49, 55, 53, 51, 54]}
                        discreet={discreet}
                        ariaLabel="Stress score trend"
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-white/55">
                      <span>Low</span>
                      <span>High</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-4">
                <StatCard
                  label="Average score"
                  value={`${fmtNumber(Math.round(summary.avg))} / 100`}
                  sub="Across selected range"
                  discreet={discreet}
                />
                <StatCard
                  label="High-stress days"
                  value={fmtNumber(summary.highDays)}
                  sub="Score ≥ 75"
                  discreet={discreet}
                />
                <StatCard
                  label="Best day"
                  value={summary.bestDayISO ? fmtDatePretty(summary.bestDayISO) : '—'}
                  sub={summary.bestDayISO ? 'Lowest stress score' : undefined}
                  discreet={hideSensitive} // treat dates as sensitive if user wants
                />
                <StatCard
                  label="Toughest day"
                  value={summary.worstDayISO ? fmtDatePretty(summary.worstDayISO) : '—'}
                  sub={summary.worstDayISO ? 'Highest stress score' : undefined}
                  discreet={hideSensitive}
                />
              </div>
            </section>

            {/* Insights + Recommendations */}
            <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold tracking-tight">Key drivers</h2>
                  <span className="text-xs text-white/55">What may be influencing your score</span>
                </div>

                <div className="mt-4 space-y-3">
                  {(data.insights?.drivers?.length ? data.insights.drivers : []).map((d, idx) => {
                    const levelTone =
                      d.level === 'high'
                        ? 'border-rose-400/25 bg-rose-500/10 text-rose-200'
                        : d.level === 'med'
                        ? 'border-amber-400/25 bg-amber-500/10 text-amber-200'
                        : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200';

                    return (
                      <div key={`${d.title}-${idx}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-white/90">{d.title}</div>
                            {!hideSensitive && d.detail ? <div className="mt-1 text-sm text-white/65">{d.detail}</div> : null}
                          </div>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${levelTone}`}>
                            {d.level === 'high' ? 'High' : d.level === 'med' ? 'Medium' : 'Low'}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {!data.insights?.drivers?.length ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/65">
                      No driver insights available yet. Once your InsightCore loop is wired, this section can show explainers
                      and clinician feedback.
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold tracking-tight">Recommendations</h2>
                  <span className="text-xs text-white/55">Practical next steps</span>
                </div>

                <div className="mt-4 space-y-3">
                  {(data.insights?.recommendations?.length ? data.insights.recommendations : []).map((r, idx) => (
                    <div key={`${r.title}-${idx}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="font-medium text-white/90">{r.title}</div>
                      {!hideSensitive ? <div className="mt-1 text-sm text-white/65">{r.detail}</div> : null}
                    </div>
                  ))}

                  {!data.insights?.recommendations?.length ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/65">
                      No recommendations available yet. When ready, this can be powered by InsightCore + clinician-approved
                      templates.
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            {/* Daily breakdown */}
            <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-base font-semibold tracking-tight">Daily breakdown</h2>
                  <div className="mt-1 text-sm text-white/60">
                    {hideSensitive
                      ? 'Showing a simplified view.'
                      : 'Tap patterns over time — spikes matter more than single-day noise.'}
                  </div>
                </div>
                <div className="text-xs text-white/50">
                  Tip: keep this page as your “interactive view”, and use PDF for sending/sharing.
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                <div className="grid grid-cols-12 bg-white/[0.03] px-4 py-2 text-xs text-white/55">
                  <div className="col-span-3">Day</div>
                  <div className="col-span-2">Stress</div>
                  <div className="col-span-2">HRV</div>
                  <div className="col-span-2">Resting HR</div>
                  <div className="col-span-2">Sleep</div>
                  <div className="col-span-1 text-right">Notes</div>
                </div>

                <div className="max-h-[520px] overflow-auto">
                  {points
                    .slice()
                    .reverse()
                    .map((p) => {
                      const tag = scoreLabel(p.score);
                      return (
                        <div
                          key={p.dateISO}
                          className="grid grid-cols-12 items-center gap-2 border-t border-white/5 px-4 py-3 hover:bg-white/[0.03]"
                        >
                          <div className="col-span-3">
                            <div className="text-sm text-white/85">{hideSensitive ? '—' : fmtDatePretty(p.dateISO)}</div>
                            <div className="text-xs text-white/45">{p.dateISO}</div>
                          </div>

                          <div className="col-span-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{discreet ? '•••' : fmtNumber(p.score)}</span>
                              <span className={`rounded-full border px-2 py-0.5 text-[11px] ${tag.badge} ${tag.tone}`}>
                                {tag.label}
                              </span>
                            </div>
                          </div>

                          <div className="col-span-2 text-sm text-white/80">
                            {discreet ? '•••' : p.hrvMs ? `${fmtNumber(p.hrvMs)} ms` : '—'}
                          </div>

                          <div className="col-span-2 text-sm text-white/80">
                            {discreet ? '•••' : p.restingHr ? `${fmtNumber(p.restingHr)} bpm` : '—'}
                          </div>

                          <div className="col-span-2 text-sm text-white/80">
                            {discreet ? '•••' : p.sleepHours ? `${fmtNumber(p.sleepHours, 1)} h` : '—'}
                          </div>

                          <div className="col-span-1 text-right text-sm text-white/70">
                            {hideSensitive ? (
                              <span className="text-white/35">—</span>
                            ) : p.note ? (
                              <span title={p.note} className="inline-block max-w-[120px] truncate">
                                {p.note}
                              </span>
                            ) : (
                              <span className="text-white/35">—</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </section>

            {/* PDF preview (optional) */}
            {showPdfPreview && pdfUrl ? (
              <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-3">
                  <div>
                    <div className="text-sm font-medium text-white/90">PDF preview</div>
                    <div className="text-xs text-white/55">{pdfFilename}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/80 hover:text-white hover:bg-white/[0.07]"
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={handleSharePdf}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/80 hover:text-white hover:bg-white/[0.07]"
                    >
                      Share
                    </button>
                  </div>
                </div>

                <iframe
                  src={pdfUrl}
                  className="h-[75vh] w-full rounded-2xl border border-white/10 bg-black"
                  title="Stress Report PDF Preview"
                />
              </section>
            ) : null}

            {/* Footer note */}
            <div className="mt-8 text-xs text-white/45">
              This report is informational and not a diagnosis. If you feel persistently overwhelmed, consider reaching out to a clinician.
            </div>
          </>
        )}
      </div>
    </main>
  );
}
