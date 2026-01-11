// apps/patient-app/app/reports/vitals/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  HeartPulse,
  Droplets,
  Thermometer,
  Wind,
  Download,
  Share2,
  Info,
  ShieldCheck,
  AlertTriangle,
  Gauge,
} from 'lucide-react';

import { toast } from '@/components/ToastMount';
import { loadHistory } from '@/src/analytics/history';
import { computeCardioRisk, hypertensionIndex } from '@/src/analytics/cardio';
import { generateHealthReport } from '@/src/analytics/report';

type RangeKey = '7d' | '30d' | '90d' | '1y';

type HistoryRecord = {
  timestamp: string;
  data: Record<string, any>;
};

type BpPoint = {
  ts: string;
  dateISO: string; // YYYY-MM-DD
  systolic?: number;
  diastolic?: number;
};

type LatestVitals = {
  ts?: string;
  hr?: number;
  spo2?: number;
  temp?: number;
  rr?: number;
  glucose?: number;
  steps?: number;
  calories?: number;
  distance?: number;
};

const LS_DISCREET = 'ambulant.reports.discreet';
const LS_HIDE_SENSITIVE = 'ambulant.reports.hideSensitive';

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function toLocalISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysISO(iso: string, days: number) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toLocalISODate(d);
}

function fmtNum(n?: number, digits = 0) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(n);
}

function fmtDateTime(ts?: string, hideSensitive?: boolean) {
  if (!ts) return '—';
  if (hideSensitive) return 'Hidden';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function fmtDatePretty(dateISO: string, hideSensitive?: boolean) {
  if (hideSensitive) return 'Hidden';
  const d = new Date(dateISO + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: '2-digit' });
}

