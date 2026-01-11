// apps/patient-app/app/reports/sleep/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { generateHealthReport } from '@/src/analytics/report';
import { computeSleepQuality, type SleepStages } from '@/src/analytics/sleep';
import { toast } from '@/components/ToastMount';
import { usePlan } from '@/components/context/PlanContext';

type RangeKey = '7d' | '30d' | '90d' | '1y';

type SleepNightPoint = {
  dateISO: string; // YYYY-MM-DD (night ending on this date)
  bedtimeISO: string; // ISO datetime
  wakeISO: string; // ISO datetime
  stagesMin: SleepStages; // minutes
  hrv: number; // ms (avg overnight)
  efficiency: number; // 0..1
  qualityScore: number; // 0..100
  qualityLabel: string; // Excellent|Good|Poor (from computeSleepQuality)
  note?: string | null;
};

type SleepReportData = {
  ok: boolean;
  userId: string;
  range: RangeKey;
  generatedAtISO: string;
  nights: SleepNightPoint[];
  insights?: {
    headline?: string;
    highlights?: Array<{ title: string; detail: string }>;
    recommendations?: Array<{ title: string; detail: string }>;
  };
};

const LS_DISCREET = 'ambulant.reports.discreet';
const LS_HIDE_SENSITIVE = 'ambulant.reports.hideSensitive';

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function fmtNumber(n: number, digits = 0) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(n);
}

function fmtDatePretty(dateISO: string) {
  const d = new Date(dateISO + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: '2-digit' });
}

