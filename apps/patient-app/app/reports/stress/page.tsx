// apps/patient-app/app/reports/stress/page.tsx
'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Brain,
  Download,
  Share2,
  Info,
  ShieldCheck,
  Sparkles,
  Waves,
  Activity,
  Moon,
} from 'lucide-react';

import { generateHealthReport } from '@/src/analytics/report';
import { toast } from '@/components/ToastMount';
import { usePlan } from '@/components/context/PlanContext';

type RangeKey = '7d' | '30d' | '90d' | '1y';

type StressTrendPoint = {
  ts: string;
  stressIndex?: number;
  hrv?: number;
  restingHr?: number;
  sleepScore?: number;
  activityLoad?: number;
};

type StressReportData = {
  ok: boolean;
  patientId: string;
  range: RangeKey;
  generatedAtISO: string;
  summary: {
    avgStressIndex: number | null;
    avgHrv: number | null;
    avgRestingHr: number | null;
    avgSleepScore: number | null;
    avgActivityLoad: number | null;
    sampleCounts: {
      hrv: number;
      restingHr: number;
      sleep: number;
      activity: number;
      directStress: number;
    };
  };
  latest: {
    ts: string | null;
    stressIndex?: number;
    hrv?: number;
    restingHr?: number;
    sleepScore?: number;
    activityLoad?: number;
  };
  trend: StressTrendPoint[];
  insights: {
    headline: string;
    highlights: Array<{ title: string; detail: string }>;
    recommendations: Array<{ title: string; detail: string }>;
  };
  sources: Record<string, { source: string; recorded_at: string | null; inferred?: boolean }>;
};

const LS_DISCREET = 'ambulant.reports.discreet';
const LS_HIDE_SENSITIVE = 'ambulant.reports.hideSensitive';

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function fmtDatePretty(iso?: string | null, hidden?: boolean) {
  if (!iso) return '—';
  if (hidden) return 'Hidden';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: '2-digit' });
}

function fmtDateTime(iso?: string | null, hidden?: boolean) {
  if (!iso) return '—';
  if (hidden) return 'Hidden';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function fmtNumber(n?: number | null, digits = 0) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(n);
}

function scoreTone(score: number) {
  if (score >= 75) return { label: 'High', tone: 'text-rose-300 bg-rose-500/15 border-rose-400/25' };
  if (score >= 45) return { label: 'Moderate', tone: 'text-amber-300 bg-amber-500/15 border-amber-400/25' };
  return { label: 'Low', tone: 'text-emerald-300 bg-emerald-500/15 border-emerald-400/25' };
}