function rangeToDays(r: RangeKey) {
  if (r === '7d') return 7;
  if (r === '30d') return 30;
  if (r === '90d') return 90;
  return 365;
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

function Card({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
          {subtitle ? <div className="mt-1 text-sm text-slate-600">{subtitle}</div> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  unit,
  sub,
  discreet,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
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
        {!discreet && unit ? <span className="ml-1 text-base font-medium text-slate-500">{unit}</span> : null}
      </div>
      {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
    </div>
  );
}

function DualLineSpark({
  a,
  b,
  height = 120,
  discreet,
}: {
  a: number[];
  b: number[];
  height?: number;
  discreet?: boolean;
}) {
  const w = 640;
  const pad = 10;
  const all = [...a, ...b].filter((x) => Number.isFinite(x));
  const vmin = all.length ? Math.min(...all) : 0;
  const vmax = all.length ? Math.max(...all) : 1;
  const span = Math.max(1e-6, vmax - vmin);

  const mapPts = (arr: number[]) =>
    arr
      .map((v, i) => {
        const x = pad + (i * (w - pad * 2)) / Math.max(1, arr.length - 1);
        const y = pad + ((vmax - v) * (height - pad * 2)) / span;
        return [x, y] as const;
      })
      .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
      .join(' ');

  const ptsA = mapPts(a);
  const ptsB = mapPts(b);

  return (
    <div className="relative">
      <svg width="100%" viewBox={`0 0 ${w} ${height}`} role="img" aria-label="Blood pressure trend">
        <defs>
          <linearGradient id="fillA" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="fillB" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* soft grid */}
        {Array.from({ length: 5 }).map((_, i) => {
          const y = pad + (i * (height - pad * 2)) / 4;
          return <line key={i} x1={pad} x2={w - pad} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />;
        })}

        {/* areas */}
        <path
          d={`M ${ptsA} ${w - pad},${height - pad} ${pad},${height - pad}`}
          fill="url(#fillA)"
        />
        <path
          d={`M ${ptsB} ${w - pad},${height - pad} ${pad},${height - pad}`}
          fill="url(#fillB)"
        />

        {/* lines */}
        <polyline points={ptsA} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={ptsB} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>

      {discreet ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-700 shadow-sm backdrop-blur">
            Discreet mode — chart hidden
          </div>
        </div>
      ) : null}
    </div>
  );
}

function classifyBp(sys?: number, dia?: number) {
  if (!Number.isFinite(sys) || !Number.isFinite(dia)) return { label: '—', cls: 'bg-slate-50 border-slate-200 text-slate-700' };

  // simple, non-diagnostic categorization (adult)
  if (sys! >= 180 || dia! >= 120) return { label: 'Crisis', cls: 'bg-rose-50 border-rose-200 text-rose-700' };
  if (sys! >= 140 || dia! >= 90) return { label: 'High', cls: 'bg-amber-50 border-amber-200 text-amber-700' };
  if (sys! >= 130 || dia! >= 80) return { label: 'Elevated', cls: 'bg-sky-50 border-sky-200 text-sky-700' };
  return { label: 'Normal', cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' };
}

export default function VitalsReportPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const range = useMemo<RangeKey>(() => {
    const r = (sp.get('range') || '30d') as RangeKey;
    if (r === '7d' || r === '30d' || r === '90d' || r === '1y') return r;
    return '30d';
  }, [sp]);

  // canonical range in URL
  useEffect(() => {
    const current = sp.get('range');
    if (!current) {
      const qs = new URLSearchParams(Array.from(sp.entries()));
      qs.set('range', range);
      router.replace(`/reports/vitals?${qs.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patientId = useMemo(() => sp.get('patientId') || 'patient-123', [sp]);

  const [discreet, setDiscreet] = useState(false);
  const [hideSensitive, setHideSensitive] = useState(false);

  const [loading, setLoading] = useState(true);
  const [bpPoints, setBpPoints] = useState<BpPoint[]>([]);
  const [latest, setLatest] = useState<LatestVitals>({});

  // PDF state (on-demand)
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFilename, setPdfFilename] = useState<string>('vitals_report.pdf');
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
      try {
        const days = rangeToDays(range);
        const today = toLocalISODate(new Date());
        const startISO = addDaysISO(today, -(days - 1));

        // Primary: BP history used by the PDF report
        const bpHistory = (await loadHistory('duecare.health-monitor', 'bp').catch(() => [])) as HistoryRecord[];

        const points: BpPoint[] = (Array.isArray(bpHistory) ? bpHistory : [])
          .map((r) => {
            const ts = String(r?.timestamp || '');
            const d = new Date(ts);
            const dateISO = Number.isNaN(d.getTime()) ? '' : toLocalISODate(d);
            const sys = Number(r?.data?.systolic);
            const dia = Number(r?.data?.diastolic);
            return {
              ts,
              dateISO,
              systolic: Number.isFinite(sys) ? sys : undefined,
              diastolic: Number.isFinite(dia) ? dia : undefined,
            };
          })
          .filter((p) => !!p.dateISO)
          .sort((a, b) => a.ts.localeCompare(b.ts))
          .filter((p) => p.dateISO >= startISO && p.dateISO <= today);

        // Graceful fallback if empty
        const fallback: BpPoint[] =
          points.length > 0
            ? points
            : [
                { ts: new Date(today + 'T08:10:00').toISOString(), dateISO: today, systolic: 120, diastolic: 80 },
                { ts: new Date(addDaysISO(today, -3) + 'T08:10:00').toISOString(), dateISO: addDaysISO(today, -3), systolic: 132, diastolic: 84 },
                { ts: new Date(addDaysISO(today, -7) + 'T08:10:00').toISOString(), dateISO: addDaysISO(today, -7), systolic: 126, diastolic: 82 },
              ].sort((a, b) => a.ts.localeCompare(b.ts));

        // Try to extract other vitals from any plausible history keys (non-breaking if absent)
        const candidates: Array<{ deviceId: string; modality: string }> = [
          { deviceId: 'duecare.health-monitor', modality: 'vitals' },
          { deviceId: 'duecare.nexring', modality: 'vitals' },
          { deviceId: 'duecare.nexring', modality: 'health' },
        ];

        let latestVitals: LatestVitals = {};
        for (const c of candidates) {
          const hx = (await loadHistory(c.deviceId, c.modality).catch(() => [])) as HistoryRecord[];
          if (!Array.isArray(hx) || hx.length === 0) continue;

          const last = hx
            .slice()
            .sort((a, b) => String(a?.timestamp || '').localeCompare(String(b?.timestamp || '')))
            .at(-1);

          if (!last?.data) continue;

          const d = last.data || {};
          const pick = (k: string) => {
            const n = Number(d?.[k]);
            return Number.isFinite(n) ? n : undefined;
          };

          // common key guesses
          latestVitals = {
            ts: String(last.timestamp || ''),
            hr: pick('hr') ?? pick('heartRate'),
            spo2: pick('spo2') ?? pick('SpO2'),
            temp: pick('temp') ?? pick('temp_c') ?? pick('temperature'),
            rr: pick('rr') ?? pick('respRate'),
            glucose: pick('glucose'),
            steps: pick('steps'),
            calories: pick('calories'),
            distance: pick('distance'),
          };

          // if we got anything useful, stop
          if (Object.values(latestVitals).some((v) => typeof v === 'number' && Number.isFinite(v))) break;
        }

        if (!alive) return;
        setBpPoints(fallback);
        setLatest(latestVitals);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setBpPoints([]);
        setLatest({});
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [range]);

  useEffect(() => {
    return () => {
      if (lastObjectUrlRef.current) {
        try {
          URL.revokeObjectURL(lastObjectUrlRef.current);
        } catch {}
      }
    };
  }, []);

  const latestBp = useMemo(() => {
    const last = bpPoints.slice().sort((a, b) => a.ts.localeCompare(b.ts)).at(-1);
    return last || null;
  }, [bpPoints]);

  const sysArr = useMemo(
    () => bpPoints.map((p) => p.systolic).filter((n): n is number => typeof n === 'number' && Number.isFinite(n)),
    [bpPoints]
  );
  const diaArr = useMemo(
    () => bpPoints.map((p) => p.diastolic).filter((n): n is number => typeof n === 'number' && Number.isFinite(n)),
    [bpPoints]
  );

  const bpRisk = useMemo(() => {
    const lastSys = latestBp?.systolic;
    const lastDia = latestBp?.diastolic;
    const historySys = sysArr.slice(-7);
    return computeCardioRisk(
      sysArr.length ? sysArr : Number.isFinite(Number(lastSys)) ? Number(lastSys) : [],
      diaArr.length ? diaArr : Number.isFinite(Number(lastDia)) ? Number(lastDia) : undefined,
      latest.hr,
      latest.spo2,
      historySys.length ? historySys : undefined
    );
  }, [sysArr, diaArr, latestBp, latest.hr, latest.spo2]);

  const hIndex = useMemo(() => (sysArr.length ? hypertensionIndex(sysArr) : 0), [sysArr]);

  const bpTag = useMemo(() => classifyBp(latestBp?.systolic, latestBp?.diastolic), [latestBp?.systolic, latestBp?.diastolic]);

  const generatedAtText = useMemo(() => new Date().toLocaleString(), []);

  async function ensurePdfGenerated() {
    if (pdfUrl) return true;
    setPdfBusy(true);
    try {
      const { blob, filename } = await generateHealthReport(patientId, { bp: true });
      const url = URL.createObjectURL(blob);

      if (lastObjectUrlRef.current) {
        try {
          URL.revokeObjectURL(lastObjectUrlRef.current);
        } catch {}
      }
      lastObjectUrlRef.current = url;

      setPdfUrl(url);
      setPdfFilename(filename || 'vitals_report.pdf');
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
    a.download = pdfFilename || 'vitals_report.pdf';
    a.click();
    toast('Download started.', { type: 'success' });
  }

  async function handleSharePdf() {
    const ok = await ensurePdfGenerated();
    if (!ok || !pdfUrl) return;
    try {
      const res = await fetch(pdfUrl);
      const blob = await res.blob();
      const file = new File([blob], pdfFilename || 'vitals_report.pdf', { type: 'application/pdf' });

      if ((navigator as any).share && (navigator as any).canShare?.({ files: [file] })) {
        await (navigator as any).share({
          title: 'Vitals Report',
          text: 'Here is my vitals report.',
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
    router.push(`/reports/vitals?${qs.toString()}`);
  }

  const chartSys = useMemo(() => {
    const vals = sysArr.slice(-64);
    return vals.length ? vals : [120, 132, 126, 128, 124, 130];
  }, [sysArr]);

  const chartDia = useMemo(() => {
    const vals = diaArr.slice(-64);
    return vals.length ? vals : [80, 84, 82, 83, 81, 85];
  }, [diaArr]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-6xl px-4 pt-6">
        {/* Header */}
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
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">Vitals Report</h1>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">
                  {range.toUpperCase()}
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                  Local data + fallbacks
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Generated: {hideSensitive ? 'Hidden' : generatedAtText}
                {!hideSensitive ? ` • Patient: ${patientId}` : ''}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Pill active={discreet} onClick={() => setDiscreet((v) => !v)} title="Hide values across cards/tables">
              Discreet
            </Pill>
            <Pill active={hideSensitive} onClick={() => setHideSensitive((v) => !v)} title="Hide patient id + timestamps">
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

        {/* Range */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="text-xs text-slate-500">Range</div>
          <Pill active={range === '7d'} onClick={() => setRange('7d')} title="Last 7 days">
            7D
          </Pill>
          <Pill active={range === '30d'} onClick={() => setRange('30d')} title="Last 30 days">
            30D
          </Pill>
          <Pill active={range === '90d'} onClick={() => setRange('90d')} title="Last 90 days (recommended)">
            90D
          </Pill>
          <Pill active={range === '1y'} onClick={() => setRange('1y')} title="Last 1 year">
            1Y
          </Pill>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">Loading vitals…</div>
        ) : (
          <>
            {/* Quick stats */}
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card
                title="At a glance"
                subtitle="Latest available readings"
                right={
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Local-only
                  </span>
                }
              >
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <StatCard
                    icon={<Gauge className="h-4 w-4" />}
                    label="Blood Pressure"
                    value={
                      latestBp?.systolic && latestBp?.diastolic
                        ? `${fmtNum(latestBp.systolic)}/${fmtNum(latestBp.diastolic)}`
                        : '—'
                    }
                    unit="mmHg"
                    sub={hideSensitive ? 'Timestamp hidden' : `Last: ${fmtDateTime(latestBp?.ts)}`}
                    discreet={discreet}
                  />
                  <StatCard icon={<HeartPulse className="h-4 w-4" />} label="Heart Rate" value={fmtNum(latest.hr)} unit="bpm" discreet={discreet} />
                  <StatCard icon={<Droplets className="h-4 w-4" />} label="SpO₂" value={fmtNum(latest.spo2)} unit="%" discreet={discreet} />
                  <StatCard icon={<Thermometer className="h-4 w-4" />} label="Temperature" value={fmtNum(latest.temp, 1)} unit="°C" discreet={discreet} />
                  <StatCard icon={<Wind className="h-4 w-4" />} label="Resp Rate" value={fmtNum(latest.rr)} unit="rpm" discreet={discreet} />
                  <StatCard icon={<Activity className="h-4 w-4" />} label="Glucose" value={fmtNum(latest.glucose)} unit="mg/dL" discreet={discreet} />
                  <StatCard icon={<Activity className="h-4 w-4" />} label="Steps" value={fmtNum(latest.steps)} discreet={discreet} />
                  <StatCard icon={<Activity className="h-4 w-4" />} label="Calories" value={fmtNum(latest.calories)} unit="kcal" discreet={discreet} />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium ${bpTag.cls}`}>
                    {bpTag.label}
                  </span>
                  <span className="text-xs text-slate-500">
                    This is informational, not a diagnosis.
                  </span>
                </div>
              </Card>

              <Card
                title="Cardio signal"
                subtitle="Conservative guidance based on BP + optional supportive signals"
                right={
                  <span
                    className={[
                      'rounded-full border px-2.5 py-1 text-xs font-medium',
                      bpRisk.risk === 'high'
                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                        : bpRisk.risk === 'moderate'
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700',
                    ].join(' ')}
                  >
                    {bpRisk.risk.toUpperCase()}
                  </span>
                }
              >
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  {hideSensitive ? 'Notes hidden.' : bpRisk.notes}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">Hypertension index</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-900">{discreet ? '•••' : fmtNum(hIndex)}</div>
                    <div className="mt-1 text-xs text-slate-500">0–100 (report heuristic)</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">Last BP class</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-900">{discreet ? '•••' : bpTag.label}</div>
                    <div className="mt-1 text-xs text-slate-500">Based on SYS/DIA only</div>
                  </div>
                </div>

                {bpRisk.risk === 'high' ? (
                  <div className="mt-4 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4" />
                    <div>
                      If you feel unwell (chest pain, severe headache, shortness of breath, fainting), seek urgent care.
                    </div>
                  </div>
                ) : null}
              </Card>

              <Card title="Export & sharing" subtitle="Use the UI for understanding. Export PDF for clinicians / records.">
                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    Your report PDF includes a compact table and BP trend section. Generate it only when needed (fast + privacy-friendly).
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await ensurePdfGenerated();
                        if (!ok) return;
                        setShowPdfPreview(true);
                      }}
                      className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                      disabled={pdfBusy}
                    >
                      {pdfBusy ? 'Preparing…' : 'Generate PDF'}
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      disabled={pdfBusy}
                    >
                      Download
                    </button>

                    <button
                      type="button"
                      onClick={handleSharePdf}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      disabled={pdfBusy}
                    >
                      Share
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-500">
                    Tip: Add <code className="rounded bg-white px-1 py-0.5">?patientId=...</code> in the URL for demos.
                  </div>
                </div>
              </Card>
            </section>

            {/* BP trend */}
            <section className="mt-6">
              <Card
                title="Blood pressure trend"
                subtitle="Systolic (red) and Diastolic (amber) over the selected range"
                right={
                  <div className="text-xs text-slate-500">
                    {hideSensitive ? 'Dates hidden' : `${bpPoints.length} points`}
                  </div>
                }
              >
                <div className={discreet ? 'blur-md select-none pointer-events-none' : ''}>
                  <DualLineSpark a={chartSys} b={chartDia} discreet={false} />
                </div>
                {discreet ? (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                    Discreet mode hides the chart. Turn it off to view trends.
                  </div>
                ) : null}

                <div className="mt-3 text-xs text-slate-500">
                  Interpreting trends is more reliable when readings are taken consistently (same time of day, rested).
                </div>
              </Card>
            </section>

            {/* Readings table */}
            <section className="mt-6">
              <Card title="Recent readings" subtitle="The last measurements we have available (BP is the most reliable right now).">
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="grid grid-cols-12 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                    <div className="col-span-4">Date</div>
                    <div className="col-span-3">Systolic</div>
                    <div className="col-span-3">Diastolic</div>
                    <div className="col-span-2 text-right">Class</div>
                  </div>

                  <div className="max-h-[520px] overflow-auto">
                    {bpPoints
                      .slice()
                      .sort((a, b) => b.ts.localeCompare(a.ts))
                      .map((p) => {
                        const tag = classifyBp(p.systolic, p.diastolic);
                        return (
                          <div
                            key={p.ts}
                            className="grid grid-cols-12 items-center gap-2 border-t border-slate-100 px-4 py-3 hover:bg-slate-50"
                          >
                            <div className="col-span-4">
                              <div className="text-sm font-medium text-slate-900">
                                {hideSensitive ? 'Hidden' : fmtDatePretty(p.dateISO)}
                              </div>
                              <div className="text-xs text-slate-500">{hideSensitive ? '—' : fmtDateTime(p.ts)}</div>
                            </div>

                            <div className="col-span-3 text-sm text-slate-700">
                              {discreet ? '•••' : typeof p.systolic === 'number' ? `${fmtNum(p.systolic)} mmHg` : '—'}
                            </div>

                            <div className="col-span-3 text-sm text-slate-700">
                              {discreet ? '•••' : typeof p.diastolic === 'number' ? `${fmtNum(p.diastolic)} mmHg` : '—'}
                            </div>

                            <div className="col-span-2 text-right">
                              <span className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${tag.cls}`}>
                                {discreet ? '•••' : tag.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-slate-500">
                  If you’re seeing missing diastolic values, ensure the device sends both SYS and DIA to history storage.
                </div>
              </Card>
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
                  title="Vitals Report PDF Preview"
                />
              </section>
            ) : null}

            <div className="mt-8 text-xs text-slate-500">
              This report is informational and not medical advice. If you have concerning symptoms, consult a clinician.
            </div>
          </>
        )}
      </div>
    </main>
  );
}