function fmtTimeLocal(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function minutesToHours(min: number) {
  return min / 60;
}

function smoothRand(seed: number) {
  let t = seed % 2147483647;
  return () => {
    t = (t * 48271) % 2147483647;
    return (t & 0xfffffff) / 0xfffffff;
  };
}

function makeMockSleepReport(range: RangeKey, userId = 'patient-123'): SleepReportData {
  const nights = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const rnd = smoothRand(seed);

  // Baselines
  let baseBedMin = 420 + (rnd() * 40 - 20); // ~7h
  let baseEff = 0.86 + (rnd() * 0.06 - 0.03); // 0.83..0.89
  let baseHrv = 52 + (rnd() * 10 - 5); // ~47..57

  const out: SleepNightPoint[] = [];

  for (let i = nights - 1; i >= 0; i--) {
    const end = new Date(today);
    end.setDate(today.getDate() - i);
    const dateISO = end.toISOString().slice(0, 10);

    // Drift
    baseBedMin = clamp(baseBedMin + (rnd() * 10 - 5), 330, 520);
    baseEff = clamp(baseEff + (rnd() * 0.02 - 0.01), 0.74, 0.93);
    baseHrv = clamp(baseHrv + (rnd() * 3 - 1.5), 28, 85);

    // Occasional bad night
    const bad = rnd() > 0.92;
    const veryGood = rnd() > 0.94;

    const timeInBedMin = clamp(baseBedMin + (bad ? 25 : 0) + (veryGood ? -10 : 0), 320, 560);
    const awakeMin = clamp(
      Math.round(timeInBedMin * (bad ? 0.14 : 0.07) + (rnd() * 10 - 5)),
      18,
      110
    );

    const sleepMin = timeInBedMin - awakeMin;

    // Split sleep into stages (roughly)
    // Deep: 14–22%, REM: 18–26%, Light: rest
    const deepPct = clamp((bad ? 0.12 : 0.18) + (rnd() * 0.06 - 0.03), 0.10, 0.26);
    const remPct = clamp((bad ? 0.16 : 0.22) + (rnd() * 0.06 - 0.03), 0.12, 0.30);

    const deep = Math.round(sleepMin * deepPct);
    const rem = Math.round(sleepMin * remPct);
    const light = Math.max(0, sleepMin - deep - rem);

    const efficiency = clamp(sleepMin / Math.max(1, timeInBedMin), 0.65, 0.96);

    const hrv = clamp(
      Math.round(baseHrv + (veryGood ? 6 : 0) - (bad ? 8 : 0) + (rnd() * 6 - 3)),
      25,
      95
    );

    // Bed / wake times (local-ish)
    // Bedtime around 22:30–00:30
    const bedtime = new Date(end);
    bedtime.setDate(end.getDate() - 1);
    bedtime.setHours(22 + Math.floor(rnd() * 3)); // 22..24
    bedtime.setMinutes(Math.floor(rnd() * 60));
    bedtime.setSeconds(0, 0);

    const wake = new Date(bedtime);
    wake.setMinutes(wake.getMinutes() + timeInBedMin);

    const stagesMin: SleepStages = { rem, deep, light, awake: awakeMin };
    const q = computeSleepQuality(stagesMin, hrv, efficiency);
    const qualityScore = clamp(Math.round(q.score), 0, 100);

    const note =
      bad ? 'Fragmented night (more awakenings)' : veryGood ? 'Solid recovery night' : rnd() > 0.93 ? 'Late bedtime' : null;

    out.push({
      dateISO,
      bedtimeISO: bedtime.toISOString(),
      wakeISO: wake.toISOString(),
      stagesMin,
      hrv,
      efficiency,
      qualityScore,
      qualityLabel: q.label,
      note,
    });
  }

  const avgScore = out.reduce((s, n) => s + n.qualityScore, 0) / Math.max(1, out.length);
  const headline =
    avgScore >= 80
      ? 'Strong sleep quality overall — keep protecting your routine.'
      : avgScore >= 60
      ? 'Decent sleep quality — a few small tweaks can improve consistency.'
      : 'Sleep quality is struggling — focus on routine, recovery, and stress buffers.';

  const highlights = [
    {
      title: 'Quality trend',
      detail: 'Use the range selector to spot patterns (workload, bedtime drift, weekends).',
    },
    {
      title: 'Restorative sleep',
      detail: 'Deep + REM are the “recovery” core — aim to protect both with consistent sleep windows.',
    },
    {
      title: 'Efficiency',
      detail: 'High efficiency usually means fewer awakenings and smoother sleep continuity.',
    },
  ];

  const recommendations = [
    {
      title: 'Protect a consistent bedtime window',
      detail: 'Try to keep bedtime within ±45 minutes for 5–6 nights per week.',
    },
    {
      title: 'Wind-down cue',
      detail: 'A 10–15 minute low-light wind-down (no heavy scrolling) improves sleep onset for many people.',
    },
    {
      title: 'Recovery stacking',
      detail: 'If your day was intense, prioritize hydration + light movement + earlier bedtime.',
    },
  ];

  return {
    ok: true,
    userId,
    range,
    generatedAtISO: new Date().toISOString(),
    nights: out,
    insights: { headline, highlights, recommendations },
  };
}

/* ------------------------------
   UI bits
--------------------------------*/
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{discreet ? '•••' : value}</div>
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

  const area = `${pts} ${w - pad},${height - pad} ${pad},${height - pad}`;

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${height}`} role="img" aria-label={ariaLabel || 'Trend chart'} className="block">
      <defs>
        <linearGradient id="sparkFillLight" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      <path d={`M ${area}`} fill="url(#sparkFillLight)" />
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function StageBar({ stages }: { stages: SleepStages }) {
  const total = Math.max(1, stages.deep + stages.rem + stages.light + stages.awake);
  const deepW = (stages.deep / total) * 100;
  const remW = (stages.rem / total) * 100;
  const lightW = (stages.light / total) * 100;
  const awakeW = (stages.awake / total) * 100;

  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full bg-indigo-600" style={{ width: `${deepW}%` }} />
      <div className="h-full bg-sky-500" style={{ width: `${remW}%` }} />
      <div className="h-full bg-emerald-500" style={{ width: `${lightW}%` }} />
      <div className="h-full bg-amber-500" style={{ width: `${awakeW}%` }} />
    </div>
  );
}

function qualityTone(score: number) {
  if (score >= 80) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (score >= 60) return 'text-sky-700 bg-sky-50 border-sky-200';
  return 'text-rose-700 bg-rose-50 border-rose-200';
}

export default function SleepReportPage() {
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
      router.replace(`/reports/sleep?${qs.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patientId = useMemo(() => sp.get('patientId') || 'patient-123', [sp]);

  const [discreet, setDiscreet] = useState(false);
  const [hideSensitive, setHideSensitive] = useState(false);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SleepReportData | null>(null);

  // PDF state (on-demand)
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFilename, setPdfFilename] = useState<string>('sleep_report.pdf');
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
    // No APIs yet → mock-first, clean UX.
    setLoading(true);
    const mock = makeMockSleepReport(range, patientId);
    setData(mock);
    setLoading(false);

    // reset pdf preview when range changes
    if (lastObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(lastObjectUrlRef.current);
      } catch {}
      lastObjectUrlRef.current = null;
    }
    setPdfUrl(null);
    setShowPdfPreview(false);
  }, [range, patientId]);

  useEffect(() => {
    return () => {
      if (lastObjectUrlRef.current) {
        try {
          URL.revokeObjectURL(lastObjectUrlRef.current);
        } catch {}
      }
    };
  }, []);

  const nights = data?.nights ?? [];

  const summary = useMemo(() => {
    const n = Math.max(1, nights.length);
    const avgScore = nights.reduce((s, x) => s + x.qualityScore, 0) / n;
    const avgEff = nights.reduce((s, x) => s + x.efficiency, 0) / n;
    const avgHrv = nights.reduce((s, x) => s + x.hrv, 0) / n;

    const avgSleepMin =
      nights.reduce((s, x) => s + (x.stagesMin.deep + x.stagesMin.rem + x.stagesMin.light), 0) / n;

    // "Consistency": % of bedtimes within 60 min of median bedtime (rough)
    const bedMinutes = nights
      .map((x) => {
        const d = new Date(x.bedtimeISO);
        return d.getHours() * 60 + d.getMinutes();
      })
      .sort((a, b) => a - b);

    const median = bedMinutes.length ? bedMinutes[Math.floor(bedMinutes.length / 2)] : 0;
    const within = bedMinutes.filter((m) => {
      const diff = Math.min(Math.abs(m - median), 1440 - Math.abs(m - median));
      return diff <= 60;
    }).length;

    const consistencyPct = bedMinutes.length ? (within / bedMinutes.length) * 100 : 0;

    const last = nights[nights.length - 1]?.qualityScore ?? avgScore;

    return {
      avgScore: clamp(avgScore, 0, 100),
      avgEff: clamp(avgEff, 0, 1),
      avgHrv: clamp(avgHrv, 0, 200),
      avgSleepMin: clamp(avgSleepMin, 0, 24 * 60),
      consistencyPct: clamp(consistencyPct, 0, 100),
      lastScore: clamp(last, 0, 100),
    };
  }, [nights]);

  const chartValues = useMemo(() => nights.map((n) => clamp(n.qualityScore, 0, 100)), [nights]);

  function setRange(next: RangeKey) {
    const qs = new URLSearchParams(Array.from(sp.entries()));
    qs.set('range', next);
    router.push(`/reports/sleep?${qs.toString()}`);
  }

  const generatedAtText = useMemo(() => {
    const iso = data?.generatedAtISO || new Date().toISOString();
    return new Date(iso).toLocaleString();
  }, [data?.generatedAtISO]);

  async function ensurePdfGenerated() {
    if (pdfUrl) return true;
    setPdfBusy(true);
    try {
      const { blob, filename } = await generateHealthReport(patientId, { sleep: true });
      const url = URL.createObjectURL(blob);

      if (lastObjectUrlRef.current) {
        try {
          URL.revokeObjectURL(lastObjectUrlRef.current);
        } catch {}
      }
      lastObjectUrlRef.current = url;

      setPdfUrl(url);
      setPdfFilename(filename || 'sleep_report.pdf');
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
    a.download = pdfFilename || 'sleep_report.pdf';
    a.click();
    toast('Download started.', { type: 'success' });
  }

  async function handleSharePdf() {
    const ok = await ensurePdfGenerated();
    if (!ok || !pdfUrl) return;

    try {
      const res = await fetch(pdfUrl);
      const blob = await res.blob();
      const file = new File([blob], pdfFilename || 'sleep_report.pdf', { type: 'application/pdf' });

      if ((navigator as any).share && (navigator as any).canShare?.({ files: [file] })) {
        await (navigator as any).share({
          title: 'Sleep Report',
          text: 'Here is my sleep report.',
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

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Top bar */}
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
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">Sleep Report</h1>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">
                  {range.toUpperCase()}
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
              <div className="mt-1 text-xs text-slate-500">Generated: {generatedAtText}{plan ? ` • Plan: ${plan}` : ''}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Pill active={discreet} onClick={() => setDiscreet((v) => !v)} title="Hide numbers across the report">
              Discreet
            </Pill>
            <Pill active={hideSensitive} onClick={() => setHideSensitive((v) => !v)} title="Hide notes and timing details">
              Hide sensitive
            </Pill>

            <button
              type="button"
              onClick={async () => {
                const ok = await ensurePdfGenerated();
                if (!ok) return;
                setShowPdfPreview((v) => !v);
              }}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              disabled={pdfBusy}
            >
              {pdfBusy ? 'Preparing…' : showPdfPreview ? 'Hide PDF preview' : 'Preview PDF'}
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              disabled={pdfBusy}
            >
              Download PDF
            </button>

            <button
              type="button"
              onClick={handleSharePdf}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              disabled={pdfBusy}
            >
              Share
            </button>
          </div>
        </div>

        {/* Range pills */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="text-xs text-slate-500">Range</div>
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

          <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
            Demo data (APIs not wired yet)
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">Loading sleep report…</div>
        ) : !data ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">Could not load the report.</div>
        ) : (
          <>
            {/* Hero */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm text-slate-600">Current quality</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <div className="text-3xl font-semibold tracking-tight text-slate-900">
                      {discreet ? '•••' : fmtNumber(Math.round(summary.lastScore))}{' '}
                      <span className="text-base font-normal text-slate-500">/ 100</span>
                    </div>
                    <span
                      className={[
                        'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium',
                        qualityTone(summary.lastScore),
                      ].join(' ')}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                      {summary.lastScore >= 80 ? 'Excellent' : summary.lastScore >= 60 ? 'Good' : 'Poor'}
                    </span>
                  </div>

                  <div className="mt-3 max-w-2xl text-sm text-slate-600">
                    {data.insights?.headline ||
                      'Your sleep quality is computed from stages + HRV + efficiency. Watch trends over time for best signal.'}
                  </div>
                </div>

                <div className="w-full md:w-[360px]">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-slate-500">Quality trend</div>
                      <div className="text-xs text-slate-500">{nights.length} nights</div>
                    </div>
                    <div className="mt-2 text-indigo-700">
                      <Sparkline
                        values={chartValues.length ? chartValues : [60, 64, 62, 66, 63, 68, 65]}
                        ariaLabel="Sleep quality trend"
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <span>Lower</span>
                      <span>Higher</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-4">
                <StatCard
                  label="Avg sleep duration"
                  value={`${fmtNumber(minutesToHours(summary.avgSleepMin), 1)} h`}
                  sub="Deep + REM + Light"
                  discreet={discreet}
                />
                <StatCard
                  label="Avg quality score"
                  value={`${fmtNumber(Math.round(summary.avgScore))} / 100`}
                  sub="Across selected range"
                  discreet={discreet}
                />
                <StatCard
                  label="Avg efficiency"
                  value={`${fmtNumber(summary.avgEff * 100, 0)}%`}
                  sub="Sleep / time in bed"
                  discreet={discreet}
                />
                <StatCard
                  label="Bedtime consistency"
                  value={`${fmtNumber(summary.consistencyPct, 0)}%`}
                  sub="Within ~60 min window"
                  discreet={hideSensitive}
                />
              </div>
            </section>

            {/* Highlights + Coaching */}
            <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold tracking-tight text-slate-900">Highlights</h2>
                  <span className="text-xs text-slate-500">What to look at</span>
                </div>

                <div className="mt-4 space-y-3">
                  {(data.insights?.highlights?.length ? data.insights.highlights : []).map((h, idx) => (
                    <div key={`${h.title}-${idx}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="font-medium text-slate-900">{h.title}</div>
                      <div className="mt-1 text-sm text-slate-600">{h.detail}</div>
                    </div>
                  ))}

                  {!data.insights?.highlights?.length ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      No highlights available yet.
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold tracking-tight text-slate-900">Sleep coaching</h2>
                  <span className="text-xs text-slate-500">Practical next steps</span>
                </div>

                <div className="mt-4 space-y-3">
                  {(data.insights?.recommendations?.length ? data.insights.recommendations : []).map((r, idx) => (
                    <div key={`${r.title}-${idx}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="font-medium text-slate-900">{r.title}</div>
                      <div className="mt-1 text-sm text-slate-600">{r.detail}</div>
                    </div>
                  ))}

                  {!data.insights?.recommendations?.length ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      No coaching recommendations available yet.
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            {/* Nightly breakdown */}
            <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-slate-900">Nightly breakdown</h2>
                  <div className="mt-1 text-sm text-slate-600">
                    Colors: Deep (indigo) • REM (sky) • Light (emerald) • Awake (amber)
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  Tip: Use this UI for analysis; export PDF for sending.
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                <div className="grid grid-cols-12 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                  <div className="col-span-3">Night</div>
                  <div className="col-span-2">Quality</div>
                  <div className="col-span-3">Stages</div>
                  <div className="col-span-2">HRV</div>
                  <div className="col-span-1">Eff</div>
                  <div className="col-span-1 text-right">Notes</div>
                </div>

                <div className="max-h-[520px] overflow-auto">
                  {nights
                    .slice()
                    .reverse()
                    .map((n) => {
                      const sleepMin = n.stagesMin.deep + n.stagesMin.rem + n.stagesMin.light;
                      const effPct = clamp(n.efficiency * 100, 0, 100);

                      return (
                        <div
                          key={n.dateISO}
                          className="grid grid-cols-12 items-center gap-2 border-t border-slate-100 px-4 py-3 hover:bg-slate-50"
                        >
                          <div className="col-span-3">
                            <div className="text-sm font-medium text-slate-900">
                              {hideSensitive ? '—' : fmtDatePretty(n.dateISO)}
                            </div>
                            <div className="text-xs text-slate-500">
                              {hideSensitive ? (
                                n.dateISO
                              ) : (
                                <>
                                  {fmtTimeLocal(n.bedtimeISO)} → {fmtTimeLocal(n.wakeISO)} • {fmtNumber(minutesToHours(sleepMin), 1)} h
                                </>
                              )}
                            </div>
                          </div>

                          <div className="col-span-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900">
                                {discreet ? '•••' : fmtNumber(n.qualityScore)}
                              </span>
                              <span
                                className={[
                                  'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                                  qualityTone(n.qualityScore),
                                ].join(' ')}
                              >
                                {n.qualityLabel}
                              </span>
                            </div>
                          </div>

                          <div className="col-span-3">
                            <StageBar stages={n.stagesMin} />
                            {!discreet ? (
                              <div className="mt-1 text-[11px] text-slate-500">
                                Deep {fmtNumber(n.stagesMin.deep)}m • REM {fmtNumber(n.stagesMin.rem)}m • Light {fmtNumber(n.stagesMin.light)}m • Awake{' '}
                                {fmtNumber(n.stagesMin.awake)}m
                              </div>
                            ) : (
                              <div className="mt-1 text-[11px] text-slate-400">Stage breakdown hidden</div>
                            )}
                          </div>

                          <div className="col-span-2 text-sm text-slate-700">{discreet ? '•••' : `${fmtNumber(n.hrv)} ms`}</div>

                          <div className="col-span-1 text-sm text-slate-700">{discreet ? '•••' : `${fmtNumber(effPct, 0)}%`}</div>

                          <div className="col-span-1 text-right text-sm text-slate-600">
                            {hideSensitive ? (
                              <span className="text-slate-300">—</span>
                            ) : n.note ? (
                              <span title={n.note} className="inline-block max-w-[140px] truncate">
                                {n.note}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
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
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={handleSharePdf}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Share
                    </button>
                  </div>
                </div>

                <iframe
                  src={pdfUrl}
                  className="h-[75vh] w-full rounded-2xl border border-slate-200 bg-white"
                  title="Sleep Report PDF Preview"
                />
              </section>
            ) : null}

            <div className="mt-8 text-xs text-slate-500">
              This report is informational and not a diagnosis. If you’re experiencing persistent sleep difficulty, consider consulting a clinician.
            </div>
          </>
        )}
      </div>
    </main>
  );
}
