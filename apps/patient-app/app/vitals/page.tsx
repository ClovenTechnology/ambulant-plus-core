// apps/patient-app/app/vitals/page.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { fmt2 } from '../../src/lib/number';
import { formatDateTime } from '../../src/lib/date';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import MeterDonut from '@/components/charts/MeterDonut';
import BpChart from '@/components/charts/BpChart';
import SleepCard from '@/components/charts/SleepCard';
import { exportElementAsPdf, exportCsv, shareFile } from '@/components/charts/export';
import useVitalsSSE from '@/components/useVitalsSSE';
import { usePlan } from '@/components/context/PlanContext';

/* ---------- VitalSparkline (null-safe) + Tooltip (fixed, no innerHTML) ---------- */
const STATUS_COLOR: Record<string, string> = {
  normal: '#10b981', // green
  warning: '#facc15', // yellow
  critical: '#ef4444', // red
  unknown: '#94a3b8', // gray
};

type Status = 'normal' | 'warning' | 'critical' | 'unknown';

type VitalSparklineProps = {
  values: Array<number | null>;
  statusFn: (v?: number) => Status;
  width?: number;
  height?: number;
  unit?: string;
  timestamps?: string[];
  tooltipDisabled?: boolean;
  valueFormatter?: (v: number) => string; // default: raw
};

type Tip = {
  show: boolean;
  x: number;
  y: number;
  valueText: string;
  status: Status;
  tsText?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function VitalSparkline({
  values,
  statusFn,
  width = 520,
  height = 90,
  unit,
  timestamps,
  tooltipDisabled,
  valueFormatter,
}: VitalSparklineProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  const numericValues = useMemo(
    () => values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v)),
    [values],
  );

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // If no usable data, draw faint baseline
    if (numericValues.length < 2 || values.length < 2) {
      ctx.strokeStyle = 'rgba(148,163,184,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height - 1);
      ctx.lineTo(width, height - 1);
      ctx.stroke();
      return;
    }

    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);
    const scale = max - min || 1;

    ctx.lineWidth = 2;

    // Draw segments; skip nulls so we never connect missing data
    for (let i = 0; i < values.length - 1; i++) {
      const v1 = values[i];
      const v2 = values[i + 1];
      if (typeof v1 !== 'number' || !Number.isFinite(v1)) continue;
      if (typeof v2 !== 'number' || !Number.isFinite(v2)) continue;

      const x1 = (i * width) / (values.length - 1);
      const x2 = ((i + 1) * width) / (values.length - 1);
      const y1 = height - ((v1 - min) / scale) * height;
      const y2 = height - ((v2 - min) / scale) * height;

      const status = statusFn(v1);
      ctx.strokeStyle = STATUS_COLOR[status] || STATUS_COLOR.unknown;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }, [values, numericValues, statusFn, width, height]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const hide = () => setTip(null);

    const handleMouseMove = (e: MouseEvent) => {
      if (tooltipDisabled) return;

      const rect = canvas.getBoundingClientRect();
      const relX = e.clientX - rect.left;

      const n = Math.max(2, values.length);
      const step = rect.width / (n - 1);
      const idx = clamp(Math.round(relX / step), 0, n - 1);

      const raw = values[idx];
      if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        setTip(null);
        return;
      }

      const status = statusFn(raw);
      const ts = timestamps?.[idx];

      const valText = valueFormatter ? valueFormatter(raw) : String(raw);
      const valueText = unit ? `${valText} ${unit}` : valText;

      // fixed tooltip in viewport coords, clamped
      const approxW = 220;
      const approxH = 88;
      const x = clamp(e.clientX + 12, 8, window.innerWidth - approxW - 8);
      const y = clamp(e.clientY + 12, 8, window.innerHeight - approxH - 8);

      setTip({
        show: true,
        x,
        y,
        valueText,
        status,
        tsText: ts ? new Date(ts).toLocaleString() : undefined,
      });
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', hide);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', hide);
    };
  }, [values, timestamps, statusFn, tooltipDisabled, unit, valueFormatter]);

  return (
    <div className="relative w-full h-full">
      <canvas ref={ref} className="block rounded w-full h-full" />
      {tip?.show && (
        <div
          className="pointer-events-none fixed bg-white border border-gray-300 rounded shadow px-2 py-1 text-xs"
          style={{ left: tip.x, top: tip.y, zIndex: 50 }}
        >
          <div className="text-xs">
            <span className="text-gray-500">Value:</span> {tip.valueText}
          </div>
          <div className="text-xs">
            <span className="text-gray-500">Status:</span> {tip.status}
          </div>
          {tip.tsText && <div className="text-[11px] text-gray-500">{tip.tsText}</div>}
        </div>
      )}
    </div>
  );
}

/* ---------- Types ---------- */
type Vital = {
  id: string;
  ts: string;
  device?: string;
  hr?: number;
  sys?: number;
  dia?: number;
  spo2?: number;
  temp_c?: number;
  bmi?: number;
  glucose_mg_dl?: number;
  __annotations?: { ts: string; text: string }[];
};

type VitalsRange = '20' | '7d' | '30d' | '90d' | '1y' | 'custom';

/* ---------- Helpers ---------- */
function statusForHr(hr?: number): Status {
  if (hr == null) return 'unknown';
  if (hr < 50 || hr > 120) return 'critical';
  if (hr < 60 || hr > 100) return 'warning';
  return 'normal';
}
function statusForBp(sys?: number, dia?: number): Status {
  if (sys == null || dia == null) return 'unknown';
  if (sys >= 180 || dia >= 120) return 'critical';
  if (sys >= 140 || dia >= 90) return 'warning';
  return 'normal';
}
function statusForSpo2(spo2?: number): Status {
  if (spo2 == null) return 'unknown';
  if (spo2 < 90) return 'critical';
  if (spo2 < 94) return 'warning';
  return 'normal';
}
function statusForTemp(temp_c?: number): Status {
  if (temp_c == null) return 'unknown';
  if (temp_c >= 40 || temp_c < 34) return 'critical';
  if (temp_c >= 38 || temp_c < 36) return 'warning';
  return 'normal';
}
function statusForGlucose(gl?: number): Status {
  if (gl == null) return 'unknown';
  if (gl < 70 || gl > 180) return 'critical';
  if (gl < 90 || gl > 140) return 'warning';
  return 'normal';
}

