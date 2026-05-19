// apps/patient-app/app/reports/fertility/page.tsx
'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CalendarDays,
  Download,
  Share2,
  Sparkles,
  ShieldCheck,
  Activity,
  Thermometer,
  HeartPulse,
  Baby,
  Info,
} from 'lucide-react';

import { toast } from '@/components/ToastMount';
import { usePlan } from '@/components/context/PlanContext';
import { generateHealthReport } from '@/src/analytics/report';

type RangeKey = '30d' | '90d' | '1y';

type FertilityTrendPoint = {
  date: string;
  deltaTemp?: number;
  tempC?: number;
  hrv?: number;
  rhr?: number;
  spo2?: number;
  phase?: string;
  confidence?: number;
};

type FertilityReportResponse = {
  ok: boolean;
  patientId: string;
  range: RangeKey;
  generatedAtISO: string;
  summary: {
    currentPhase: string;
    confidence: number;
    baselineTempC: number | null;
    latestTempDelta: number | null;
    avgHrv: number | null;
    avgRhr: number | null;
    likelyPregnancy: boolean;
    pregnancyConfidence: number;
    sampleCounts: {
      temperature: number;
      hrv: number;
      rhr: number;
      spo2: number;
    };
  };
  latest: {
    date: string | null;
    deltaTemp?: number;
    tempC?: number;
    hrv?: number;
    rhr?: number;
    spo2?: number;
    phase?: string;
    confidence?: number;
  };
  trend: FertilityTrendPoint[];
  insights: {
    headline: string;
    bullets: string[];
    recommendations: Array<{ title: string; detail: string }>;
  };
  sources: Record<string, { source: string; recorded_at: string | null; inferred?: boolean }>;
};

const LS_DISCREET = 'ambulant.reports.discreet';
const LS_HIDE_SENSITIVE = 'ambulant.reports.hideSensitive';

const LS_FERT_PREFS = 'fertilityPrefs';

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function fmtNumber(n?: number | null, digits = 0) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(n);
}

function fmtDatePretty(dateISO?: string | null, hidden?: boolean) {
  if (!dateISO) return '—';
  if (hidden) return 'Hidden';
  const d = new Date(dateISO + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: '2-digit' });
}

function phaseLabel(phase?: string) {
  switch (phase) {
    case 'period':
      return { label: 'Period', tone: 'text-rose-700 bg-rose-50 border-rose-200' };
    case 'ovulation':
      return { label: 'Ovulation', tone: 'text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200' };
    case 'luteal':
      return { label: 'Luteal', tone: 'text-indigo-700 bg-indigo-50 border-indigo-200' };
    case 'follicular':
      return { label: 'Follicular', tone: 'text-sky-700 bg-sky-50 border-sky-200' };
    default:
      return { label: 'Uncertain', tone: 'text-slate-700 bg-slate-50 border-slate-200' };
  }
}

