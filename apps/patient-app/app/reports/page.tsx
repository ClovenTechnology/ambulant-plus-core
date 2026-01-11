// apps/patient-app/app/reports/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  HeartPulse,
  Moon,
  Activity,
  Brain,
  Download,
  Share2,
  RefreshCw,
  ShieldCheck,
  EyeOff,
  Eye,
  Info,
  ChevronRight,
  BarChart3,
  Clock,
  AlertTriangle,
} from 'lucide-react';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

import { toast } from '@/components/ToastMount';
import { generateHealthReport } from '@/src/analytics/report';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

type ReportResp = {
  summary?: Record<string, any>;
  latest?: Record<string, any>;
  trend?: Array<Record<string, any>>;
};

type TrendWindow = '15m' | '1h' | '6h' | '24h';

const REPORTS = [
  {
    href: '/reports/vitals',
    label: 'Vitals Report',
    desc: 'Blood pressure, heart rate, SpO₂, temperature, glucose',
    icon: HeartPulse,
    accent: 'from-rose-500 to-orange-400',
    pill: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  {
    href: '/reports/sleep',
    label: 'Sleep Report',
    desc: 'Sleep stages, efficiency, readiness, HR/HRV overnight',
    icon: Moon,
    accent: 'from-sky-500 to-indigo-500',
    pill: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  {
    href: '/reports/fertility',
    label: 'Fertility Report',
    desc: 'Cycle phase, ovulation prediction, temperature variation',
    icon: Activity,
    accent: 'from-pink-500 to-fuchsia-500',
    pill: 'bg-pink-50 text-pink-700 border-pink-200',
  },
  {
    href: '/reports/stress',
    label: 'Stress & HRV Report',
    desc: 'Daytime stress index, HRV metrics, recovery trends',
    icon: Brain,
    accent: 'from-emerald-500 to-teal-500',
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
] as const;

// Map IoMT data sources (used in cards)
const METRIC_SOURCES: Record<string, string> = {
  hr: 'NexRing',
  spo2: 'Health Monitor',
  temp_c: 'Health Monitor',
  sys: 'Health Monitor',
  dia: 'Health Monitor',
  glucose: 'DueCare CGM',
  bmi: 'DueCare Smart Scale',
};

const LS_DISCREET = 'ambulant.reports.discreet';
const LS_HIDE_SENSITIVE = 'ambulant.reports.hideSensitive';

function Pill({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={[
        'px-3 py-1.5 rounded-full border text-sm transition',
        active
          ? 'bg-slate-900 text-white border-slate-900'
          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function fmtNum(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n);
}

function safeDate(ts?: any) {
  const d = ts ? new Date(ts) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return d;
}

function windowToMs(w: TrendWindow) {
  if (w === '15m') return 15 * 60_000;
  if (w === '1h') return 60 * 60_000;
  if (w === '6h') return 6 * 60 * 60_000;
  return 24 * 60 * 60_000;
}

export default function ReportsHub() {
  const [report, setReport] = useState<ReportResp | null>(null);
  const [loadingVitals, setLoadingVitals] = useState(true);
  const [vitalsError, setVitalsError] = useState<string | null>(null);
  const [busyExport, setBusyExport] = useState(false);

  const [trendWindow, setTrendWindow] = useState<TrendWindow>('1h');

  const [discreet, setDiscreet] = useState(false);
  const [hideSensitive, setHideSensitive] = useState(false);

  // dataset toggles (keeps chart readable)
  const [seriesOn, setSeriesOn] = useState({
    hr: true,
    spo2: true,
    temp_c: false,
    sys: true,
    dia: false,
    glucose: false,
  });

  const intervalRef = useRef<any>(null);

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

  async function fetchVitals() {
    setLoadingVitals(true);
    setVitalsError(null);
    try {
      const res = await fetch('/api/reports/vitals', { cache: 'no-store' });
      const data = await res.json();
      setReport(data);
    } catch (e) {
      console.error(e);
      setReport(null);
      setVitalsError('Could not load vitals right now.');
    } finally {
      setLoadingVitals(false);
    }
  }

  useEffect(() => {
    fetchVitals();
    intervalRef.current = setInterval(fetchVitals, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const summary = report?.summary || {};
  const latest = report?.latest || {};
  const trendRaw = Array.isArray(report?.trend) ? report!.trend! : [];

  const trend = useMemo(() => {
    if (!trendRaw.length) return [];
    const now = Date.now();
    const cutoff = now - windowToMs(trendWindow);
    const filtered = trendRaw
      .map((t) => ({ ...t, _ms: safeDate(t.ts)?.getTime?.() ?? NaN }))
      .filter((t) => Number.isFinite(t._ms) && t._ms >= cutoff)
      .sort((a, b) => a._ms - b._ms);
    return filtered;
  }, [trendRaw, trendWindow]);

  const lastUpdated = useMemo(() => safeDate(latest?.ts), [latest?.ts]);

  const chartData = useMemo(() => {
    const labels = trend.map((t: any) => {
      if (hideSensitive) return 'Hidden';
      const d = safeDate(t.ts);
      return d ? d.toLocaleTimeString() : '';
    });

    const add = (key: keyof typeof seriesOn, label: string, color: string) => {
      if (!seriesOn[key]) return null;
      return {
        label,
        data: trend.map((t: any) => t[key]),
        borderColor: color,
        pointRadius: 0,
        tension: 0.25,
      };
    };

    const datasets = [
      add('hr', 'Heart Rate (bpm)', '#ef4444'),
      add('spo2', 'SpO₂ (%)', '#22c55e'),
      add('temp_c', 'Temperature (°C)', '#3b82f6'),
      add('sys', 'Systolic BP (mmHg)', '#f97316'),
      add('dia', 'Diastolic BP (mmHg)', '#eab308'),
      add('glucose', 'Glucose (mg/dL)', '#8b5cf6'),
    ].filter(Boolean) as any[];

    return { labels, datasets };
  }, [trend, seriesOn, hideSensitive]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
        tooltip: { enabled: !discreet },
      },
      scales: {
        x: { ticks: { maxTicksLimit: 8 } },
      },
    }),
    [discreet]
  );

  async function handleDownloadAll() {
    setBusyExport(true);
    try {
      const { blob, filename } = await generateHealthReport('current-user', {});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'health_report.pdf';
      a.click();
      setTimeout(() => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      }, 2500);
      toast('Download started.', { type: 'success' });
    } catch (e) {
      console.error(e);
      toast('Could not generate the PDF right now.', { type: 'error' });
    } finally {
      setBusyExport(false);
    }
  }

  async function handleShareAll() {
    setBusyExport(true);
    try {
      const { blob, filename } = await generateHealthReport('current-user', {});
      const file = new File([blob], filename || 'health_report.pdf', { type: 'application/pdf' });

      const navAny = navigator as any;
      if (navAny.share && navAny.canShare?.({ files: [file] })) {
        await navAny.share({
          title: 'Health Report',
          text: 'Here is my latest health report.',
          files: [file],
        });
      } else {
        toast('Sharing is not supported on this device/browser.', { type: 'info' });
      }
    } catch (e) {
      console.error(e);
      toast('Could not share the PDF.', { type: 'error' });
    } finally {
      setBusyExport(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 space-y-8">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Reports</h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">
                <ShieldCheck className="h-3.5 w-3.5" />
                Exports available
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600 max-w-2xl">
              Review your health signals in a clear UI, then export a PDF for sharing with clinicians or your records.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Pill
              active={discreet}
              onClick={() => setDiscreet((v) => !v)}
              title="Hide values across hub cards and chart"
            >
              {discreet ? (
                <span className="inline-flex items-center gap-2">
                  <EyeOff className="h-4 w-4" /> Discreet
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Eye className="h-4 w-4" /> Discreet
                </span>
              )}
            </Pill>
            <Pill
              active={hideSensitive}
              onClick={() => setHideSensitive((v) => !v)}
              title="Hide timestamps and identifiers"
            >
              Hide sensitive
            </Pill>

            <button
              onClick={handleDownloadAll}
              disabled={busyExport}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {busyExport ? 'Preparing…' : 'Download PDF'}
            </button>

            <button
              onClick={handleShareAll}
              disabled={busyExport}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
          </div>
        </header>

        {/* Report cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {REPORTS.map((r) => {
            const Icon = r.icon;
            return (
              <Link
                key={r.href}
                href={r.href}
                className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div
                      className={[
                        'h-12 w-12 rounded-2xl bg-gradient-to-br text-white flex items-center justify-center shadow-sm',
                        r.accent,
                      ].join(' ')}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-slate-900">{r.label}</h2>
                        <span className={['rounded-full border px-2 py-0.5 text-[11px]', r.pill].join(' ')}>
                          UI + PDF
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{r.desc}</p>
                    </div>
                  </div>

                  <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-slate-500 transition mt-1" />
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                  <Info className="h-4 w-4" />
                  Open to view insights, trends, and export options.
                </div>
              </Link>
            );
          })}
        </section>

        {/* Vitals snapshot */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-slate-400" />
                <h2 className="text-lg font-semibold text-slate-900">Vitals Snapshot</h2>
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {hideSensitive ? (
                  'Latest sync hidden.'
                ) : lastUpdated ? (
                  <span className="inline-flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-400" />
                    Last updated: {lastUpdated.toLocaleString()}
                  </span>
                ) : (
                  'No latest timestamp available.'
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Pill active={trendWindow === '15m'} onClick={() => setTrendWindow('15m')}>15m</Pill>
              <Pill active={trendWindow === '1h'} onClick={() => setTrendWindow('1h')}>1h</Pill>
              <Pill active={trendWindow === '6h'} onClick={() => setTrendWindow('6h')}>6h</Pill>
              <Pill active={trendWindow === '24h'} onClick={() => setTrendWindow('24h')}>24h</Pill>

              <button
                type="button"
                onClick={fetchVitals}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                title="Refresh now"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>

          {/* status */}
          {vitalsError ? (
            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <div>{vitalsError}</div>
            </div>
          ) : null}

          {/* quick stats */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.keys(summary || {}).length === 0 && !loadingVitals ? (
              <div className="col-span-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                No summary data yet. Connect devices or take readings to populate this section.
              </div>
            ) : (
              Object.entries(summary || {}).map(([k, v]) => {
                const src = METRIC_SOURCES[k] || '—';
                return (
                  <div key={k} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-xs text-slate-500">{k}</div>
                    <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                      {discreet ? '•••' : fmtNum(v)}
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500">Source: {src}</div>
                  </div>
                );
              })
            )}
          </div>

          {/* chart controls */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-medium text-slate-900">Trend</div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['hr', 'HR'],
                  ['spo2', 'SpO₂'],
                  ['temp_c', 'Temp'],
                  ['sys', 'SYS'],
                  ['dia', 'DIA'],
                  ['glucose', 'Glucose'],
                ] as Array<[keyof typeof seriesOn, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSeriesOn((s) => ({ ...s, [key]: !s[key] }))}
                  className={[
                    'rounded-full border px-3 py-1.5 text-sm transition',
                    seriesOn[key]
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* chart */}
          <div className="mt-3">
            {loadingVitals ? (
              <div className="h-[340px] rounded-2xl border border-slate-200 bg-slate-50 animate-pulse" />
            ) : trend.length > 0 ? (
              <div className="relative h-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className={discreet ? 'blur-md pointer-events-none select-none' : ''} style={{ height: '100%' }}>
                  <Line data={chartData} options={chartOptions as any} />
                </div>
                {discreet ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-700 shadow-sm backdrop-blur">
                      Discreet mode — chart hidden
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                No trend data available for the selected window.
              </div>
            )}
          </div>

          {/* latest readings */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium text-slate-900">Latest reading</div>
              <div className="text-xs text-slate-500">
                {hideSensitive ? 'Timestamp hidden' : lastUpdated ? lastUpdated.toLocaleString() : '—'}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { k: 'hr', label: 'Heart Rate', unit: 'bpm' },
                { k: 'spo2', label: 'SpO₂', unit: '%' },
                { k: 'temp_c', label: 'Temperature', unit: '°C' },
                { k: 'sys', label: 'Systolic', unit: 'mmHg' },
                { k: 'dia', label: 'Diastolic', unit: 'mmHg' },
                { k: 'glucose', label: 'Glucose', unit: 'mg/dL' },
                { k: 'bmi', label: 'BMI' },
              ].map(({ k, label, unit }) => {
                const v = (latest as any)?.[k];
                const src = METRIC_SOURCES[k] || '—';
                return (
                  <div key={k} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="text-xs text-slate-500">{label}</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">
                      {discreet ? '•••' : v ?? '—'}
                      {!discreet && v != null && unit ? <span className="ml-1 text-sm font-medium text-slate-500">{unit}</span> : null}
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500">Source: {src}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 text-xs text-slate-500">
            This snapshot is informational and not medical advice. For concerns, consult a clinician.
          </div>
        </section>

        {/* Footer helper */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-slate-900">Tip</div>
              <div className="mt-1 text-sm text-slate-600">
                Use the report pages for clean insight-first UI. Use PDF exports only when you need to share or store.
              </div>
            </div>
            <Link
              href="/reports/vitals"
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Open Vitals Report <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
