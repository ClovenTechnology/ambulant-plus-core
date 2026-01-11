// apps/patient-app/app/reports/fertility/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
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

import { getFertilityStatus, type FertilityStatus, type FertilityPhase } from '@/src/analytics/fertility';
import {
  predictCycleDates,
  detectPregnancy,
  computeAnomalies,
  summarizeCycleChanges,
  type FertilityPrefs,
  type WearablePoint,
  addDaysISO,
} from '@/src/analytics/prediction';
import { generateHealthReport } from '@/src/analytics/report';

type RangeKey = '30d' | '90d' | '1y';

type ManualLogs = Record<
  string,
  {
    period?: boolean;
    ovulation?: boolean;
    pregTest?: 'positive' | 'negative';
    note?: string;
  }
>;

const LS_DISCREET = 'ambulant.reports.discreet';
const LS_HIDE_SENSITIVE = 'ambulant.reports.hideSensitive';

const LS_FERT_PREFS = 'fertilityPrefs';
const LS_FERT_LOGS = 'fertility:manualLogs';

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

function todayISO() {
  // local-date ISO (YYYY-MM-DD)
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function smoothRand(seed: number) {
  let t = seed % 2147483647;
  return () => {
    t = (t * 48271) % 2147483647;
    return (t & 0xfffffff) / 0xfffffff;
  };
}

function phaseLabel(p: FertilityPhase) {
  switch (p) {
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

function confidenceTone(conf: number) {
  if (conf >= 0.8) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (conf >= 0.5) return 'text-amber-700 bg-amber-50 border-amber-200';
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

  const safe = values.length ? values : [0, 1, 0.5, 0.8, 0.6, 0.9, 0.7];
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
        <linearGradient id="sparkFillFert" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      <path d={`M ${area}`} fill="url(#sparkFillFert)" />
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function makeMockSeries(range: RangeKey, prefs: FertilityPrefs | null, seedBase: number): WearablePoint[] {
  const days = range === '30d' ? 30 : range === '90d' ? 90 : 365;
  const rnd = smoothRand(seedBase);

  const cycle = clamp(Math.round(prefs?.cycleDays ?? 28), 21, 35);
  const baseHrv = 52 + (rnd() * 8 - 4);
  const baseRhr = 60 + (rnd() * 6 - 3);
  const baseSpO2 = 97 + (rnd() * 1 - 0.5);

  const out: WearablePoint[] = [];
  const tISO = todayISO();

  for (let i = days - 1; i >= 0; i--) {
    const date = addDaysISO(tISO, -i);

    // approximate cycle day based on LMP if available; otherwise synthetic
    let cd = ((days - i) % cycle) + 1;
    if (prefs?.lmp) {
      const diff = Math.floor((new Date(date).getTime() - new Date(prefs.lmp).getTime()) / 86400000);
      cd = ((diff % cycle) + cycle) % cycle;
      cd = cd === 0 ? cycle : cd;
    }

    // fertile window ~ cd 10-15; ovulation around cd 14
    const nearOv = Math.abs(cd - (cycle - 14 + 1)) <= 1 ? 1 : 0; // rough
    const luteal = cd >= (cycle - 14 + 2); // after ovulation-ish

    // deltaTemp baseline normalized (°C)
    const tempNoise = rnd() * 0.12 - 0.06;
    const lutealRise = luteal ? 0.25 + rnd() * 0.18 : 0;
    const deltaTemp = clamp(tempNoise + lutealRise, -0.15, 0.6);

    // HRV dips around ovulation-ish, slight suppression luteal
    const hrvDip = nearOv ? 7 + rnd() * 7 : 0;
    const hrvLuteal = luteal ? 2 + rnd() * 3 : 0;
    const hrv = clamp(baseHrv - hrvDip - hrvLuteal + (rnd() * 6 - 3), 28, 92);

    // RHR tends to rise luteal
    const rhrRise = luteal ? 2 + rnd() * 3.5 : 0;
    const rhr = clamp(baseRhr + rhrRise + (rnd() * 3 - 1.5), 48, 96);

    // SpO2 mostly stable, occasional low blip
    const spo2Blip = rnd() > 0.97 ? -(1.5 + rnd() * 2.5) : 0;
    const spo2 = clamp(baseSpO2 + spo2Blip + (rnd() * 0.8 - 0.4), 90, 99);

    out.push({ date, deltaTemp, hrv, rhr, spo2 });
  }

  return out;
}

function mean(arr: number[]) {
  const v = arr.filter(Number.isFinite);
  if (!v.length) return NaN;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

export default function FertilityReportPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { plan, isPremium } = usePlan();

  const range = useMemo<RangeKey>(() => {
    const r = (sp.get('range') || '90d') as RangeKey;
    if (r === '30d' || r === '90d' || r === '1y') return r;
    return '90d';
  }, [sp]);

  // canonical range in URL
  useEffect(() => {
    const current = sp.get('range');
    if (!current) {
      const qs = new URLSearchParams(Array.from(sp.entries()));
      qs.set('range', range);
      router.replace(`/reports/fertility?${qs.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patientId = useMemo(() => sp.get('patientId') || 'patient-123', [sp]);

  const [discreet, setDiscreet] = useState(false);
  const [hideSensitive, setHideSensitive] = useState(false);

  const [prefs, setPrefs] = useState<FertilityPrefs | null>(null);
  const [lmp, setLmp] = useState<string>('');
  const [cycleDays, setCycleDays] = useState<number | ''>('');

  const [logs, setLogs] = useState<ManualLogs>({});
  const [loading, setLoading] = useState(true);

  // computed
  const [series, setSeries] = useState<WearablePoint[]>([]);
  const [status, setStatus] = useState<FertilityStatus>({ phase: 'uncertain', confidence: 0.2, reasoning: 'Insufficient data' });

  // PDF state (on-demand)
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
    // load prefs + logs
    try {
      const saved = localStorage.getItem(LS_FERT_PREFS);
      if (saved) {
        const p = JSON.parse(saved) as FertilityPrefs;
        if (p?.lmp && p?.cycleDays) {
          const fixed: FertilityPrefs = { lmp: p.lmp, cycleDays: clamp(Math.round(p.cycleDays), 21, 35) };
          setPrefs(fixed);
          setLmp(fixed.lmp);
          setCycleDays(fixed.cycleDays);
        }
      }
    } catch {}

    try {
      const raw = localStorage.getItem(LS_FERT_LOGS);
      if (raw) setLogs(JSON.parse(raw) as ManualLogs);
    } catch {}

    setLoading(false);
  }, []);

  useEffect(() => {
    // Build demo series (until APIs exist)
    const now = new Date();
    const seedBase = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    const s = makeMockSeries(range, prefs, seedBase);

    // Apply any manual logs for period/ovulation for today’s status override
    const tISO = todayISO();
    const todayLog = logs?.[tISO] || {};

    const temps = s.map((p) => (typeof p.deltaTemp === 'number' ? p.deltaTemp : NaN)).filter(Number.isFinite);
    const hrvs = s.map((p) => (typeof p.hrv === 'number' ? p.hrv : NaN)).filter(Number.isFinite);
    const rhrs = s.map((p) => (typeof p.rhr === 'number' ? p.rhr : NaN)).filter(Number.isFinite);

    const baseline = mean(temps.slice(0, 14));

    const st = getFertilityStatus(
      temps,
      hrvs,
      rhrs,
      Number.isFinite(baseline) ? baseline : 0,
      {
        period: !!todayLog.period,
        ovulation: !!todayLog.ovulation,
      }
    );

    setSeries(s);
    setStatus(st);

    // reset pdf on range/prefs changes
    if (lastObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(lastObjectUrlRef.current);
      } catch {}
      lastObjectUrlRef.current = null;
    }
    setPdfUrl(null);
    setShowPdfPreview(false);
  }, [range, prefs, logs]);

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
      toast('Please set LMP and cycle length.', { type: 'error' });
      return;
    }
    const fixed: FertilityPrefs = {
      lmp,
      cycleDays: clamp(Math.round(Number(cycleDays)), 21, 35),
    };
    try {
      localStorage.setItem(LS_FERT_PREFS, JSON.stringify(fixed));
    } catch {}
    setPrefs(fixed);
    toast('Fertility preferences saved ✅', { type: 'success' });
  }

  function saveLogs(next: ManualLogs) {
    setLogs(next);
    try {
      localStorage.setItem(LS_FERT_LOGS, JSON.stringify(next));
    } catch {}
  }

  const tISO = useMemo(() => todayISO(), []);
  const prediction = useMemo(() => predictCycleDates(prefs, tISO, { highAccuracy: true }), [prefs, tISO]);

  const pregSignal = useMemo(() => detectPregnancy(prefs, series, logs, { highAccuracy: true, useLogs: true }), [prefs, series, logs]);

  const anomalies = useMemo(() => computeAnomalies(series), [series]);
  const cycleBullets = useMemo(() => summarizeCycleChanges(series), [series]);

  const phaseUI = useMemo(() => phaseLabel(status.phase), [status.phase]);
  const confPct = useMemo(() => clamp(Math.round(status.confidence * 100), 0, 100), [status.confidence]);

  const tempVals = useMemo(() => series.map((p) => (typeof p.deltaTemp === 'number' ? p.deltaTemp : 0)), [series]);
  const hrvVals = useMemo(() => series.map((p) => (typeof p.hrv === 'number' ? p.hrv : 0)), [series]);
  const rhrVals = useMemo(() => series.map((p) => (typeof p.rhr === 'number' ? p.rhr : 0)), [series]);

  async function ensurePdfGenerated() {
    if (pdfUrl) return true;
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
    a.download = pdfFilename || 'fertility_report.pdf';
    a.click();
    toast('Download started.', { type: 'success' });
  }

  async function handleSharePdf() {
    const ok = await ensurePdfGenerated();
    if (!ok || !pdfUrl) return;
    try {
      const res = await fetch(pdfUrl);
      const blob = await res.blob();
      const file = new File([blob], pdfFilename || 'fertility_report.pdf', { type: 'application/pdf' });

      if ((navigator as any).share && (navigator as any).canShare?.({ files: [file] })) {
        await (navigator as any).share({
          title: 'Fertility Report',
          text: 'Here is my fertility report.',
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
    router.push(`/reports/fertility?${qs.toString()}`);
  }

  const generatedAtText = useMemo(() => new Date().toLocaleString(), []);

  const todayLog = logs?.[tISO] || {};
  const fertileWindow = prediction
    ? { start: prediction.fertileStart, end: prediction.fertileEnd, ovulation: prediction.ovulation, nextPeriod: prediction.nextPeriodStart }
    : null;

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
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">Fertility Report</h1>
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
              <div className="mt-1 text-xs text-slate-500">
                Generated: {generatedAtText}
                {plan ? ` • Plan: ${plan}` : ''}
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

        {/* Range pills */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="text-xs text-slate-500">Range</div>
          <Pill active={range === '30d'} onClick={() => setRange('30d')} title="Short view (lower confidence)">
            30D
          </Pill>
          <Pill active={range === '90d'} onClick={() => setRange('90d')} title="Recommended (more confidence)">
            90D
          </Pill>
          <Pill active={range === '1y'} onClick={() => setRange('1y')} title="Best for long-range patterns">
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
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">Loading fertility report…</div>
        ) : (
          <>
            {/* Setup + Status */}
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Preferences */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Preferences</div>
                    <div className="mt-1 text-xs text-slate-500">Used for cycle-day + window prediction</div>
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
                      placeholder="e.g., 28"
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

                  {!prefs ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      Add LMP + cycle length to unlock predictions and improve confidence.
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                      Preferences loaded ✅
                    </div>
                  )}
                </div>
              </div>

              {/* Status / Predictions */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-slate-600">Current phase</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${phaseUI.tone}`}>
                        <Sparkles className="h-3.5 w-3.5" />
                        {phaseUI.label}
                      </span>
                      <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${confidenceTone(status.confidence)}`}>
                        Confidence {discreet ? '•••' : `${confPct}%`}
                      </span>
                    </div>

                    <div className="mt-3 text-sm text-slate-600">
                      {hideSensitive ? (
                        'Reasoning hidden.'
                      ) : (
                        <>
                          <span className="font-medium text-slate-900">Why:</span> {status.reasoning}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-medium text-slate-700">Today’s log (optional)</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const next: ManualLogs = { ...logs, [tISO]: { ...(logs[tISO] || {}), period: !todayLog.period } };
                          saveLogs(next);
                        }}
                        className={[
                          'rounded-full border px-3 py-1.5 text-sm',
                          todayLog.period ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50',
                        ].join(' ')}
                      >
                        Period
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next: ManualLogs = { ...logs, [tISO]: { ...(logs[tISO] || {}), ovulation: !todayLog.ovulation } };
                          saveLogs(next);
                        }}
                        className={[
                          'rounded-full border px-3 py-1.5 text-sm',
                          todayLog.ovulation ? 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50',
                        ].join(' ')}
                      >
                        Ovulation
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const cur = todayLog.pregTest;
                          const nextVal: 'positive' | 'negative' | undefined = cur === 'positive' ? 'negative' : cur === 'negative' ? undefined : 'positive';
                          const next: ManualLogs = { ...logs, [tISO]: { ...(logs[tISO] || {}), pregTest: nextVal } };
                          saveLogs(next);
                        }}
                        className={[
                          'rounded-full border px-3 py-1.5 text-sm',
                          todayLog.pregTest === 'positive'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : todayLog.pregTest === 'negative'
                            ? 'bg-slate-50 border-slate-200 text-slate-700'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50',
                        ].join(' ')}
                        title="Cycles through: positive → negative → unset"
                      >
                        Test: {todayLog.pregTest || 'unset'}
                      </button>
                    </div>

                    <div className="mt-2 text-[11px] text-slate-500">
                      Logs override phase detection (useful when you know what’s happening).
                    </div>
                  </div>
                </div>

                {/* Predictions row */}
                <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-4">
                  <StatCard
                    icon={<CalendarDays className="h-4 w-4" />}
                    label="Cycle day"
                    value={prediction ? (discreet ? '•••' : String(prediction.cycleDay)) : '—'}
                    sub={prediction ? `Cycle length: ${prediction.cycleLength}d` : 'Set preferences to enable'}
                    discreet={false}
                  />
                  <StatCard
                    icon={<Sparkles className="h-4 w-4" />}
                    label="Fertile window"
                    value={
                      fertileWindow
                        ? hideSensitive
                          ? 'Hidden'
                          : `${fmtDatePretty(fertileWindow.start)} → ${fmtDatePretty(fertileWindow.end)}`
                        : '—'
                    }
                    sub={fertileWindow ? 'Predicted' : 'Set preferences to enable'}
                    discreet={false}
                  />
                  <StatCard
                    icon={<Activity className="h-4 w-4" />}
                    label="Ovulation"
                    value={fertileWindow ? (hideSensitive ? 'Hidden' : fmtDatePretty(fertileWindow.ovulation)) : '—'}
                    sub={fertileWindow ? 'Predicted (approx)' : 'Set preferences to enable'}
                    discreet={false}
                  />
                  <StatCard
                    icon={<CalendarDays className="h-4 w-4" />}
                    label="Next period"
                    value={fertileWindow ? (hideSensitive ? 'Hidden' : fmtDatePretty(fertileWindow.nextPeriod)) : '—'}
                    sub={fertileWindow ? 'Predicted' : 'Set preferences to enable'}
                    discreet={false}
                  />
                </div>

                {/* Pregnancy signal */}
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Baby className="h-4 w-4 text-slate-500" />
                      <div className="text-sm font-semibold text-slate-900">Pregnancy signal</div>
                      <span className="text-xs text-slate-500">(heuristic)</span>
                    </div>
                    <span
                      className={[
                        'rounded-full border px-2.5 py-1 text-xs font-medium',
                        pregSignal.status === 'confirmed'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : pregSignal.status === 'likely'
                          ? 'bg-amber-50 border-amber-200 text-amber-700'
                          : 'bg-white border-slate-200 text-slate-700',
                      ].join(' ')}
                    >
                      {pregSignal.status.toUpperCase()}
                      {!discreet ? ` • ${Math.round(pregSignal.confidence * 100)}%` : ''}
                    </span>
                  </div>

                  {!hideSensitive ? (
                    <div className="mt-2 text-sm text-slate-600">
                      Reasons: {pregSignal.reasons?.length ? pregSignal.reasons.join(', ') : 'none detected'}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-slate-600">Reasons hidden.</div>
                  )}

                  <div className="mt-2 text-[11px] text-slate-500">
                    This is not a diagnosis. Use a test and consult a clinician for confirmation.
                  </div>
                </div>
              </div>
            </section>

            {/* Trends */}
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
                <div className="mt-2 text-xs text-slate-500">{discreet ? '•••' : 'Sustained rise after ovulation can be informative.'}</div>
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
                <div className="mt-2 text-xs text-slate-500">{discreet ? '•••' : 'Dips can happen around ovulation or stress.'}</div>
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
                <div className="mt-2 text-xs text-slate-500">{discreet ? '•••' : 'Often rises slightly in luteal phase.'}</div>
              </div>
            </section>

            {/* Cycle summary + anomalies */}
            <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">Cycle summary</div>
                  <span className="text-xs text-slate-500">From wearable series</span>
                </div>

                <div className="mt-4 space-y-2">
                  {cycleBullets.length ? (
                    cycleBullets.map((b, i) => (
                      <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        {hideSensitive ? 'Hidden' : b}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      Summary unavailable (not enough data).
                    </div>
                  )}
                </div>

                <div className="mt-3 text-[11px] text-slate-500">
                  More data (especially ≥90 days) improves stability and confidence.
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">Anomalies & flags</div>
                  <span className="text-xs text-slate-500">Auto-detected</span>
                </div>

                <div className="mt-4 grid gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-medium text-slate-700">Sustained temp rise</div>
                    <div className="mt-1 text-sm text-slate-700">
                      {anomalies.sustainedTempRise
                        ? hideSensitive
                          ? 'Hidden'
                          : `Start: ${anomalies.sustainedTempRise.start} • Length: ${anomalies.sustainedTempRise.length} days`
                        : 'None detected'}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-medium text-slate-700">HRV dips</div>
                    <div className="mt-1 text-sm text-slate-700">
                      {anomalies.hrvDips.length
                        ? hideSensitive
                          ? 'Hidden'
                          : anomalies.hrvDips.slice(0, 10).join(', ') + (anomalies.hrvDips.length > 10 ? ' …' : '')
                        : 'None detected'}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-medium text-slate-700">Low SpO₂</div>
                    <div className="mt-1 text-sm text-slate-700">
                      {anomalies.spo2Lows.length
                        ? hideSensitive
                          ? 'Hidden'
                          : anomalies.spo2Lows.slice(0, 10).join(', ') + (anomalies.spo2Lows.length > 10 ? ' …' : '')
                        : 'None detected'}
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-slate-500">
                  Flags are not diagnoses. If something looks concerning, consult a clinician.
                </div>
              </div>
            </section>

            {/* Daily table */}
            <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-slate-900">Daily signals</h2>
                  <div className="mt-1 text-sm text-slate-600">
                    Temperature delta • HRV • Resting HR • SpO₂ (demo series for now)
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
                  <div className="col-span-1 text-right">Tag</div>
                </div>

                <div className="max-h-[520px] overflow-auto">
                  {series
                    .slice()
                    .reverse()
                    .map((p) => {
                      const tag =
                        logs?.[p.date]?.period
                          ? { label: 'Period', cls: 'bg-rose-50 border-rose-200 text-rose-700' }
                          : logs?.[p.date]?.ovulation
                          ? { label: 'Ovulation', cls: 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700' }
                          : prediction && p.date >= prediction.fertileStart && p.date <= prediction.fertileEnd
                          ? { label: 'Fertile', cls: 'bg-amber-50 border-amber-200 text-amber-700' }
                          : p.date === prediction?.ovulation
                          ? { label: 'Ovu*', cls: 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700' }
                          : { label: '—', cls: 'bg-white border-slate-200 text-slate-500' };

                      return (
                        <div key={p.date} className="grid grid-cols-12 items-center gap-2 border-t border-slate-100 px-4 py-3 hover:bg-slate-50">
                          <div className="col-span-3">
                            <div className="text-sm font-medium text-slate-900">{hideSensitive ? '—' : fmtDatePretty(p.date)}</div>
                            <div className="text-xs text-slate-500">{p.date}</div>
                          </div>

                          <div className="col-span-2 text-sm text-slate-700">
                            {discreet ? '•••' : typeof p.deltaTemp === 'number' ? `${p.deltaTemp >= 0 ? '+' : ''}${p.deltaTemp.toFixed(2)}°C` : '—'}
                          </div>

                          <div className="col-span-2 text-sm text-slate-700">{discreet ? '•••' : typeof p.hrv === 'number' ? `${fmtNumber(p.hrv)} ms` : '—'}</div>

                          <div className="col-span-2 text-sm text-slate-700">{discreet ? '•••' : typeof p.rhr === 'number' ? `${fmtNumber(p.rhr)} bpm` : '—'}</div>

                          <div className="col-span-2 text-sm text-slate-700">{discreet ? '•••' : typeof p.spo2 === 'number' ? `${fmtNumber(p.spo2, 0)}%` : '—'}</div>

                          <div className="col-span-1 text-right">
                            <span className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${tag.cls}`}>
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
                  “Ovu*” is a prediction (approx). Manual logs override.
                </span>
              </div>
            </section>

            {/* PDF preview */}
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