function confidenceTone(conf?: number | null) {
  const c = typeof conf === 'number' ? conf : 0;
  if (c >= 0.8) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (c >= 0.5) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-slate-700 bg-slate-50 border-slate-200';
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
          ? 'bg-slate-900 text-white border-slate-900'
          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  discreet,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  discreet?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        {icon ? <span className="text-slate-400">{icon}</span> : null}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
        {discreet ? '•••' : value}
      </div>
      {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
    </div>
  );
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
  const safe = values.length ? values : [0, 0.1, 0.05, 0.18, 0.08, 0.24, 0.16];
  const w = 260;
  const pad = 6;
  const vmin = Math.min(...safe);
  const vmax = Math.max(...safe);
  const span = Math.max(1e-6, vmax - vmin);

  const pts = safe
    .map((v, i) => {
      const x = pad + (i * (w - pad * 2)) / Math.max(1, safe.length - 1);
      const y = pad + ((vmax - v) * (height - pad * 2)) / span;
      return [x, y] as const;
    })
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ');

  const area = `${pts} ${w - pad},${height - pad} ${pad},${height - pad}`;

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${height}`} role="img" aria-label={ariaLabel || 'Trend'} className="block">
      <defs>
        <linearGradient id="fertSparkFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      <path d={`M ${area}`} fill="url(#fertSparkFill)" />
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function FertilityReportPageContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const queryParam = useCallback((key: string) => sp?.get(key)?.trim() ?? '', [sp]);
  const queryString = useMemo(() => sp?.toString() ?? '', [sp]);
  const { plan, isPremium } = usePlan();

  const range = useMemo<RangeKey>(() => {
    const r = queryParam('range') as RangeKey;
    if (r === '30d' || r === '90d' || r === '1y') return r;
    return '90d';
  }, [queryParam]);

  useEffect(() => {
    const current = queryParam('range');
    if (!current) {
      const qs = new URLSearchParams(queryString);
      qs.set('range', range);
      router.replace(`/reports/fertility?${qs.toString()}`);
    }
  }, [queryParam, queryString, range, router]);

  const patientId = useMemo(() => queryParam('patientId'), [queryParam]);

  const [discreet, setDiscreet] = useState(false);
  const [hideSensitive, setHideSensitive] = useState(false);

  const [lmp, setLmp] = useState<string>('');
  const [cycleDays, setCycleDays] = useState<number | ''>('');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FertilityReportResponse | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFilename, setPdfFilename] = useState<string>('fertility_report.pdf');
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
    try {
      const saved = localStorage.getItem(LS_FERT_PREFS);
      if (saved) {
        const p = JSON.parse(saved) as { lmp?: string; cycleDays?: number };
        if (p?.lmp) setLmp(p.lmp);
        if (typeof p?.cycleDays === 'number') setCycleDays(p.cycleDays);
      }
    } catch {}
  }, []);

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
        if (lmp) qs.set('lmp', lmp);
        if (cycleDays) qs.set('cycleDays', String(cycleDays));

        const res = await fetch(`/api/reports/fertility?${qs.toString()}`, { cache: 'no-store' });
        const json = (await res.json().catch(() => null)) as FertilityReportResponse | null;

        if (!alive) return;

        if (res.ok && json?.ok) {
          setData(json);
        } else {
          setData(null);
          setErrMsg('Could not load fertility report right now.');
        }
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setData(null);
        setErrMsg('Could not load fertility report right now.');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [patientId, range, lmp, cycleDays]);

  useEffect(() => {
    return () => {
      if (lastObjectUrlRef.current) {
        try {
          URL.revokeObjectURL(lastObjectUrlRef.current);
        } catch {}
      }
    };
  }, []);

  function savePrefs() {
    if (!lmp || !cycleDays) {
      toast('Please set LMP and cycle length.', 'error');
      return;
    }

    const fixed = {
      lmp,
      cycleDays: clamp(Math.round(Number(cycleDays)), 21, 35),
    };

    try {
      localStorage.setItem(LS_FERT_PREFS, JSON.stringify(fixed));
    } catch {}

    setCycleDays(fixed.cycleDays);
    toast('Fertility preferences saved.', 'success');
  }

  const summary = data?.summary;
  const latest = data?.latest;
  const trend = data?.trend ?? [];
  const phaseUI = phaseLabel(summary?.currentPhase);
  const confPct = clamp(Math.round((summary?.confidence ?? 0) * 100), 0, 100);

  const tempVals = trend.map((p) => (typeof p.deltaTemp === 'number' ? p.deltaTemp : 0));
  const hrvVals = trend.map((p) => (typeof p.hrv === 'number' ? p.hrv : 0));
  const rhrVals = trend.map((p) => (typeof p.rhr === 'number' ? p.rhr : 0));

  async function ensurePdfGenerated() {
    if (pdfUrl) return true;
    if (!patientId) {
      toast('Patient identity is required before generating this report.', 'error');
      return false;
    }

    setPdfBusy(true);
    try {
      const { blob, filename } = await generateHealthReport(patientId, { fertility: true });
      const url = URL.createObjectURL(blob);

      if (lastObjectUrlRef.current) {
        try {
          URL.revokeObjectURL(lastObjectUrlRef.current);
        } catch {}
      }
      lastObjectUrlRef.current = url;

      setPdfUrl(url);
      setPdfFilename(filename || 'fertility_report.pdf');
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
    a.download = pdfFilename || 'fertility_report.pdf';
    a.click();
    toast('Download started.', 'success');
  }

  async function handleSharePdf() {
    const ok = await ensurePdfGenerated();
    if (!ok || !pdfUrl) return;
    try {
      const res = await fetch(pdfUrl);
      const blob = await res.blob();
      const file = new File([blob], pdfFilename || 'fertility_report.pdf', { type: 'application/pdf' });

      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: 'Fertility Report',
          text: 'Here is my fertility report.',
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
    router.push(`/reports/fertility?${qs.toString()}`);
  }

  const generatedAtText = useMemo(() => {
    const iso = data?.generatedAtISO || new Date().toISOString();
    return new Date(iso).toLocaleString();
  }, [data?.generatedAtISO]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-6xl px-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/reports"
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              ← Reports
            </Link>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">Fertility Report</h1>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">
                  {range.toUpperCase()}
                </span>

                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                  Adapter-backed
                </span>

                {!isPremium ? (
                  <span className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2 py-0.5 text-xs text-fuchsia-700">
                    Premium preview
                  </span>
                ) : (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                    Premium
                  </span>
                )}
              </div>

              <div className="mt-1 text-xs text-slate-500">
                Generated: {generatedAtText}
                {plan ? ` • Plan: ${plan}` : ''}
                {!hideSensitive ? ` • Patient: ${data?.patientId || patientId}` : ''}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Pill active={discreet} onClick={() => setDiscreet((v) => !v)} title="Hide numbers across the report">
              Discreet
            </Pill>
            <Pill active={hideSensitive} onClick={() => setHideSensitive((v) => !v)} title="Hide timing + notes">
              Hide sensitive
            </Pill>

            <button
              type="button"
              onClick={async () => {
                const ok = await ensurePdfGenerated();
                if (!ok) return;
                setShowPdfPreview((v) => !v);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              disabled={pdfBusy}
            >
              <Info className="h-4 w-4" />
              {pdfBusy ? 'Preparing…' : showPdfPreview ? 'Hide PDF' : 'Preview PDF'}
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              disabled={pdfBusy}
            >
              <Download className="h-4 w-4" />
              Download
            </button>

            <button
              type="button"
              onClick={handleSharePdf}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              disabled={pdfBusy}
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="text-xs text-slate-500">Range</div>
          <Pill active={range === '30d'} onClick={() => setRange('30d')}>30D</Pill>
          <Pill active={range === '90d'} onClick={() => setRange('90d')}>90D</Pill>
          <Pill active={range === '1y'} onClick={() => setRange('1y')}>1Y</Pill>

          {errMsg ? (
            <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
              {errMsg}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">Loading fertility report…</div>
        ) : !data ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">Could not load the report.</div>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Preferences</div>
                    <div className="mt-1 text-xs text-slate-500">Improves phase + pregnancy confidence</div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Local only
                  </span>
                </div>

                <div className="mt-4 grid gap-3">
                  <label className="block">
                    <span className="text-xs text-slate-600">LMP (Last menstrual period)</span>
                    <input
                      type="date"
                      value={lmp}
                      onChange={(e) => setLmp(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm text-slate-900 outline-none focus:border-slate-300"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs text-slate-600">Cycle length (days)</span>
                    <input
                      type="number"
                      min={21}
                      max={35}
                      value={cycleDays}
                      onChange={(e) => setCycleDays(e.target.value ? Number(e.target.value) : '')}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm text-slate-900 outline-none focus:border-slate-300"
                      placeholder="e.g. 28"
                    />
                    <div className="mt-1 text-[11px] text-slate-500">We clamp to 21–35 days for stability.</div>
                  </label>

                  <button
                    type="button"
                    onClick={savePrefs}
                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Save preferences
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-slate-600">Current phase</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${phaseUI.tone}`}>
                        <Sparkles className="h-3.5 w-3.5" />
                        {phaseUI.label}
                      </span>
                      <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${confidenceTone(summary?.confidence)}`}>
                        Confidence {discreet ? '•••' : `${confPct}%`}
                      </span>
                    </div>

                    <div className="mt-3 max-w-2xl text-sm text-slate-600">
                      {hideSensitive ? 'Explanation hidden.' : data.insights?.headline}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-medium text-slate-700">Pregnancy signal</div>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={[
                          'rounded-full border px-2.5 py-1 text-xs font-medium',
                          summary?.likelyPregnancy
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-white border-slate-200 text-slate-700',
                        ].join(' ')}
                      >
                        {summary?.likelyPregnancy ? 'LIKELY' : 'NONE'}
                        {!discreet ? ` • ${fmtNumber((summary?.pregnancyConfidence ?? 0) * 100, 0)}%` : ''}
                      </span>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500">
                      Not a diagnosis. Confirm clinically.
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-4">
                  <StatCard
                    icon={<Thermometer className="h-4 w-4" />}
                    label="Baseline temp"
                    value={`${fmtNumber(summary?.baselineTempC, 2)}°C`}
                    sub={`Samples: ${summary?.sampleCounts.temperature ?? 0}`}
                    discreet={discreet}
                  />
                  <StatCard
                    icon={<Activity className="h-4 w-4" />}
                    label="Latest temp Δ"
                    value={`${typeof summary?.latestTempDelta === 'number' && summary.latestTempDelta >= 0 ? '+' : ''}${fmtNumber(summary?.latestTempDelta, 2)}°C`}
                    sub="Relative to baseline"
                    discreet={discreet}
                  />
                  <StatCard
                    icon={<HeartPulse className="h-4 w-4" />}
                    label="Average HRV"
                    value={`${fmtNumber(summary?.avgHrv, 0)} ms`}
                    sub={`Samples: ${summary?.sampleCounts.hrv ?? 0}`}
                    discreet={discreet}
                  />
                  <StatCard
                    icon={<Baby className="h-4 w-4" />}
                    label="Average RHR"
                    value={`${fmtNumber(summary?.avgRhr, 0)} bpm`}
                    sub={`Samples: ${summary?.sampleCounts.rhr ?? 0}`}
                    discreet={discreet}
                  />
                </div>
              </div>
            </section>

            <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Thermometer className="h-4 w-4 text-slate-500" />
                    Temperature delta
                  </div>
                  <span className="text-xs text-slate-500">Trend</span>
                </div>
                <div className="mt-2 text-indigo-700">
                  <Sparkline values={tempVals} ariaLabel="Temperature delta trend" />
                </div>
                <div className="mt-2 text-xs text-slate-500">Sustained post-ovulation rise can be informative.</div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <HeartPulse className="h-4 w-4 text-slate-500" />
                    HRV
                  </div>
                  <span className="text-xs text-slate-500">Trend</span>
                </div>
                <div className="mt-2 text-sky-700">
                  <Sparkline values={hrvVals} ariaLabel="HRV trend" />
                </div>
                <div className="mt-2 text-xs text-slate-500">Dips can happen around ovulation or stress load.</div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Activity className="h-4 w-4 text-slate-500" />
                    Resting HR
                  </div>
                  <span className="text-xs text-slate-500">Trend</span>
                </div>
                <div className="mt-2 text-emerald-700">
                  <Sparkline values={rhrVals} ariaLabel="Resting HR trend" />
                </div>
                <div className="mt-2 text-xs text-slate-500">Often rises modestly during luteal phase.</div>
              </div>
            </section>

            <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">Cycle summary</div>
                  <span className="text-xs text-slate-500">Adapter-derived</span>
                </div>

                <div className="mt-4 space-y-2">
                  {data.insights?.bullets?.length ? (
                    data.insights.bullets.map((b, i) => (
                      <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        {hideSensitive ? 'Hidden' : b}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      Summary unavailable.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">Recommendations</div>
                  <span className="text-xs text-slate-500">Next steps</span>
                </div>

                <div className="mt-4 space-y-3">
                  {data.insights?.recommendations?.length ? (
                    data.insights.recommendations.map((r, idx) => (
                      <div key={`${r.title}-${idx}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="font-medium text-slate-900">{r.title}</div>
                        {!hideSensitive ? <div className="mt-1 text-sm text-slate-600">{r.detail}</div> : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      No recommendations available yet.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-slate-900">Daily signals</h2>
                  <div className="mt-1 text-sm text-slate-600">
                    Temperature delta • HRV • Resting HR • SpO₂ • phase inference
                  </div>
                </div>
                <div className="text-xs text-slate-500">Use this UI for analysis; export PDF for sharing.</div>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                <div className="grid grid-cols-12 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                  <div className="col-span-3">Day</div>
                  <div className="col-span-2">Temp Δ</div>
                  <div className="col-span-2">HRV</div>
                  <div className="col-span-2">RHR</div>
                  <div className="col-span-2">SpO₂</div>
                  <div className="col-span-1 text-right">Phase</div>
                </div>

                <div className="max-h-[560px] overflow-auto">
                  {trend
                    .slice()
                    .reverse()
                    .map((p) => {
                      const tag = phaseLabel(p.phase);
                      return (
                        <div key={p.date} className="grid grid-cols-12 items-center gap-2 border-t border-slate-100 px-4 py-3 hover:bg-slate-50">
                          <div className="col-span-3">
                            <div className="text-sm font-medium text-slate-900">{fmtDatePretty(p.date, hideSensitive)}</div>
                            <div className="text-xs text-slate-500">{hideSensitive ? 'Date hidden' : p.date}</div>
                          </div>

                          <div className="col-span-2 text-sm text-slate-700">
                            {discreet ? '•••' : typeof p.deltaTemp === 'number' ? `${p.deltaTemp >= 0 ? '+' : ''}${p.deltaTemp.toFixed(2)}°C` : '—'}
                          </div>

                          <div className="col-span-2 text-sm text-slate-700">
                            {discreet ? '•••' : typeof p.hrv === 'number' ? `${fmtNumber(p.hrv, 0)} ms` : '—'}
                          </div>

                          <div className="col-span-2 text-sm text-slate-700">
                            {discreet ? '•••' : typeof p.rhr === 'number' ? `${fmtNumber(p.rhr, 0)} bpm` : '—'}
                          </div>

                          <div className="col-span-2 text-sm text-slate-700">
                            {discreet ? '•••' : typeof p.spo2 === 'number' ? `${fmtNumber(p.spo2, 0)}%` : '—'}
                          </div>

                          <div className="col-span-1 text-right">
                            <span className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${tag.tone}`}>
                              {tag.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="mt-3 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Info className="h-3.5 w-3.5" />
                  Fertility predictions improve with continuous wear and stronger cycle anchors.
                </span>
              </div>
            </section>

            {showPdfPreview && pdfUrl ? (
              <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">PDF preview</div>
                    <div className="text-xs text-slate-500">{pdfFilename}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={handleSharePdf}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Share2 className="h-4 w-4" />
                      Share
                    </button>
                  </div>
                </div>

                <iframe
                  src={pdfUrl}
                  className="h-[75vh] w-full rounded-2xl border border-slate-200 bg-white"
                  title="Fertility Report PDF Preview"
                />
              </section>
            ) : null}

            <div className="mt-8 text-xs text-slate-500">
              This report is informational and not a diagnosis. If you have concerns or persistent symptoms, consult a clinician.
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function FertilityReportPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 p-6 text-sm text-slate-600">
          Loading fertility report…
        </main>
      }
    >
      <FertilityReportPageContent />
    </Suspense>
  );
}