function badgeProps(status: Status) {
  switch (status) {
    case 'normal':
      return { text: 'OK', className: 'bg-green-100 text-green-800' };
    case 'warning':
      return { text: 'Watch', className: 'bg-yellow-100 text-yellow-800' };
    case 'critical':
      return { text: 'High', className: 'bg-red-100 text-red-800' };
    default:
      return { text: '-', className: 'bg-gray-100 text-gray-700' };
  }
}

function prettyDevice(device?: string) {
  if (!device) return 'Unknown';
  if (/nexring/i.test(device)) return 'NexRing';
  if (/health/i.test(device)) return 'Health Monitor';
  if (/manual/i.test(device)) return 'Manual';
  return device;
}

function worstStatus(statuses: Status[]): Status {
  const known = statuses.filter(s => s !== 'unknown');
  if (!known.length) return 'unknown';
  if (known.includes('critical')) return 'critical';
  if (known.includes('warning')) return 'warning';
  if (known.includes('normal')) return 'normal';
  return 'unknown';
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yday = new Date();
  yday.setDate(yday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTimeAgo(ts?: string): string {
  if (!ts) return '';
  const t = new Date(ts).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - t);
  const sec = Math.floor(diff / 1000);
  if (sec < 10) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min${min > 1 ? 's' : ''} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr > 1 ? 's' : ''} ago`;
  const d = Math.floor(hr / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}

function safeNum(v?: number) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function isSensitiveMetric(metric: 'bp' | 'glucose' | 'hr' | 'spo2' | 'temp' | 'steps') {
  return metric === 'bp' || metric === 'glucose';
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function todayDateStr() {
  return isoDate(new Date());
}

function includesToday(range: VitalsRange, customEnd?: string) {
  if (range !== 'custom') return true;
  const end = (customEnd || '').trim();
  const t = todayDateStr();
  if (!end) return true; // open-ended -> assume includes today
  return end >= t; // YYYY-MM-DD lexical compare is safe
}

function redactRows(rows: Vital[], discreet: boolean, hideSensitive: boolean): Vital[] {
  return rows.map(r => {
    const out: Vital = { ...r };

    // Notes can leak context; if any privacy mode is on, strip notes from exports
    if (discreet || hideSensitive) out.__annotations = [];

    if (discreet) {
      out.hr = undefined;
      out.sys = undefined;
      out.dia = undefined;
      out.spo2 = undefined;
      out.temp_c = undefined;
      out.glucose_mg_dl = undefined;
      out.bmi = undefined;
      return out;
    }

    if (hideSensitive) {
      out.sys = undefined;
      out.dia = undefined;
      out.glucose_mg_dl = undefined;
      return out;
    }

    return out;
  });
}

function vitalsRangeQuery(range: VitalsRange, customStart?: string, customEnd?: string) {
  const q = new URLSearchParams();
  q.set('range', range);
  if (range === 'custom') {
    if (customStart?.trim()) q.set('start', customStart.trim());
    if (customEnd?.trim()) q.set('end', customEnd.trim());
  }
  return q;
}

/* ---------- ECG Canvas ---------- */
function ECGCanvas({ running }: { running: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let t = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.parentElement?.clientWidth || 600;
      const h = canvas.parentElement?.clientHeight || 140;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const draw = () => {
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      ctx.clearRect(0, 0, w, h);

      // subtle grid
      ctx.strokeStyle = 'rgba(148,163,184,0.06)';
      for (let x = 0; x < w; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const phase = (t + x) / 24;
        const y =
          h / 2 +
          Math.sin(phase) * 8 +
          Math.sin(phase * 0.5 + 1.2) * 3 +
          (phase % (Math.PI * 2) > 0.15 && phase % (Math.PI * 2) < 0.22 ? -22 : 0);

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      t += running ? 3 : 0.5;
      raf.current = requestAnimationFrame(draw);
    };

    raf.current = requestAnimationFrame(draw);
    return () => {
      ro.disconnect();
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [running]);

  return <canvas ref={ref} className="w-full h-full block rounded" />;
}

/* ---------- Wearable Insights (respects discreet) ---------- */
function WearableInsights(props: { discreet: boolean }) {
  const { discreet } = props;

  const { data, isLoading } = useQuery({
    queryKey: ['wearable-insights'],
    queryFn: async () => {
      const r = await fetch('/api/wearable-insights', { cache: 'no-store' });
      if (!r.ok) throw new Error('failed');
      return r.json();
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <div className="p-3">Loading insights…</div>;
  if (!data) return null;

  return (
    <div className="rounded-lg border p-3 bg-white">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Wearable Insights</div>
          <div className="text-xs text-gray-500">NexRing summary</div>
          <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100">
              ◉ NexRing
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100">
              ◉ Health Monitor
            </span>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          {discreet ? '—' : new Date(data.generatedAt).toLocaleString()}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <div className="text-center">
          {discreet ? (
            <div className="mx-auto h-16 w-16 rounded-full bg-slate-100 border" />
          ) : (
            <MeterDonut value={data.sleep_score} max={100} label="Sleep Score" />
          )}
          <div className="text-xs mt-2 text-gray-600">Sleep Score</div>
        </div>

        <div className="text-center">
          <div className="h-12 flex items-center justify-center">
            <VitalSparkline
              values={Array.from({ length: 20 }, (_, i) => 20 + Math.sin(i / 3) * 5 + Math.random() * 5)}
              statusFn={() => 'normal'}
              tooltipDisabled={discreet}
              valueFormatter={() => (discreet ? '•••' : '—')}
            />
          </div>
          <div className="text-xs mt-2 text-gray-600">{discreet ? 'HRV •••' : `HRV ${data.hrv_ms} ms`}</div>
        </div>

        <div className="text-center">
          {discreet ? (
            <div className="mx-auto h-16 w-16 rounded-full bg-slate-100 border" />
          ) : (
            <MeterDonut value={data.readiness} max={100} label="Readiness" />
          )}
          <div className="text-xs mt-2 text-gray-600">Daily readiness</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Query Client ---------- */
const queryClient = new QueryClient();

/* ---------- Vitals List + Graphs + ECG Card ---------- */
function VitalsList(props: {
  range: VitalsRange;
  setRange: (r: VitalsRange) => void;
  customStart: string;
  setCustomStart: (v: string) => void;
  customEnd: string;
  setCustomEnd: (v: string) => void;

  discreet: boolean;
  setDiscreet: (v: boolean) => void;
  hideSensitive: boolean;
  setHideSensitive: (v: boolean) => void;
}) {
  const {
    range,
    setRange,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    discreet,
    setDiscreet,
    hideSensitive,
    setHideSensitive,
  } = props;

  const qc = useQueryClient();
  const { isPremium } = usePlan(); // available if you want to gate anything later

  // persisted UI prefs (local to this component)
  const [unitC, setUnitC] = useState(true);
  const [glucoseMgDl, setGlucoseMgDl] = useState(true);
  const [view, setView] = useState<'list' | 'graph'>('list');
  const [graphTab, setGraphTab] = useState<'bp' | 'hr' | 'spo2' | 'temp' | 'glucose' | 'steps'>('bp');

  const exportRef = useRef<HTMLElement | null>(null);
  const [ecgOn, setEcgOn] = useState(false);

  const [annotateTarget, setAnnotateTarget] = useState<Vital | null>(null);
  const [annotateText, setAnnotateText] = useState('');
  const [annotateSaving, setAnnotateSaving] = useState(false);
  const [annotateError, setAnnotateError] = useState<string | null>(null);

  const [lastUpdateLabel, setLastUpdateLabel] = useState('');

  // load prefs from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const v = window.localStorage.getItem('vitals:view');
      const g = window.localStorage.getItem('vitals:graphTab');
      const c = window.localStorage.getItem('vitals:unitC');
      const gl = window.localStorage.getItem('vitals:glucoseMgDl');

      if (v === 'list' || v === 'graph') setView(v);
      if (g === 'bp' || g === 'hr' || g === 'spo2' || g === 'temp' || g === 'glucose' || g === 'steps') setGraphTab(g);
      if (c === 'true' || c === 'false') setUnitC(c === 'true');
      if (gl === 'true' || gl === 'false') setGlucoseMgDl(gl === 'true');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem('vitals:view', view); } catch {}
  }, [view]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem('vitals:graphTab', graphTab); } catch {}
  }, [graphTab]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem('vitals:unitC', String(unitC)); } catch {}
  }, [unitC]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem('vitals:glucoseMgDl', String(glucoseMgDl)); } catch {}
  }, [glucoseMgDl]);

  // Keep custom dates sane (swap if user flips them)
  useEffect(() => {
    if (range !== 'custom') return;
    if (!customStart || !customEnd) return;
    if (customEnd < customStart) {
      setCustomStart(customEnd);
      setCustomEnd(customStart);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, customStart, customEnd]);

  const rangeKey = useMemo(() => {
    if (range !== 'custom') return range;
    return `custom:${customStart || ''}:${customEnd || ''}`;
  }, [range, customStart, customEnd]);

  // ✅ range is canonical in query key + API params
  const {
    data: rows = [],
    isLoading,
    isFetching,
    error,
  } = useQuery<Vital[]>({
    queryKey: ['vitals', rangeKey],
    queryFn: async () => {
      const url = new URL('/api/vitals', window.location.origin);
      url.searchParams.set('range', range);
      if (range === 'custom') {
        if (customStart?.trim()) url.searchParams.set('start', customStart.trim());
        if (customEnd?.trim()) url.searchParams.set('end', customEnd.trim());
      }
      const r = await fetch(url.toString(), { cache: 'no-store' });
      if (!r.ok) throw new Error('failed');
      const json = await r.json();
      return Array.isArray(json) ? json : [];
    },
    keepPreviousData: true,
    refetchOnWindowFocus: false,
  });

  const { latest } = useVitalsSSE('default-room');

  // ✅ SSE updates the canonical range cache key (only if the window includes "today")
  useEffect(() => {
    if (!latest) return;
    if (!includesToday(range, customEnd)) return;

    const v: Vital = {
      id: `live-${latest.ts}`,
      ts: new Date(latest.ts).toISOString(),
      hr: latest.hr,
      spo2: latest.spo2,
      temp_c: latest.tempC,
      sys: latest.bp?.sys,
      dia: latest.bp?.dia,
      glucose_mg_dl: latest.glucose,
      device: 'NexRing/Live',
    };

    qc.setQueryData(['vitals', rangeKey], (old: any) => {
      const prev = Array.isArray(old) ? old : [];
      if (prev.find((x: any) => x.id === v.id)) return prev;
      return [v, ...prev].slice(0, 4000);
    });
  }, [latest, qc, range, rangeKey, customEnd]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  }, [rows]);

  // last updated label:
  // - if viewing a window that includes "today", prefer SSE timestamp
  // - else use the newest row in the fetched window
  useEffect(() => {
    const preferLive = includesToday(range, customEnd);
    const ts = (preferLive ? latest?.ts : undefined) ?? sorted[0]?.ts;

    if (!ts) {
      setLastUpdateLabel('');
      return;
    }
    const iso = typeof ts === 'string' ? ts : new Date(ts).toISOString();
    setLastUpdateLabel(formatTimeAgo(iso));
    const id = window.setInterval(() => setLastUpdateLabel(formatTimeAgo(iso)), 15000);
    return () => window.clearInterval(id);
  }, [latest, sorted, range, customEnd]);

  const latestVital = sorted[0];

  const groupedByDay = useMemo(() => {
    const map = new Map<string, Vital[]>();
    for (const v of sorted.slice(0, 300)) {
      const key = new Date(v.ts).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    }
    return Array.from(map.entries());
  }, [sorted]);

  async function handleAnnotateSave() {
    if (!annotateTarget || !annotateText.trim()) {
      setAnnotateTarget(null);
      setAnnotateText('');
      setAnnotateError(null);
      return;
    }

    try {
      setAnnotateSaving(true);
      setAnnotateError(null);

      const res = await fetch(`/api/vitals/${annotateTarget.id}/annotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: annotateText.trim() }),
      });

      if (!res.ok) {
        setAnnotateError('Failed to save note. Please try again.');
        return;
      }

      // invalidate all vitals ranges
      await qc.invalidateQueries({ queryKey: ['vitals'] });

      setAnnotateTarget(null);
      setAnnotateText('');
    } catch {
      setAnnotateError('Failed to save note. Please try again.');
    } finally {
      setAnnotateSaving(false);
    }
  }

  function downloadCSV() {
    const redacted = redactRows(sorted, discreet, hideSensitive);
    const fnameBase = discreet || hideSensitive ? 'vitals-redacted' : 'vitals';
    exportCsv(redacted, `${fnameBase}-${new Date().toISOString()}.csv`);
  }

  const deviceSetForWindow = useMemo(() => {
    const set = new Set<string>();
    for (const v of sorted) {
      if (v.device) set.add(prettyDevice(v.device));
    }
    if (!set.size) return 'Unknown';
    return Array.from(set).join(', ');
  }, [sorted]);

  const sensitiveTabHidden =
    hideSensitive &&
    isSensitiveMetric(graphTab === 'bp' ? 'bp' : graphTab === 'glucose' ? 'glucose' : graphTab);

  const currentTabStatus: Status = useMemo(() => {
    if (!sorted.length) return 'unknown';
    if (discreet) return 'unknown';
    if (sensitiveTabHidden) return 'unknown';

    const src = sorted.slice(0, 60);
    if (graphTab === 'hr') return worstStatus(src.map(v => statusForHr(v.hr)));
    if (graphTab === 'spo2') return worstStatus(src.map(v => statusForSpo2(v.spo2)));
    if (graphTab === 'temp') return worstStatus(src.map(v => statusForTemp(v.temp_c)));
    if (graphTab === 'glucose') return worstStatus(src.map(v => statusForGlucose(v.glucose_mg_dl)));
    if (graphTab === 'bp') return worstStatus(src.map(v => statusForBp(v.sys, v.dia)));
    return 'normal';
  }, [graphTab, sorted, discreet, sensitiveTabHidden]);

  const currentTabBadge = badgeProps(currentTabStatus);
  const isEmpty = !isLoading && !sorted.length;

  const sparklineData = useMemo(() => {
    const src = sorted.slice(0, 120);

    const hr = src.map(s => safeNum(s.hr));
    const hr_ts = src.map(s => s.ts);

    const spo2 = src.map(s => safeNum(s.spo2));
    const spo2_ts = src.map(s => s.ts);

    const temp = src.map(s => {
      const c = safeNum(s.temp_c);
      if (c == null) return null;
      return unitC ? c : (c * 9) / 5 + 32;
    });
    const temp_ts = src.map(s => s.ts);

    const glucose = src.map(s => {
      const g = safeNum(s.glucose_mg_dl);
      if (g == null) return null;
      return glucoseMgDl ? g : g / 18;
    });
    const glucose_ts = src.map(s => s.ts);

    const bpPoints = src
      .map(s => ({ ts: s.ts, sys: safeNum(s.sys), dia: safeNum(s.dia) }))
      .filter(p => typeof p.sys === 'number' && typeof p.dia === 'number')
      .map(p => ({ ts: p.ts, sys: p.sys as number, dia: p.dia as number }));

    const bpSys = src.map(s => safeNum(s.sys));
    const bpDia = src.map(s => safeNum(s.dia));
    const bp_ts = src.map(s => s.ts);

    // demo-only
    const steps: Array<number | null> = Array.from({ length: 30 }, (_, i) =>
      1000 + Math.round(Math.sin(i / 3) * 500 + Math.random() * 400),
    );

    return { bpPoints, bpSys, bpDia, bp_ts, hr, hr_ts, spo2, spo2_ts, temp, temp_ts, glucose, glucose_ts, steps };
  }, [sorted, unitC, glucoseMgDl]);

  function displayValue(opts: { value: string; sensitive?: boolean }) {
    if (discreet) return '•••';
    if (opts.sensitive && hideSensitive) return 'Hidden';
    return opts.value;
  }

  function displayBadge(status: Status, sensitive?: boolean) {
    if (discreet) return badgeProps('unknown');
    if (sensitive && hideSensitive) return badgeProps('unknown');
    return badgeProps(status);
  }

  const exportDisabledReason = useMemo(() => {
    void isPremium;
    return null as string | null;
  }, [isPremium]);

  const rangeButtons: Array<{ key: VitalsRange; label: string }> = [
    { key: '20', label: 'Last 20' },
    { key: '7d', label: '7 days' },
    { key: '30d', label: '30 days' },
    { key: '90d', label: '90 days' },
    { key: '1y', label: '1 year' },
    { key: 'custom', label: 'Custom' },
  ];

  const chartsRangeParams = useMemo(() => vitalsRangeQuery(range, customStart, customEnd), [range, customStart, customEnd]);

  return (
    <div className="space-y-4">
      {/* ---------- Vitals Card (List / Graph) ---------- */}
      <section aria-label="Vitals history">
        <div className="rounded-xl border bg-white shadow-sm">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 px-4 pt-3 pb-2 border-b">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-3">
                {/* Units */}
                <div className="inline-flex items-center gap-2">
                  <label className="text-sm text-gray-600">Temp</label>
                  <button
                    onClick={() => setUnitC(c => !c)}
                    className="px-2 py-1 border rounded text-xs"
                    type="button"
                  >
                    {unitC ? '°C' : '°F'}
                  </button>
                </div>

                <div className="inline-flex items-center gap-2">
                  <label className="text-sm text-gray-600">Glucose</label>
                  <button
                    onClick={() => setGlucoseMgDl(g => !g)}
                    className="px-2 py-1 border rounded text-xs"
                    type="button"
                  >
                    {glucoseMgDl ? 'mg/dL' : 'mmol/L'}
                  </button>
                </div>

                {/* Canonical Range */}
                <div className="ml-0 md:ml-2 inline-flex flex-wrap items-center gap-1 text-xs text-gray-600">
                  <span className="text-gray-500 mr-1">Range</span>
                  {rangeButtons.map(btn => (
                    <button
                      key={btn.key}
                      onClick={() => {
                        if (btn.key === 'custom') {
                          // seed custom range if empty (last 30 days)
                          if (!customStart && !customEnd) {
                            const end = todayDateStr();
                            const start = isoDate(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));
                            setCustomStart(start);
                            setCustomEnd(end);
                          }
                        }
                        setRange(btn.key);
                      }}
                      className={`px-2 py-0.5 rounded-full border ${
                        range === btn.key ? 'border-slate-900 bg-slate-900 text-white' : 'border-gray-200 bg-white'
                      }`}
                      type="button"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                {/* View toggle */}
                <div className="ml-0 md:ml-3 inline-flex items-center rounded-full bg-gray-100 p-0.5 text-xs">
                  <button
                    onClick={() => setView('list')}
                    className={`px-3 py-1 rounded-full ${view === 'list' ? 'bg-white shadow-sm' : ''}`}
                    type="button"
                  >
                    List
                  </button>
                  <button
                    onClick={() => setView('graph')}
                    className={`px-3 py-1 rounded-full ${view === 'graph' ? 'bg-white shadow-sm' : ''}`}
                    type="button"
                  >
                    Graph
                  </button>
                </div>

                {/* Privacy */}
                <div className="ml-0 md:ml-2 inline-flex items-center gap-2">
                  <button
                    onClick={() => setDiscreet(!discreet)}
                    className={`px-3 py-1 rounded-full border text-xs ${
                      discreet ? 'border-slate-900 bg-slate-900 text-white' : 'border-gray-200 bg-white text-gray-700'
                    }`}
                    type="button"
                    aria-pressed={discreet}
                    title="Mask values and disable tooltips"
                  >
                    {discreet ? '🙈 Discreet' : 'Discreet'}
                  </button>
                  <button
                    onClick={() => setHideSensitive(!hideSensitive)}
                    className={`px-3 py-1 rounded-full border text-xs ${
                      hideSensitive ? 'border-slate-900 bg-slate-900 text-white' : 'border-gray-200 bg-white text-gray-700'
                    }`}
                    type="button"
                    aria-pressed={hideSensitive}
                    title="Hide sensitive metrics (BP + Glucose)"
                  >
                    {hideSensitive ? '🔒 Sensitive hidden' : 'Hide sensitive'}
                  </button>
                </div>
              </div>

              {/* Custom date pickers */}
              {range === 'custom' && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  <span className="text-gray-500">From</span>
                  <input
                    type="date"
                    className="border rounded px-2 py-1 text-xs bg-white"
                    value={customStart}
                    onChange={e => setCustomStart(e.target.value)}
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="date"
                    className="border rounded px-2 py-1 text-xs bg-white"
                    value={customEnd}
                    onChange={e => setCustomEnd(e.target.value)}
                  />
                  <span className="text-[11px] text-gray-400">
                    (Leave “to” empty for open-ended)
                  </span>
                </div>
              )}
            </div>

            {/* Exports + freshness */}
            <div className="flex flex-col items-end gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={downloadCSV}
                  className="px-3 py-2 border rounded bg-white text-xs disabled:opacity-50"
                  title={exportDisabledReason ?? 'Export CSV'}
                  aria-label="Export vitals as CSV file"
                  type="button"
                  disabled={!!exportDisabledReason}
                >
                  📥 CSV
                </button>

                <button
                  onClick={async () => {
                    const el = exportRef.current;
                    if (!el) return;
                    const base = discreet || hideSensitive ? 'vitals-redacted' : 'vitals';
                    await exportElementAsPdf(el, `${base}-${new Date().toISOString()}.pdf`);
                  }}
                  className="px-3 py-2 border rounded bg-white text-xs disabled:opacity-50"
                  title={exportDisabledReason ?? 'Export PDF'}
                  aria-label="Export vitals as PDF file"
                  type="button"
                  disabled={!!exportDisabledReason}
                >
                  📥 PDF
                </button>

                <button
                  onClick={async () => {
                    const el = exportRef.current;
                    if (!el) return;
                    const canvas = await import('html2canvas').then(m => m.default(el));
                    canvas.toBlob(async blob => {
                      if (!blob) return;
                      await shareFile({
                        blob,
                        filename: `${discreet || hideSensitive ? 'vitals-redacted' : 'vitals'}-${Date.now()}.png`,
                        text: 'Vitals snapshot',
                      });
                    });
                  }}
                  className="px-3 py-2 border rounded bg-white text-xs disabled:opacity-50"
                  aria-label="Share vitals snapshot"
                  type="button"
                  disabled={!!exportDisabledReason}
                >
                  Share
                </button>
              </div>

              <div className="text-[11px] text-gray-400" aria-live="polite">
                {lastUpdateLabel ? `Updated ${lastUpdateLabel}` : 'Awaiting first reading…'}
              </div>
            </div>
          </div>

          {/* Body (exportable) */}
          <div ref={exportRef} className="p-4">
            {isLoading && !rows.length && (
              <div className="space-y-3">
                <div className="h-4 w-40 rounded bg-gray-100 animate-pulse" />
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-10 rounded-lg bg-gray-50 border animate-pulse" />
                  ))}
                </div>
              </div>
            )}

            {error && !isLoading && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                Unable to load vitals right now. Please check your connection and try again.
              </div>
            )}

            {isEmpty && !isLoading && !error && (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                <div className="font-medium mb-1">No vitals yet</div>
                <p className="text-xs text-gray-500">
                  Take a reading with your Health Monitor or wear your NexRing for 24 hours to start building your vitals timeline.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">
                    Start Health Monitor check
                  </span>
                  <span className="inline-flex px-3 py-1 rounded-full bg-sky-100 text-sky-700">
                    Sync NexRing data
                  </span>
                </div>
              </div>
            )}

            {!isEmpty && !isLoading && !error && (
              <>
                {view === 'list' ? (
                  // ---------- Timeline-style list ----------
                  <div className="space-y-4">
                    {groupedByDay.map(([dayKey, items]) => (
                      <section key={dayKey} className="space-y-1">
                        <div className="text-xs font-semibold text-gray-500">{formatDayLabel(dayKey)}</div>
                        <div className="divide-y rounded-lg border bg-gray-50/60">
                          {items.map(v => {
                            const hrStatus = discreet ? 'unknown' : statusForHr(v.hr);
                            const bpStatus = discreet
                              ? 'unknown'
                              : hideSensitive
                              ? 'unknown'
                              : statusForBp(v.sys, v.dia);
                            const spo2Status = discreet ? 'unknown' : statusForSpo2(v.spo2);
                            const tempStatus = discreet ? 'unknown' : statusForTemp(v.temp_c);
                            const glucoseStatus = discreet
                              ? 'unknown'
                              : hideSensitive
                              ? 'unknown'
                              : statusForGlucose(v.glucose_mg_dl);

                            const worst = worstStatus([hrStatus, bpStatus, spo2Status, tempStatus, glucoseStatus]);

                            // Stripe must not leak hidden values:
                            // - Discreet: always neutral
                            // - HideSensitive: worst computed without sensitive metrics already (unknown)
                            const stripe =
                              discreet
                                ? 'border-l-2 border-slate-300 bg-white'
                                : worst === 'critical'
                                ? 'border-l-2 border-red-500 bg-red-50/40'
                                : worst === 'warning'
                                ? 'border-l-2 border-amber-400 bg-amber-50/40'
                                : worst === 'normal'
                                ? 'border-l-2 border-emerald-400 bg-white'
                                : 'border-l-2 border-slate-300 bg-white';

                            const hasNotes = !!v.__annotations?.length;

                            const hrBadge = displayBadge(hrStatus, false);
                            const bpBadge = displayBadge(bpStatus, true);
                            const spo2Badge = displayBadge(spo2Status, false);
                            const tempBadge = displayBadge(tempStatus, false);
                            const glucoseBadge = displayBadge(glucoseStatus, true);

                            const timeStr = new Date(v.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                            const tempValue = (() => {
                              if (v.temp_c == null) return '—';
                              const val = unitC ? v.temp_c : (v.temp_c * 9) / 5 + 32;
                              return `${fmt2(val)}${unitC ? ' °C' : ' °F'}`;
                            })();

                            const glucoseValue = (() => {
                              if (v.glucose_mg_dl == null) return '—';
                              return glucoseMgDl
                                ? `${fmt2(v.glucose_mg_dl)} mg/dL`
                                : `${fmt2(v.glucose_mg_dl / 18)} mmol/L`;
                            })();

                            const showNotes = hasNotes && !discreet && !hideSensitive;

                            // charts link keeps the same canonical range
                            const q = new URLSearchParams(chartsRangeParams);
                            q.set('point', v.id);
                            const chartHref = `/charts?${q.toString()}`;

                            return (
                              <div
                                key={v.id}
                                className={`flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-3 py-2 text-xs ${stripe}`}
                              >
                                {/* left: time + device */}
                                <div className="flex-1 flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-800">{timeStr}</span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                      {prettyDevice(v.device)}
                                    </span>
                                    {discreet && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-900 text-white text-[10px]">
                                        Discreet
                                      </span>
                                    )}
                                    {hideSensitive && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-900 text-white text-[10px]">
                                        Sensitive hidden
                                      </span>
                                    )}
                                  </div>

                                  {showNotes && (
                                    <div className="text-[11px] text-gray-500">
                                      {v.__annotations?.slice(-2).map(a => a.text).join(' • ')}
                                    </div>
                                  )}
                                  {hasNotes && (discreet || hideSensitive) && (
                                    <div className="text-[11px] text-gray-400">Notes hidden</div>
                                  )}
                                </div>

                                {/* middle: vitals */}
                                <div className="flex-[2] grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-500">HR</span>
                                    <span className="font-medium">
                                      {displayValue({ value: v.hr != null ? `${fmt2(v.hr)} bpm` : '—' })}
                                    </span>
                                    <span className={`inline-flex px-1.5 py-0.5 rounded ${hrBadge.className}`}>
                                      {hrBadge.text}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-500">BP</span>
                                    <span className="font-medium">
                                      {displayValue({
                                        value: v.sys != null && v.dia != null ? `${fmt2(v.sys)}/${fmt2(v.dia)} mmHg` : '—',
                                        sensitive: true,
                                      })}
                                    </span>
                                    <span className={`inline-flex px-1.5 py-0.5 rounded ${bpBadge.className}`}>
                                      {bpBadge.text}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-500">SpO₂</span>
                                    <span className="font-medium">
                                      {displayValue({ value: v.spo2 != null ? `${fmt2(v.spo2)}%` : '—' })}
                                    </span>
                                    <span className={`inline-flex px-1.5 py-0.5 rounded ${spo2Badge.className}`}>
                                      {spo2Badge.text}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-500">Temp</span>
                                    <span className="font-medium">{displayValue({ value: tempValue })}</span>
                                    <span className={`inline-flex px-1.5 py-0.5 rounded ${tempBadge.className}`}>
                                      {tempBadge.text}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-500">Glucose</span>
                                    <span className="font-medium">
                                      {displayValue({ value: glucoseValue, sensitive: true })}
                                    </span>
                                    <span className={`inline-flex px-1.5 py-0.5 rounded ${glucoseBadge.className}`}>
                                      {glucoseBadge.text}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 text-gray-400">
                                    <span>{discreet ? '—' : formatDateTime(v.ts)}</span>
                                  </div>
                                </div>

                                {/* right: actions */}
                                <div className="flex flex-row md:flex-col gap-1 md:items-end">
                                  <button
                                    onClick={() => {
                                      setAnnotateTarget(v);
                                      setAnnotateText('');
                                      setAnnotateError(null);
                                    }}
                                    className="px-2 py-1 text-[11px] border rounded bg-white hover:bg-gray-50 disabled:opacity-60"
                                    type="button"
                                    disabled={discreet}
                                    title={discreet ? 'Notes disabled in Discreet mode' : 'Add a note'}
                                  >
                                    Add Note(s)
                                  </button>

                                  <Link href={chartHref} className="text-[11px] text-blue-600 underline">
                                    Chart
                                  </Link>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : (
                  // ---------- Graph dashboard ----------
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                      <div className="flex flex-wrap gap-2">
                        {(['bp', 'hr', 'spo2', 'temp', 'glucose', 'steps'] as const).map(tab => {
                          const locked = hideSensitive && isSensitiveMetric(tab === 'bp' ? 'bp' : tab === 'glucose' ? 'glucose' : tab);
                          return (
                            <button
                              key={tab}
                              onClick={() => setGraphTab(tab)}
                              className={`px-3 py-1 text-xs rounded-full ${
                                graphTab === tab ? 'bg-slate-900 text-white shadow-sm' : 'bg-gray-100 text-gray-700'
                              }`}
                              type="button"
                              title={locked ? 'Hidden by Hide sensitive' : undefined}
                            >
                              {tab === 'bp'
                                ? locked
                                  ? '🔒 Blood Pressure'
                                  : 'Blood Pressure'
                                : tab === 'hr'
                                ? 'Heart Rate'
                                : tab === 'spo2'
                                ? 'SpO₂'
                                : tab === 'temp'
                                ? 'Body Temp'
                                : tab === 'glucose'
                                ? locked
                                  ? '🔒 Glucose'
                                  : 'Glucose'
                                : 'Steps'}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                        <div className="inline-flex items-center gap-2">
                          <span className={`inline-flex px-2 py-0.5 rounded-full ${currentTabBadge.className}`}>
                            {discreet || sensitiveTabHidden ? '-' : currentTabBadge.text}
                          </span>
                          <span className="text-gray-500">Source: {discreet ? '—' : deviceSetForWindow}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border p-3 bg-white">
                      {sensitiveTabHidden ? (
                        <div className="rounded-lg border border-dashed bg-gray-50 p-4 text-sm text-gray-700">
                          <div className="font-medium mb-1">Sensitive metric hidden</div>
                          <p className="text-xs text-gray-500">
                            Turn off <span className="font-medium">Hide sensitive</span> to view this chart.
                          </p>
                        </div>
                      ) : discreet ? (
                        <div className="rounded-lg border border-dashed bg-gray-50 p-4 text-sm text-gray-700">
                          <div className="font-medium mb-1">Discreet mode</div>
                          <p className="text-xs text-gray-500">
                            Values and tooltips are masked. Turn off <span className="font-medium">Discreet</span> to view details.
                          </p>

                          <div className="mt-3">
                            {graphTab === 'bp' && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="rounded-lg border bg-white p-2">
                                  <div className="text-[11px] text-gray-500 mb-1">Systolic trend</div>
                                  <VitalSparkline
                                    values={sparklineData.bpSys}
                                    timestamps={sparklineData.bp_ts}
                                    statusFn={() => 'unknown'}
                                    tooltipDisabled
                                    valueFormatter={() => '•••'}
                                  />
                                </div>
                                <div className="rounded-lg border bg-white p-2">
                                  <div className="text-[11px] text-gray-500 mb-1">Diastolic trend</div>
                                  <VitalSparkline
                                    values={sparklineData.bpDia}
                                    timestamps={sparklineData.bp_ts}
                                    statusFn={() => 'unknown'}
                                    tooltipDisabled
                                    valueFormatter={() => '•••'}
                                  />
                                </div>
                              </div>
                            )}

                            {graphTab === 'hr' && (
                              <VitalSparkline
                                values={sparklineData.hr}
                                timestamps={sparklineData.hr_ts}
                                statusFn={statusForHr}
                                tooltipDisabled
                                valueFormatter={() => '•••'}
                              />
                            )}
                            {graphTab === 'spo2' && (
                              <VitalSparkline
                                values={sparklineData.spo2}
                                timestamps={sparklineData.spo2_ts}
                                statusFn={statusForSpo2}
                                tooltipDisabled
                                valueFormatter={() => '•••'}
                              />
                            )}
                            {graphTab === 'temp' && (
                              <VitalSparkline
                                values={sparklineData.temp}
                                timestamps={sparklineData.temp_ts}
                                statusFn={statusForTemp}
                                unit={unitC ? '°C' : '°F'}
                                tooltipDisabled
                                valueFormatter={() => '•••'}
                              />
                            )}
                            {graphTab === 'glucose' && (
                              <VitalSparkline
                                values={sparklineData.glucose}
                                timestamps={sparklineData.glucose_ts}
                                statusFn={statusForGlucose}
                                unit={glucoseMgDl ? 'mg/dL' : 'mmol/L'}
                                tooltipDisabled
                                valueFormatter={() => '•••'}
                              />
                            )}
                            {graphTab === 'steps' && (
                              <VitalSparkline
                                values={sparklineData.steps}
                                statusFn={() => 'normal'}
                                tooltipDisabled
                                valueFormatter={() => '•••'}
                              />
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          {graphTab === 'bp' && <BpChart points={sparklineData.bpPoints} />}
                          {graphTab === 'hr' && (
                            <VitalSparkline
                              values={sparklineData.hr}
                              timestamps={sparklineData.hr_ts}
                              statusFn={statusForHr}
                              tooltipDisabled={false}
                              unit="bpm"
                              valueFormatter={(v) => fmt2(v)}
                            />
                          )}
                          {graphTab === 'spo2' && (
                            <VitalSparkline
                              values={sparklineData.spo2}
                              timestamps={sparklineData.spo2_ts}
                              statusFn={statusForSpo2}
                              tooltipDisabled={false}
                              unit="%"
                              valueFormatter={(v) => fmt2(v)}
                            />
                          )}
                          {graphTab === 'temp' && (
                            <VitalSparkline
                              values={sparklineData.temp}
                              timestamps={sparklineData.temp_ts}
                              statusFn={statusForTemp}
                              unit={unitC ? '°C' : '°F'}
                              tooltipDisabled={false}
                              valueFormatter={(v) => fmt2(v)}
                            />
                          )}
                          {graphTab === 'glucose' && (
                            <VitalSparkline
                              values={sparklineData.glucose}
                              timestamps={sparklineData.glucose_ts}
                              statusFn={statusForGlucose}
                              unit={glucoseMgDl ? 'mg/dL' : 'mmol/L'}
                              tooltipDisabled={false}
                              valueFormatter={(v) => fmt2(v)}
                            />
                          )}
                          {graphTab === 'steps' && (
                            <VitalSparkline
                              values={sparklineData.steps}
                              statusFn={() => 'normal'}
                              tooltipDisabled={false}
                              valueFormatter={(v) => fmt2(v)}
                            />
                          )}

                          <div className="text-[11px] mt-2 text-gray-500">
                            {graphTab === 'bp'
                              ? 'BP (sys/dia mmHg) — recent readings (nulls skipped)'
                              : graphTab === 'hr'
                              ? 'Heart Rate (bpm) — recent readings (nulls skipped)'
                              : graphTab === 'spo2'
                              ? 'SpO₂ (%) — recent readings (nulls skipped)'
                              : graphTab === 'temp'
                              ? `Temp (${unitC ? '°C' : '°F'}) — recent readings (nulls skipped)`
                              : graphTab === 'glucose'
                              ? `Glucose (${glucoseMgDl ? 'mg/dL' : 'mmol/L'}) — recent readings (nulls skipped)`
                              : 'Steps — recent intervals'}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* subtle loading hint */}
          {isFetching && !isLoading && !error && (
            <div className="px-4 pb-3 text-[11px] text-gray-400">Updating in the background…</div>
          )}
        </div>
      </section>

      {/* ---------- ECG Card ---------- */}
      <section aria-label="ECG demo" className="mt-2">
        <div className="rounded-xl border bg-[#050816] text-slate-200 p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${ecgOn ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}
                aria-hidden
              />
              <div className="text-sm font-medium">ECG {ecgOn ? '(live demo)' : '(stopped demo)'}</div>
              {latestVital?.hr && !discreet && (
                <div className="text-[11px] text-slate-400">HR now: {fmt2(latestVital.hr)} bpm</div>
              )}
              {latestVital?.hr && discreet && (
                <div className="text-[11px] text-slate-400">HR now: •••</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEcgOn(v => !v)}
                className={`px-2 py-1 rounded text-[11px] ${ecgOn ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}
                type="button"
              >
                {ecgOn ? 'Stop' : 'Start'}
              </button>

              {/* Charts viewer keeps the same range */}
              {(() => {
                const q = new URLSearchParams(chartsRangeParams);
                q.set('view', 'ecg');
                return (
                  <Link
                    href={`/charts?${q.toString()}`}
                    className="px-2 py-1 border border-slate-600 rounded text-[11px] hover:bg-slate-800/60"
                  >
                    Open Viewer
                  </Link>
                );
              })()}
            </div>
          </div>

          <div className="mt-2 h-32 rounded-md border border-slate-700/70 bg-[#050816] overflow-hidden">
            <ECGCanvas running={ecgOn} />
          </div>

          <p className="mt-2 text-[11px] text-slate-400">
            Demo waveform. Live ECG will appear here when your Health Monitor is paired with Ambulant+.
          </p>
        </div>
      </section>

      {/* ---------- Annotation modal ---------- */}
      {annotateTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold">Add Note(s)</div>
              <button
                onClick={() => {
                  setAnnotateTarget(null);
                  setAnnotateText('');
                  setAnnotateError(null);
                }}
                className="text-xs text-gray-500"
                type="button"
              >
                Close
              </button>
            </div>

            <div className="text-xs text-gray-500 mb-1">
              {discreet ? '—' : formatDateTime(annotateTarget.ts)} · {prettyDevice(annotateTarget.device)}
            </div>

            <textarea
              className="w-full min-h-[80px] text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-500"
              placeholder={`e.g. "post-exercise", "fasting", "after medication"`}
              value={annotateText}
              onChange={e => setAnnotateText(e.target.value)}
              disabled={discreet}
            />

            {annotateError && <div className="mt-1 text-[11px] text-red-600">{annotateError}</div>}

            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setAnnotateTarget(null);
                  setAnnotateText('');
                  setAnnotateError(null);
                }}
                className="px-3 py-1 text-[11px] border rounded bg-white hover:bg-gray-50"
                type="button"
              >
                Cancel
              </button>

              <button
                onClick={handleAnnotateSave}
                disabled={annotateSaving || !annotateText.trim() || discreet}
                className="px-3 py-1 text-[11px] rounded bg-slate-900 text-white disabled:bg-slate-400"
                type="button"
                title={discreet ? 'Notes disabled in Discreet mode' : undefined}
              >
                {annotateSaving ? 'Saving…' : 'Save Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Sidebar ---------- */
function VitalsSidebar(props: { discreet: boolean }) {
  const { discreet } = props;

  return (
    <>
      <WearableInsights discreet={discreet} />

      <div className="rounded-lg border bg-white p-3">
        <div className="text-sm font-semibold mb-2">Sleep (sample)</div>

        {discreet ? (
          <div className="rounded-lg border border-dashed bg-gray-50 p-4 text-sm text-gray-700">
            <div className="font-medium mb-1">Discreet mode</div>
            <p className="text-xs text-gray-500">Sleep details are masked.</p>
          </div>
        ) : (
          <SleepCard sleep={undefined as any} />
        )}
      </div>
    </>
  );
}

/* ---------- Page ---------- */
export default function VitalsPage() {
  // ✅ lift canonical range + privacy so sidebar/exports/tooltips stay consistent
  const [range, setRange] = useState<VitalsRange>('20');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const [discreet, setDiscreet] = useState(false);
  const [hideSensitive, setHideSensitive] = useState(false);

  // load prefs
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const r = window.localStorage.getItem('vitals:range');
      const cs = window.localStorage.getItem('vitals:customStart');
      const ce = window.localStorage.getItem('vitals:customEnd');
      const d = window.localStorage.getItem('vitals:discreet');
      const hs = window.localStorage.getItem('vitals:hideSensitive');

      if (r === '20' || r === '7d' || r === '30d' || r === '90d' || r === '1y' || r === 'custom') setRange(r);
      if (typeof cs === 'string') setCustomStart(cs);
      if (typeof ce === 'string') setCustomEnd(ce);
      if (d === 'true' || d === 'false') setDiscreet(d === 'true');
      if (hs === 'true' || hs === 'false') setHideSensitive(hs === 'true');

      // if user restored custom without dates, seed it
      if (r === 'custom' && !cs && !ce) {
        const end = todayDateStr();
        const start = isoDate(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));
        setCustomStart(start);
        setCustomEnd(end);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // persist prefs
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem('vitals:range', range); } catch {}
  }, [range]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem('vitals:customStart', customStart); } catch {}
  }, [customStart]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem('vitals:customEnd', customEnd); } catch {}
  }, [customEnd]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem('vitals:discreet', String(discreet)); } catch {}
  }, [discreet]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem('vitals:hideSensitive', String(hideSensitive)); } catch {}
  }, [hideSensitive]);

  const chartsHref = useMemo(() => {
    const q = vitalsRangeQuery(range, customStart, customEnd);
    return `/charts?${q.toString()}`;
  }, [range, customStart, customEnd]);

  return (
    <QueryClientProvider client={queryClient}>
      <main className="max-w-6xl mx-auto p-6 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Vitals</h1>
            <p className="text-sm text-gray-500">
              Realtime & historical measurements from connected devices (Health Monitor, NexRing)
            </p>
          </div>

          {/* ✅ link preserves the same canonical range so users don’t feel like they’re switching systems */}
          <Link href={chartsHref} className="px-3 py-2 border rounded bg-white text-sm">
            Live Charts
          </Link>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <VitalsList
              range={range}
              setRange={setRange}
              customStart={customStart}
              setCustomStart={setCustomStart}
              customEnd={customEnd}
              setCustomEnd={setCustomEnd}
              discreet={discreet}
              setDiscreet={setDiscreet}
              hideSensitive={hideSensitive}
              setHideSensitive={setHideSensitive}
            />
          </div>

          <aside className="space-y-4">
            <VitalsSidebar discreet={discreet} />
          </aside>
        </div>
      </main>
    </QueryClientProvider>
  );
}