function Sparkline({
  values,
  height = 56,
  ariaLabel,
}: {
  values: number[];
  height?: number;
  ariaLabel?: string;
}) {
  const w = 260;
  const pad = 6;

  if (!values.length) {
    return (
      <div
        role="img"
        aria-label={ariaLabel || 'Trend chart'}
        className="flex items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.03] text-xs text-white/55"
        style={{ height }}
      >
        No trend data available
      </div>
    );
  }

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

  const area = `${pts} ${w - pad},${height - pad} ${pad},${height - pad}`;

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${height}`} role="img" aria-label={ariaLabel || 'Trend chart'} className="block">
      <defs>
        <linearGradient id="stressSparkFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={`M ${area}`} fill="url(#stressSparkFill)" />
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
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
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  discreet?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
      <div className="flex items-center gap-2 text-xs text-white/60">
        {icon ? <span className="text-white/45">{icon}</span> : null}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-white">
        {discreet ? '•••' : value}
      </div>
      {sub ? <div className="mt-1 text-xs text-white/55">{sub}</div> : null}
    </div>
  );
}

function StressReportPageContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const queryParam = useCallback((key: string) => sp?.get(key)?.trim() ?? '', [sp]);
  const queryString = useMemo(() => sp?.toString() ?? '', [sp]);
  const { plan, isPremium } = usePlan();

  const range = useMemo<RangeKey>(() => {
    const r = queryParam('range') as RangeKey;
    if (r === '7d' || r === '30d' || r === '90d' || r === '1y') return r;
    return '30d';
  }, [queryParam]);

  useEffect(() => {
    const current = queryParam('range');
    if (!current) {
      const qs = new URLSearchParams(queryString);
      qs.set('range', range);
      router.replace(`/reports/stress?${qs.toString()}`);
    }
  }, [queryParam, queryString, range, router]);

  const patientId = useMemo(() => queryParam('patientId'), [queryParam]);

  const [discreet, setDiscreet] = useState(false);
  const [hideSensitive, setHideSensitive] = useState(false);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StressReportData | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFilename, setPdfFilename] = useState<string>('stress_report.pdf');
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const lastObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      setDiscreet((localStorage.getItem(LS_DISCREET) || '0') === '1');
      setHideSensitive((localStorage.getItem(LS_HIDE_SENSITIVE) || '0') === '1');
    } catch {}
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

      if (lastObjectUrlRef.current) {
        try {
          URL.revokeObjectURL(lastObjectUrlRef.current);
        } catch {}
        lastObjectUrlRef.current = null;
      }
      setPdfUrl(null);
      setShowPdfPreview(false);

      try {
        if (!patientId) {
          setData(null);
          setErrMsg('Patient identity is required before loading this report.');
          return;
        }

        const qs = new URLSearchParams({ patientId, range });
        const res = await fetch(`/api/reports/stress?${qs.toString()}`, { cache: 'no-store' });
        const json = (await res.json().catch(() => null)) as StressReportData | null;

        if (!alive) return;

        if (res.ok && json?.ok) {
          setData(json);
        } else {
          setData(null);
          setErrMsg('Could not load stress report right now.');
        }
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setData(null);
        setErrMsg('Could not load stress report right now.');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [patientId, range]);

  useEffect(() => {
    return () => {
      if (lastObjectUrlRef.current) {
        try {
          URL.revokeObjectURL(lastObjectUrlRef.current);
        } catch {}
      }
    };
  }, []);

  const trend = data?.trend ?? [];
  const latest = data?.latest;
  const summary = data?.summary;
  const sources = data?.sources ?? {};

  const lastScore = typeof latest?.stressIndex === 'number' ? latest.stressIndex : summary?.avgStressIndex ?? 0;
  const lastTone = scoreTone(Math.round(lastScore));
  const chartValues = trend
    .map((p) => (typeof p.stressIndex === 'number' ? clamp(p.stressIndex, 0, 100) : null))
    .filter((v): v is number => typeof v === 'number');

  const firstScore = chartValues[0] ?? lastScore;
  const trendPct = firstScore
    ? ((lastScore - firstScore) / firstScore) * 100
    : 0;

  async function ensurePdfGenerated() {
    if (pdfUrl) return true;
    if (!patientId) {
      toast('Patient identity is required before generating this report.', 'error');
      return false;
    }

    setPdfBusy(true);
    try {
      const { blob, filename } = await generateHealthReport(patientId, { stress: true });
      const url = URL.createObjectURL(blob);

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
      toast('Could not generate PDF right now.', 'error');
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
    toast('Download started.', 'success');
  }

  async function handleSharePdf() {
    const ok = await ensurePdfGenerated();
    if (!ok || !pdfUrl) return;

    try {
      const res = await fetch(pdfUrl);
      const blob = await res.blob();
      const file = new File([blob], pdfFilename || 'stress_report.pdf', { type: 'application/pdf' });

      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: 'Stress Report',
          text: 'Here is my stress report.',
          files: [file],
        });
      } else {
        toast('Sharing is not supported on this device/browser.', 'info');
      }
    } catch (e) {
      console.error(e);
      toast('Could not share the PDF.', 'error');
    }
  }

  function setRange(next: RangeKey) {
    const qs = new URLSearchParams(queryString);
    qs.set('range', next);
    router.push(`/reports/stress?${qs.toString()}`);
  }

  const generatedAtText = useMemo(() => {
    const iso = data?.generatedAtISO || new Date().toISOString();
    return new Date(iso).toLocaleString();
  }, [data?.generatedAtISO]);

  return (
    <main className="min-h-[calc(100vh-0px)] bg-gradient-to-b from-slate-950 via-slate-950 to-black text-white">
      <div className="mx-auto w-full max-w-6xl px-4 pt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/reports"
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white/80 hover:text-white hover:bg-white/[0.06]"
            >
              ← Reports
            </Link>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">Stress Report</h1>

                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-white/70">
                  {range.toUpperCase()}
                </span>

                <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-200">
                  Adapter-backed
                </span>

                {!isPremium ? (
                  <span className="rounded-full border border-fuchsia-400/25 bg-fuchsia-500/10 px-2 py-0.5 text-xs text-fuchsia-200">
                    Premium preview
                  </span>
                ) : (
                  <span className="rounded-full border border-indigo-400/25 bg-indigo-500/10 px-2 py-0.5 text-xs text-indigo-200">
                    {plan ? `${plan}` : 'Premium'}
                  </span>
                )}
              </div>

              <div className="mt-1 text-xs text-white/50">
                Generated: {generatedAtText}
                {!hideSensitive ? ` • Patient: ${data?.patientId || patientId}` : ''}
              </div>
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
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs text-white/55">Range</div>
            <Pill active={range === '7d'} onClick={() => setRange('7d')}>7D</Pill>
            <Pill active={range === '30d'} onClick={() => setRange('30d')}>30D</Pill>
            <Pill active={range === '90d'} onClick={() => setRange('90d')}>90D</Pill>
            <Pill active={range === '1y'} onClick={() => setRange('1y')}>1Y</Pill>

            {errMsg ? <span className="ml-2 text-xs text-white/55">{errMsg}</span> : null}
          </div>

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
      </div>

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
            <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] via-white/[0.03] to-transparent p-6 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
              <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-[11px] font-medium text-sky-200">
                    <Brain className="h-3.5 w-3.5" />
                    Recovery and stress intelligence
                  </div>

                  <div className="mt-4 flex flex-wrap items-end gap-3">
                    <div className="text-4xl font-semibold tracking-tight text-white">
                      {discreet ? '•••' : fmtNumber(Math.round(lastScore))}
                      <span className="ml-1 text-base font-normal text-white/60">/ 100</span>
                    </div>

                    <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${lastTone.tone}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                      {lastTone.label}
                    </span>

                    <span className="text-xs text-white/55">
                      {trendPct >= 0 ? '▲' : '▼'} {discreet ? '•••' : `${fmtNumber(Math.abs(trendPct), 1)}%`}{' '}
                      <span className="text-white/45">vs start of range</span>
                    </span>
                  </div>

                  <div className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
                    {data.insights?.headline ||
                      'Stress score is a composite indicator. Use trends over time, not a single day, to guide habits.'}
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-4">
                    <StatCard
                      label="Average stress"
                      value={`${fmtNumber(summary?.avgStressIndex, 0)} / 100`}
                      sub="Across selected range"
                      discreet={discreet}
                      icon={<Sparkles className="h-4 w-4" />}
                    />
                    <StatCard
                      label="Average HRV"
                      value={`${fmtNumber(summary?.avgHrv, 0)} ms`}
                      sub={`Samples: ${summary?.sampleCounts.hrv ?? 0}`}
                      discreet={discreet}
                      icon={<Waves className="h-4 w-4" />}
                    />
                    <StatCard
                      label="Average resting HR"
                      value={`${fmtNumber(summary?.avgRestingHr, 0)} bpm`}
                      sub={`Samples: ${summary?.sampleCounts.restingHr ?? 0}`}
                      discreet={discreet}
                      icon={<Activity className="h-4 w-4" />}
                    />
                    <StatCard
                      label="Average sleep score"
                      value={`${fmtNumber(summary?.avgSleepScore, 0)} / 100`}
                      sub={`Source: ${sources.sleepScore?.source || 'Unavailable'}`}
                      discreet={discreet}
                      icon={<Moon className="h-4 w-4" />}
                    />
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-white">Stress trend</div>
                      <div className="mt-1 text-xs text-white/55">{trend.length} points in view</div>
                    </div>
                    <span className="rounded-full bg-white/5 px-2 py-1 text-xs text-white/55 shadow-sm">
                      {hideSensitive ? 'Timestamp hidden' : fmtDatePretty(latest?.ts)}
                    </span>
                  </div>

                  <div className="mt-4 text-white/80">
                    <Sparkline
                      values={chartValues}
                      ariaLabel="Stress score trend"
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-xs text-white/55">Direct stress samples</div>
                      <div className="mt-1 text-xl font-semibold text-white">
                        {discreet ? '•••' : fmtNumber(summary?.sampleCounts.directStress ?? 0)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-xs text-white/55">Latest timestamp</div>
                      <div className="mt-1 text-sm font-medium text-white">
                        {hideSensitive ? 'Hidden' : fmtDateTime(latest?.ts)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold tracking-tight text-white">Highlights</h2>
                  <span className="text-xs text-white/55">Key patterns</span>
                </div>

                <div className="mt-4 space-y-3">
                  {data.insights?.highlights?.length ? (
                    data.insights.highlights.map((h, idx) => (
                      <div key={`${h.title}-${idx}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="font-medium text-white/90">{h.title}</div>
                        {!hideSensitive ? <div className="mt-1 text-sm text-white/65">{h.detail}</div> : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/65">
                      No highlights available yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold tracking-tight text-white">Recommendations</h2>
                  <span className="text-xs text-white/55">Practical next steps</span>
                </div>

                <div className="mt-4 space-y-3">
                  {data.insights?.recommendations?.length ? (
                    data.insights.recommendations.map((r, idx) => (
                      <div key={`${r.title}-${idx}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="font-medium text-white/90">{r.title}</div>
                        {!hideSensitive ? <div className="mt-1 text-sm text-white/65">{r.detail}</div> : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/65">
                      No recommendations available yet.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-white">Daily breakdown</h2>
                  <div className="mt-1 text-sm text-white/60">
                    Derived stress, HRV, resting HR, sleep score, and activity load.
                  </div>
                </div>
                <div className="text-xs text-white/50">Use this page for interaction; use PDF for sending.</div>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                <div className="grid grid-cols-12 bg-white/[0.03] px-4 py-2 text-xs text-white/55">
                  <div className="col-span-3">Day</div>
                  <div className="col-span-2">Stress</div>
                  <div className="col-span-2">HRV</div>
                  <div className="col-span-2">Resting HR</div>
                  <div className="col-span-2">Sleep</div>
                  <div className="col-span-1 text-right">Load</div>
                </div>

                <div className="max-h-[560px] overflow-auto">
                  {trend
                    .slice()
                    .reverse()
                    .map((p) => {
                      const tag = scoreTone(Math.round(p.stressIndex ?? 0));
                      return (
                        <div
                          key={p.ts}
                          className="grid grid-cols-12 items-center gap-2 border-t border-white/5 px-4 py-3 hover:bg-white/[0.03]"
                        >
                          <div className="col-span-3">
                            <div className="text-sm text-white/85">{fmtDatePretty(p.ts, hideSensitive)}</div>
                            <div className="text-xs text-white/45">{hideSensitive ? 'Timestamp hidden' : fmtDateTime(p.ts)}</div>
                          </div>

                          <div className="col-span-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white">
                                {discreet ? '•••' : fmtNumber(p.stressIndex, 0)}
                              </span>
                              <span className={`rounded-full border px-2 py-0.5 text-[11px] ${tag.tone}`}>
                                {tag.label}
                              </span>
                            </div>
                          </div>

                          <div className="col-span-2 text-sm text-white/80">
                            {discreet ? '•••' : typeof p.hrv === 'number' ? `${fmtNumber(p.hrv, 0)} ms` : '—'}
                          </div>

                          <div className="col-span-2 text-sm text-white/80">
                            {discreet ? '•••' : typeof p.restingHr === 'number' ? `${fmtNumber(p.restingHr, 0)} bpm` : '—'}
                          </div>

                          <div className="col-span-2 text-sm text-white/80">
                            {discreet ? '•••' : typeof p.sleepScore === 'number' ? `${fmtNumber(p.sleepScore, 0)} / 100` : '—'}
                          </div>

                          <div className="col-span-1 text-right text-sm text-white/70">
                            {discreet ? '•••' : typeof p.activityLoad === 'number' ? fmtNumber(p.activityLoad, 0) : '—'}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </section>

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

            <div className="mt-8 text-xs text-white/45">
              This report is informational and not a diagnosis. If you feel persistently overwhelmed, consider reaching out to a clinician.
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function StressReportPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 p-6 text-sm text-white/70">
          Loading stress report…
        </main>
      }
    >
      <StressReportPageContent />
    </Suspense>
  );
}
