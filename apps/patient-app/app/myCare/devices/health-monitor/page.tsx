//apps/patient-app/app/myCare/devices/health-monitor/page.tsx
'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  Suspense,
} from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Activity,
  Bell,
  Download,
  Share2,
  TriangleAlert,
  CheckCircle2,
  X,
  Clock,
  MoreHorizontal,
  LineChart,
  Bluetooth,
  Usb,
  HelpCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import BatteryIcon from '@/components/iomt/BatteryIcon';
import { createHealthMonitorSession } from '@/src/devices/healthMonitorSession';
import type {
  HealthMonitorMode,
  HealthMonitorSessionState,
} from '@/src/devices/healthMonitorSession';
import {
  VitalsProvider,
  useVitalsProvider,
  useVitals as useVitalsContext,
} from './useVitals';

const APP_LOCALE = 'en-GB' as const;

/** Lazy vitals (preserve TTI) */
const Glucose = dynamic(() => import('@/components/iomt/vitals/Glucose'), { ssr: false });
const BloodPressure = dynamic(() => import('@/components/iomt/vitals/BloodPressure'), { ssr: false });
const Temperature = dynamic(() => import('@/components/iomt/vitals/Temperature'), { ssr: false });
const BloodOxygen = dynamic(() => import('@/components/iomt/vitals/BloodOxygen'), { ssr: false });
const HeartRate = dynamic(() => import('@/components/iomt/vitals/HeartRate'), { ssr: false });
const ECG = dynamic(() => import('@/components/iomt/vitals/ECG'), { ssr: false });

type VitalsSummary = {
  lastSyncHuman?: string;

  hrNow?: number;
  spo2Now?: number;
  bpNow?: { s: number; d: number } | null;
  tempNow?: number;
  gluNow?: number | null;
  gluUnit?: 'mg/dL' | 'mmol/L' | null;

  hrTs?: string | null;
  spo2Ts?: string | null;
  bpTs?: string | null;
  tempTs?: string | null;
  gluTs?: string | null;

  hr24?: number[];
  spo224?: number[];
  bp24?: number[];
  temp24?: number[];
  glu24?: number[];
};

type TodayItem = { t: string; label: string; route: string };
type AlertItem = { id: string; vital: string; value: string; level: 'amber' | 'red'; when: string };


const EMPTY_SUMMARY: VitalsSummary = {
  lastSyncHuman: undefined,
  hrNow: undefined,
  spo2Now: undefined,
  bpNow: null,
  tempNow: undefined,
  gluNow: null,
  gluUnit: null,
  hrTs: null,
  spo2Ts: null,
  bpTs: null,
  tempTs: null,
  gluTs: null,
  hr24: [],
  spo224: [],
  bp24: [],
  temp24: [],
  glu24: [],
};

const EMPTY_TODAY: TodayItem[] = [];
const EMPTY_ALERTS: AlertItem[] = [];

async function getJSON<T>(
  url: string,
  {
    timeoutMs = 5000,
    fallback,
  }: { timeoutMs?: number; fallback: T }
): Promise<T> {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ac.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as T;
    return data ?? fallback;
  } catch {
    return fallback;
  } finally {
    clearTimeout(to);
  }
}

function cn(...a: Array<string | false | undefined>) {
  return a.filter(Boolean).join(' ');
}
function fmtTime(ts?: string | null) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleTimeString(APP_LOCALE);
  } catch {
    return '—';
  }
}

function initialsFromName(value: unknown) {
  const name = String(value || '').trim();
  if (!name) return 'PT';

  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0]?.[0] || ''}${parts[1]?.[0] || ''}`.toUpperCase() || 'PT';
}

function ToolbarButton({
  children,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="inline-flex items-center justify-center rounded-2xl border border-white/60 bg-white/85 px-3 py-2 text-slate-700 shadow-sm shadow-slate-200/70 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md active:translate-y-0"
    >
      {children}
    </button>
  );
}
function SegmentedTabs({
  tab,
  setTab,
}: {
  tab: 'overview' | 'vitals' | 'analytics' | 'reports';
  setTab: (t: any) => void;
}) {
  return (
    <nav className="inline-flex items-center gap-1 rounded-2xl border border-white/60 bg-white/75 p-1 shadow-sm shadow-slate-200/70 backdrop-blur" aria-label="Sections">
      {(['overview', 'vitals', 'analytics', 'reports'] as const).map((key) => (
        <button
          key={key}
          onClick={() => setTab(key)}
          className={cn(
            'rounded-xl px-3 py-1.5 text-sm font-medium transition',
            tab === key
              ? 'bg-slate-900 text-white shadow-sm shadow-slate-900/20'
              : 'text-slate-600 hover:bg-white hover:text-slate-900'
          )}
          aria-current={tab === key ? 'page' : undefined}
        >
          {key[0].toUpperCase() + key.slice(1)}
        </button>
      ))}
    </nav>
  );
}
function LiveBadge() {
  return (
    <span className="relative inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-emerald-50 text-emerald-700 border">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
      </span>
      Live
    </span>
  );
}

type DeviceInfo = {
  id: string;
  name: string;
  transport: 'ble' | 'wifi' | 'usb';
  connected: boolean;
  batteryPct?: number | null;
  rssi?: number | null;
};
function DevicePill({ d }: { d: DeviceInfo }) {
  const Dot = () => (
    <span className={cn('h-2 w-2 rounded-full', d.connected ? 'bg-emerald-500' : 'bg-slate-300')} />
  );
  const Icon = d.transport === 'ble' ? Bluetooth : d.transport === 'usb' ? Usb : Activity;
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-3 py-1.5 shadow-sm shadow-slate-200/70 backdrop-blur">
      <Dot />
      <Icon className="w-3.5 h-3.5" aria-hidden />
      <span className="text-xs max-w-[8rem] truncate" title={d.name}>
        {d.name}
      </span>
      {typeof d.batteryPct === 'number' ? <BatteryIcon level={d.batteryPct ?? 0} /> : null}
      {typeof d.rssi === 'number' ? (
        <span className="text-[10px] text-slate-600 tabular-nums">{d.rssi} dBm</span>
      ) : null}
    </div>
  );
}

function StickyHeader({
  profile,
  patientId,
  lastSyncHuman,
  onExport,
  onShare,
  onOpenAlerts,
  tab,
  setTab,
  devices = [],
}: {
  profile?: any;
  patientId: string;
  lastSyncHuman?: string;
  onExport: () => void;
  onShare: () => void;
  onOpenAlerts: () => void;
  tab: 'overview' | 'vitals' | 'analytics' | 'reports';
  setTab: (t: any) => void;
  devices?: DeviceInfo[];
}) {
  const primaryConditions: string =
    Array.isArray(profile?.chronicConditions) && profile.chronicConditions.length
      ? profile.chronicConditions.slice(0, 3).join(', ')
      : profile?.primaryConditionsText ?? 'None recorded';
  return (
    <motion.header
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-40 border-b border-white/60 bg-[linear-gradient(180deg,rgba(248,250,252,0.94),rgba(255,255,255,0.82))] backdrop-blur-xl supports-[backdrop-filter]:bg-white/55"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-2 px-3 py-2">
        <div className="flex min-w-0 items-center gap-3 rounded-3xl border border-white/60 bg-white/70 px-3 py-2 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)] backdrop-blur-xl">
          <div className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-white bg-gradient-to-br from-slate-900 via-indigo-700 to-cyan-600 text-sm font-semibold text-white shadow md:h-10 md:w-10">
            {typeof profile?.avatarUrl === 'string' && profile.avatarUrl.trim() ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt={`${profile?.name ?? 'Patient'} avatar`}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{initialsFromName(profile?.name)}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm md:text-base font-semibold truncate">
                {profile?.name ?? 'Patient'}
              </span>
              <span className="text-xs md:text-sm text-gray-600">
                {profile?.age ? `${profile.age} yrs` : ''}
                {profile?.gender ? ` • ${profile.gender}` : ''}
              </span>
              <LiveBadge />
            </div>
            <div className="text-xxs md:text-xs text-gray-600 truncate">
              <span className="font-medium">Primary conditions:</span> {primaryConditions}
            </div>
            <div className="text-xxs md:text-xs text-gray-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" aria-hidden />
              <span>Last sync: {lastSyncHuman ?? 'Not yet synced'}</span>
              <span className="mx-1">•</span>
              <span>ID {profile?.patientId ?? patientId}</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 mx-3 overflow-x-auto">
            {devices.map((d) => (
              <DevicePill key={d.id} d={d} />
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <SegmentedTabs tab={tab} setTab={setTab} />
            <ToolbarButton ariaLabel="Open alerts" onClick={onOpenAlerts}>
              <Bell className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton ariaLabel="Export" onClick={onExport}>
              <Download className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton ariaLabel="Share" onClick={onShare}>
              <Share2 className="w-4 h-4" />
            </ToolbarButton>
          </div>
        </div>
      </div>
    </motion.header>
  );
}

function KPIStat({
  label,
  value,
  hint,
  series = [],
  tone = 'slate',
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  series?: number[];
  tone?: 'slate' | 'green' | 'amber' | 'red';
}) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-50',
    green: 'bg-green-50',
    amber: 'bg-amber-50',
    red: 'bg-red-50',
  };
  return (
    <div className={cn('group relative overflow-hidden rounded-3xl border border-white/70 p-4 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_-32px_rgba(15,23,42,0.5)]', tones[tone])} role="group" aria-label={`${label} summary`}>
      <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500/90">{label}</div>
      <div className="flex items-end justify-between gap-2">
        <div className="text-lg font-semibold tracking-tight text-slate-900 md:text-[1.35rem]">{value}</div>
        <Sparkline points={series} />
      </div>
      {hint ? <div className="mt-1 text-[11px] text-slate-500">{hint}</div> : null}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />
    </div>
  );
}
function Sparkline({ points = [] as number[] }) {
  if (!points.length) return <div className="h-6" />;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const norm = points.map((p) => ((p - min) / (max - min || 1)) * 18 + 3);
  const step = 80 / (points.length - 1 || 1);
  const d = norm.map((y, i) => `${i ? 'L' : 'M'} ${i * step},${22 - y}`).join(' ');
  return (
    <svg width="80" height="22" aria-hidden focusable="false">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" opacity=".6" />
    </svg>
  );
}

function SectionCard({
  title,
  subtitle,
  status,
  menu,
  children,
}: {
  title: string;
  subtitle?: string;
  status?: React.ReactNode;
  menu?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="relative overflow-hidden rounded-[30px] border border-white/70 bg-white/88 p-4 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl md:p-5"
      aria-labelledby={`${title}-h`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm md:text-base font-semibold tracking-tight" id={`${title}-h`}>
            {title}
          </h3>
          {subtitle ? <p className="text-xs md:text-sm text-gray-500 mt-0.5">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-1">
          {status}
          {menu ? (
            menu
          ) : (
            <button className="px-2 py-1 rounded border text-xs" aria-haspopup="menu" aria-expanded="false">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />
      <div className="mt-4">{children}</div>
    </motion.section>
  );
}
function SkeletonRow() {
  return <div className="h-12 animate-pulse rounded-2xl bg-slate-100/90" />;
}

function useToasts() {
  const [stack, setStack] = useState<{ id: string | number; title: string; tone?: 'default' | 'success' | 'error' }[]>(
    []
  );
  const push = useCallback((title: string, tone: 'default' | 'success' | 'error' = 'default') => {
    const id =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : Date.now();
    setStack((s) => [...s, { id, title, tone }]);
    setTimeout(() => setStack((s) => s.filter((t) => t.id !== id)), 3200);
  }, []);
  const Toasts = () => (
    <div className="fixed bottom-4 right-4 z-[60] space-y-2">
      {stack.map((t) => (
        <div
          key={t.id}
          className={cn(
            'px-3 py-2 rounded-xl border shadow bg-white flex items-center gap-2',
            t.tone === 'success' && 'border-emerald-300',
            t.tone === 'error' && 'border-red-300'
          )}
        >
          {t.tone === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : null}
          {t.tone === 'error' ? <TriangleAlert className="w-4 h-4 text-red-600" /> : null}
          <span className="text-sm">{t.title}</span>
        </div>
      ))}
    </div>
  );
  return { push, Toasts };
}

function AlertDrawer({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: Array<AlertItem>;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.aside
        initial={{ x: 320, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="absolute right-0 top-0 h-full w-[360px] bg-white shadow-xl border-l p-4"
      >
        <div className="flex items-center justify-between">
          <div className="font-semibold">Alerts</div>
          <button onClick={onClose} className="p-1 rounded border" aria-label="Close alerts">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {items.length === 0 ? <div className="text-sm text-gray-500">No active alerts.</div> : null}

          {items.map((a) => (
            <div key={a.id} className="rounded-xl border p-3 flex items-start gap-2">
              <div
                className={cn(
                  'h-2.5 w-2.5 rounded-full mt-1.5',
                  a.level === 'red' ? 'bg-red-500' : 'bg-amber-500'
                )}
              />
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {a.vital} — {a.value}
                </div>
                <div className="text-xs text-gray-500">{a.when}</div>
                <div className="mt-2 flex items-center gap-2">
                  <button className="px-2 py-1 rounded border text-xs">Acknowledge</button>
                  <button className="px-2 py-1 rounded border text-xs">Escalate</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.aside>
    </div>
  );
}

function ReportHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.aside
        initial={{ x: 320 }}
        animate={{ x: 0 }}
        className="absolute right-0 top-0 h-full w-[360px] bg-white shadow-xl border-l p-4 overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <div className="font-semibold">Report help</div>
          <button onClick={onClose} className="p-1 rounded border" aria-label="Close help">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-3 space-y-3 text-sm text-slate-700">
          <p>
            Reports include selected sections (e.g., Glucose, BP, SpO₂, Temp, HR, ECG), branding style, and
            optional clinician sign-off.
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li>
              <b>Clinical</b> brand is optimized for EMR upload and audit readability.
            </li>
            <li>Per-vital exports (from each card) contain notes, flags and session details.</li>
            <li>Global reports aggregate across modules for a given date range.</li>
          </ul>
          <p className="text-xs text-slate-500">
            PHI: PDFs are generated server-side. Avoid sharing links publicly; use secure channels.
          </p>
        </div>
      </motion.aside>
    </div>
  );
}

function ExportComposer({
  patient,
  vitalsSummary,
  onAfterDownload,
}: {
  patient: any;
  vitalsSummary: any;
  onAfterDownload?: () => void;
}) {
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [includeSections, setIncludeSections] = useState<Record<string, boolean>>({
    demographics: true,
    glucose: true,
    bp: true,
    spo2: true,
    temp: true,
    ecg: true,
    hr: true,
  });
  const [brand, setBrand] = useState<'light' | 'clean' | 'clinical'>('clinical');
  const [signOff, setSignOff] = useState<boolean>(true);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [helpOpen, setHelpOpen] = useState(false);

  function preset(days: number) {
    const d = new Date();
    const to = d.toISOString().slice(0, 10);
    d.setDate(d.getDate() - days);
    setFromDate(d.toISOString().slice(0, 10));
    setToDate(to);
  }
  function toggle(key: string) {
    setIncludeSections((s) => ({ ...s, [key]: !s[key] }));
  }

  async function downloadServerPdf() {
    try {
      setDownloading(true);
      const res = await fetch('/api/reports/patient', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fromDate,
          toDate,
          sections: includeSections,
          signOff,
          clinicianName: '',
          clinicianSignatureDataUrl: '',
          patientId: patient?.patientId || undefined,
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || 'Failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ambulant-patient-report.pdf';
      a.click();
      URL.revokeObjectURL(url);
      onAfterDownload?.();
    } catch {
      alert('PDF export failed');
    } finally {
      setDownloading(false);
    }
  }

  function renderAndPrint() {
    window.print?.();
  }

  return (
    <SectionCard
      title="Report composer"
      subtitle="Build an audit-ready report for a date range."
      status={
        <button
          className="text-xs px-2 py-1 rounded-lg border inline-flex items-center gap-1 bg-white"
          onClick={() => setHelpOpen(true)}
          data-report-help-button
        >
          <HelpCircle className="w-3.5 h-3.5" />
          Help
        </button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 rounded border">
          <div className="text-sm font-medium mb-2">Date range</div>
          <div className="flex items-center gap-2 mb-2">
            <button className="px-2 py-1 rounded border text-xs" onClick={() => preset(7)}>
              Last 7 days
            </button>
            <button className="px-2 py-1 rounded border text-xs" onClick={() => preset(30)}>
              Last 30 days
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="p-1 border rounded text-sm w-full"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <span className="text-xs text-gray-500">→</span>
            <input
              type="date"
              className="p-1 border rounded text-sm w-full"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>
        <div className="p-3 rounded border">
          <div className="text-sm font-medium mb-2">Brand & sign-off</div>
          <select
            className="p-1 border rounded text-sm w-full"
            value={brand}
            onChange={(e) => setBrand(e.target.value as any)}
          >
            <option value="clinical">Clinical (default)</option>
            <option value="clean">Clean</option>
            <option value="light">Light</option>
          </select>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={signOff} onChange={(e) => setSignOff(e.target.checked)} />
            Include clinician sign-off block
          </label>
        </div>
        <div className="p-3 rounded border md:col-span-1">
          <div className="text-sm font-medium mb-2">Sections</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.keys(includeSections).map((k) => (
              <label key={k} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeSections[k as keyof typeof includeSections]}
                  onChange={() => toggle(k)}
                />
                <span className="capitalize">{k.replace('spo2', 'SpO₂')}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button className="px-3 py-2 rounded border" onClick={renderAndPrint}>
          Print (browser)
        </button>
        <button
          className="px-3 py-2 rounded bg-slate-900 text-white disabled:opacity-60"
          disabled={downloading}
          onClick={downloadServerPdf}
        >
          {downloading ? 'Preparing...' : 'Download PDF (server)'}
        </button>
      </div>
      <ReportHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </SectionCard>
  );
}

function SavedExports({ patientId }: { patientId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const r = await fetch(
          `/api/reports/patient?patientId=${encodeURIComponent(patientId)}&limit=20`,
          { cache: 'no-store' }
        );
        const j = await r.json().catch(() => ({ items: [] }));
        if (!mounted) return;
        setRows(j.items || []);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [patientId]);

  return (
    <SectionCard title="Saved exports" subtitle="Previously generated PDFs">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-3">Created</th>
              <th className="py-2 pr-3">Range</th>
              <th className="py-2 pr-3">Brand</th>
              <th className="py-2 pr-3">Sections</th>
              <th className="py-2 pr-3">Size</th>
              <th className="py-2 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-slate-500">
                  No exports yet
                </td>
              </tr>
            )}
            {rows.map((r: any) => (
              <tr key={r.id} className="border-b">
                <td className="py-2 pr-3">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="py-2 pr-3">
                  {r.fromDate?.slice(0, 10)} → {r.toDate?.slice(0, 10)}
                </td>
                <td className="py-2 pr-3">{r.brand}</td>
                <td className="py-2 pr-3">
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(r.sections || {})
                      .filter(([, v]) => v)
                      .map(([k]) => (
                        <span key={k} className="px-2 py-0.5 rounded-full border text-xs">
                          {String(k).replace('spo2', 'SpO₂')}
                        </span>
                      ))}
                  </div>
                </td>
                <td className="py-2 pr-3">{r.fileBytes ? `${Math.round(r.fileBytes / 1024)} KB` : '—'}</td>
                <td className="py-2 pr-3">
                  <div className="flex gap-2">
                    {r.fileUrl && (
                      <a className="px-2 py-1 rounded border" href={r.fileUrl} target="_blank" rel="noreferrer">
                        Download
                      </a>
                    )}
                    <form method="post" action={`/api/reports/patient/${r.id}/recreate`}>
                      <button className="px-2 py-1 rounded border bg-white" type="submit">
                        Recreate
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

type RangeOpt = 7 | 14 | 30 | 90;

type BPRec = { id: string; timestamp: string; systolic: number; diastolic: number; pulse?: number };
type SpO2Rec = { id: string; timestamp: string; spo2: number; pulse?: number };
type TempRec = { id: string; timestamp: string; celsius: number };
type HRRec = { id: string; timestamp: string; hr: number };
type GluRec = { id: string; timestamp: string; glucose: number; unit?: 'mg/dL' | 'mmol/L'; fasting?: boolean | null };
type ECGSess = { id: string; start: string; end?: string | null; durationSec?: number | null; summary?: string | null };

const API = {
  bp: (pid: string, f: string, t: string) => `/api/v1/patients/${encodeURIComponent(pid)}/vitals/bp?from=${f}&to=${t}`,
  spo2: (pid: string, f: string, t: string) => `/api/v1/patients/${encodeURIComponent(pid)}/vitals/spo2?from=${f}&to=${t}`,
  temp: (pid: string, f: string, t: string) => `/api/v1/patients/${encodeURIComponent(pid)}/vitals/temp?from=${f}&to=${t}`,
  hr: (pid: string, f: string, t: string) => `/api/v1/patients/${encodeURIComponent(pid)}/vitals/hr?from=${f}&to=${t}`,
  glu: (pid: string, f: string, t: string) => `/api/v1/patients/${encodeURIComponent(pid)}/vitals/glucose?from=${f}&to=${t}`,
  ecg: (pid: string, f: string, t: string) => `/api/v1/patients/${encodeURIComponent(pid)}/vitals/ecg/sessions?from=${f}&to=${t}`,
};

async function fetchListSafe<T>(url: string, fallback: T[], timeoutMs = 6000): Promise<T[]> {
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { cache: 'no-store', signal: ac.signal });
    if (!r.ok) return fallback;
    const j = await r.json().catch(() => null);
    if (!j) return fallback;
    return (j.items ?? j) ?? fallback;
  } catch {
    return fallback;
  } finally {
    clearTimeout(id);
  }
}

function toISO(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
function addDays(base: Date, d: number) {
  const x = new Date(base);
  x.setDate(x.getDate() + d);
  return x;
}
function slopePerDay(points: Array<{ t: string; v: number }>) {
  if (!points.length) return 0;
  const xs = points.map((p) => new Date(p.t).getTime());
  const ys = points.map((p) => p.v);
  const n = xs.length;
  const xm = xs.reduce((a, b) => a + b, 0) / n;
  const ym = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xm) * (ys[i] - ym);
    den += (xs[i] - xm) * (xs[i] - xm);
  }
  const s = den === 0 ? 0 : num / den;
  return s * 1000 * 60 * 60 * 24;
}
function groupCountByDay(timestamps: string[]) {
  const map = new Map<string, number>();
  for (const ts of timestamps) {
    const d = new Date(ts);
    const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
}
function secondsBetween(a: string, b?: string | null) {
  const t1 = new Date(a).getTime();
  const t2 = b ? new Date(b).getTime() : Date.now();
  return Math.max(0, Math.round((t2 - t1) / 1000));
}

function Badge({ children, tone = 'slate' as 'slate' | 'green' | 'amber' | 'red' }) {
  const map: any = {
    slate: 'bg-slate-50 text-slate-700 border',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-300 border',
    amber: 'bg-amber-50 text-amber-700 border-amber-300 border',
    red: 'bg-red-50 text-red-700 border-red-300 border',
  };
  return <span className={cn('text-xs px-2 py-1 rounded-lg', map[tone])}>{children}</span>;
}

function Collapsible({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded border bg-white">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>{title}</span>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {open && <div className="px-3 py-2 text-xs text-slate-700 border-t">{children}</div>}
    </div>
  );
}

function LineMini({ labels, values }: { labels: string[]; values: number[] }) {
  if (!values.length) return <div className="h-24" />;
  const w = 320;
  const h = 90;
  const pad = 8;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const scaleY = (v: number) => h - pad - ((v - min) / (max - min || 1)) * (h - 2 * pad);
  const step = (w - 2 * pad) / Math.max(1, values.length - 1);
  const d = values.map((v, i) => `${i ? 'L' : 'M'} ${pad + i * step},${scaleY(v)}`).join(' ');
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Line chart">
      <path d={d} fill="none" stroke="#334155" strokeWidth="2" />
    </svg>
  );
}
function BarsMini({ labels, values }: { labels: string[]; values: number[] }) {
  const w = 320;
  const h = 90;
  const pad = 8;
  const max = Math.max(1, ...values);
  const bw = values.length ? (w - 2 * pad) / values.length - 6 : 0;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Bar chart">
      {values.map((v, i) => {
        const bh = (v / max) * (h - 2 * pad);
        const x = pad + i * ((w - 2 * pad) / values.length) + 3;
        const y = h - pad - bh;
        return <rect key={i} x={x} y={y} width={bw} height={bh} rx="3" ry="3" fill="#64748b" />;
      })}
    </svg>
  );
}
function HeatGrid({ matrix }: { matrix: (number | null)[][] }) {
  const day = (i: number) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((d) => (
          <div key={d} className="text-xxs">
            <div className="mb-1 font-medium">{day(d)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 4 }}>
              {matrix[d]?.map((v, bi) => (
                <div
                  key={bi}
                  title={v == null ? 'No data' : String(v)}
                  className="text-white text-xxs rounded p-1 text-center"
                  style={{ background: v == null ? '#e5e7eb' : '#64748b' }}
                >
                  {v == null ? '—' : v}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[4, 5, 6].map((d) => (
          <div key={d} className="text-xxs">
            <div className="mb-1 font-medium">{day(d)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 4 }}>
              {matrix[d]?.map((v, bi) => (
                <div
                  key={bi}
                  title={v == null ? 'No data' : String(v)}
                  className="text-white text-xxs rounded p-1 text-center"
                  style={{ background: v == null ? '#e5e7eb' : '#64748b' }}
                >
                  {v == null ? '—' : v}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function heatmapAvg(rows: Array<{ t: string; v: number }>) {
  const buckets = Array.from({ length: 7 }, () => Array.from({ length: 6 }, () => [] as number[]));
  for (const r of rows) {
    const d = new Date(r.t);
    const dow = d.getDay();
    const block = Math.floor(d.getHours() / 4);
    buckets[dow][block].push(r.v);
  }
  return buckets.map((row) =>
    row.map((col) => (col.length ? +(col.reduce((a, b) => a + b, 0) / col.length).toFixed(1) : null))
  );
}

function mmolToMgdl(v: number) {
  return v * 18.0;
}

const BPZ = {
  normal: (s: number, d: number) => s < 120 && d < 80,
  elevated: (s: number, d: number) => s >= 120 && s <= 129 && d < 80,
  stage1: (s: number, d: number) => (s >= 130 && s <= 139) || (d >= 80 && d <= 89),
  stage2: (s: number, d: number) => s >= 140 || d >= 90,
};
const SPO2 = { green: 95, amber: 90 };
const TEMP = { low: 35.0, high: 38.0 };
const HRTH = { brady: 60, tachy: 100 };
const GLU = {
  hypo: 70,
  targetMin: 80,
  targetMax: 180,
  hyper: 250,
};

function BPAnalytics({ items }: { items: BPRec[] }) {
  const ptsS = items.map((r) => ({ t: r.timestamp, v: r.systolic }));
  const ptsD = items.map((r) => ({ t: r.timestamp, v: r.diastolic }));
  const sS = slopePerDay(ptsS).toFixed(2);
  const sD = slopePerDay(ptsD).toFixed(2);
  const counts = useMemo(() => {
    let normal = 0;
    let elev = 0;
    let s1 = 0;
    let s2 = 0;
    for (const r of items) {
      if (BPZ.stage2(r.systolic, r.diastolic)) s2++;
      else if (BPZ.stage1(r.systolic, r.diastolic)) s1++;
      else if (BPZ.elevated(r.systolic, r.diastolic)) elev++;
      else if (BPZ.normal(r.systolic, r.diastolic)) normal++;
    }
    return { normal, elev, s1, s2, total: items.length };
  }, [items]);
  const heat = useMemo(() => heatmapAvg(ptsS), [items]);

  return (
    <SectionCard title="Blood Pressure — Analytics" subtitle="Zones, trend, and time-of-day">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 border rounded bg-white md:col-span-2">
          <div className="text-sm font-medium mb-1">Trend (Systolic/Diastolic)</div>
          <LineMini labels={items.map((r) => r.timestamp)} values={items.map((r) => r.systolic)} />
          <LineMini labels={items.map((r) => r.timestamp)} values={items.map((r) => r.diastolic)} />
          <div className="text-xs text-slate-600 mt-1">Slope/day — Systolic {sS} • Diastolic {sD}</div>
        </div>
        <div className="p-3 border rounded bg-white">
          <div className="text-sm font-medium mb-1">Out-of-range breakdown</div>
          <BarsMini labels={['Normal', 'Elevated', 'Stage1', 'Stage2']} values={[counts.normal, counts.elev, counts.s1, counts.s2]} />
          <div className="text-xs text-slate-600 mt-1">Total {counts.total} readings</div>
        </div>
      </div>

      <div className="mt-3 p-3 border rounded bg-white">
        <div className="text-sm font-medium mb-1">Daily heatmap (avg Systolic)</div>
        <div className="text-xxs text-slate-500 mb-2">Each cell ~ 4h block</div>
        <HeatGrid matrix={heat} />
      </div>

      <div className="mt-3">
        <Collapsible title="Targets & notes" defaultOpen={false}>
          Zones: Normal &lt;120/&lt;80 • Elevated 120–129/&lt;80 • Stage1 130–139 or 80–89 • Stage2 &gt;=140 or &gt;=90.
        </Collapsible>
      </div>
    </SectionCard>
  );
}

function SpO2Analytics({ items }: { items: SpO2Rec[] }) {
  const pts = items.map((r) => ({ t: r.timestamp, v: r.spo2 }));
  const slope = slopePerDay(pts).toFixed(2);
  const dist = useMemo(() => {
    let green = 0;
    let amber = 0;
    let red = 0;
    for (const r of items) {
      if (r.spo2 >= SPO2.green) green++;
      else if (r.spo2 >= SPO2.amber) amber++;
      else red++;
    }
    const total = items.length || 1;
    return { green, amber, red, total, inRangePct: Math.round((green / total) * 100), t90: Math.round((red / total) * 100) };
  }, [items]);
  const heat = useMemo(() => heatmapAvg(pts), [items]);

  return (
    <SectionCard title="SpO₂ — Analytics" subtitle="Distribution, trend, time-of-day">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 border rounded bg-white md:col-span-2">
          <div className="text-sm font-medium mb-1">Trend</div>
          <LineMini labels={items.map((r) => r.timestamp)} values={items.map((r) => r.spo2)} />
          <div className="text-xs text-slate-600 mt-1">Slope/day: {slope} %</div>
        </div>
        <div className="p-3 border rounded bg-white">
          <div className="text-sm font-medium mb-1">Distribution</div>
          <BarsMini labels={['>=95', '90–94', '<90']} values={[dist.green, dist.amber, dist.red]} />
          <div className="text-xs text-slate-600 mt-1">
            In-range &gt;=95%: {dist.inRangePct}% • T90 (&lt;90%) {dist.t90}%
          </div>
        </div>
      </div>

      <div className="mt-3 p-3 border rounded bg-white">
        <div className="text-sm font-medium mb-1">Daily heatmap (avg %)</div>
        <div className="text-xxs text-slate-500 mb-2">Each cell ~ 4h block</div>
        <HeatGrid matrix={heat} />
      </div>

      <div className="mt-3">
        <Collapsible title="Targets & notes" defaultOpen={false}>
          Targets: Green &gt;={SPO2.green}% • Amber {SPO2.amber}–{SPO2.green - 1}% • Red &lt;{SPO2.amber}%.
        </Collapsible>
      </div>
    </SectionCard>
  );
}

function TempAnalytics({ items }: { items: TempRec[] }) {
  const pts = items.map((r) => ({ t: r.timestamp, v: r.celsius }));
  const slope = slopePerDay(pts).toFixed(2);
  const dist = useMemo(() => {
    let low = 0;
    let normal = 0;
    let high = 0;
    for (const r of items) {
      if (r.celsius < TEMP.low) low++;
      else if (r.celsius >= TEMP.high) high++;
      else normal++;
    }
    const total = items.length || 1;
    return { low, normal, high, total, inRangePct: Math.round((normal / total) * 100) };
  }, [items]);

  return (
    <SectionCard title="Temperature — Analytics" subtitle="Trend & thresholds">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 border rounded bg-white md:col-span-2">
          <LineMini labels={items.map((r) => r.timestamp)} values={items.map((r) => r.celsius)} />
          <div className="text-xs text-slate-600 mt-1">Slope/day: {slope} °C</div>
        </div>
        <div className="p-3 border rounded bg-white">
          <div className="text-sm font-medium mb-1">In-range</div>
          <BarsMini labels={['Low', 'Normal', 'High']} values={[dist.low, dist.normal, dist.high]} />
          <div className="text-xs text-slate-600 mt-1">In-range {dist.inRangePct}%</div>
        </div>
      </div>
      <div className="mt-3">
        <Collapsible title="Targets & notes" defaultOpen={false}>
          Defaults: Low &lt; {TEMP.low}°C • High &gt;= {TEMP.high}°C.
        </Collapsible>
      </div>
    </SectionCard>
  );
}

function HRAnalytics({ items }: { items: HRRec[] }) {
  const pts = items.map((r) => ({ t: r.timestamp, v: r.hr }));
  const slope = slopePerDay(pts).toFixed(2);
  const dist = useMemo(() => {
    let brady = 0;
    let normal = 0;
    let tachy = 0;
    for (const r of items) {
      if (r.hr < HRTH.brady) brady++;
      else if (r.hr >= HRTH.tachy) tachy++;
      else normal++;
    }
    return { brady, normal, tachy, total: items.length };
  }, [items]);

  return (
    <SectionCard title="Heart Rate — Analytics" subtitle="Trend & brady/tachy breakdown">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 border rounded bg-white md:col-span-2">
          <LineMini labels={items.map((r) => r.timestamp)} values={items.map((r) => r.hr)} />
          <div className="text-xs text-slate-600 mt-1">Slope/day: {slope} bpm</div>
        </div>
        <div className="p-3 border rounded bg-white">
          <BarsMini labels={['Brady', 'Normal', 'Tachy']} values={[dist.brady, dist.normal, dist.tachy]} />
          <div className="text-xs text-slate-600 mt-1">Total {dist.total}</div>
        </div>
      </div>
      <div className="mt-3">
        <Collapsible title="Targets & notes" defaultOpen={false}>
          Defaults: Brady &lt; {HRTH.brady} bpm • Tachy &gt;= {HRTH.tachy} bpm.
        </Collapsible>
      </div>
    </SectionCard>
  );
}

function GlucoseAnalytics({ items }: { items: GluRec[] }) {
  const ptsMg = items.map((r) => {
    const v = r.unit === 'mmol/L' ? mmolToMgdl(r.glucose) : r.glucose;
    return { t: r.timestamp, v };
  });
  const slope = slopePerDay(ptsMg).toFixed(2);
  const vals = ptsMg.map((p) => p.v);
  const min = vals.length ? Math.min(...vals) : 0;
  const max = vals.length ? Math.max(...vals) : 0;
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;

  const dist = useMemo(() => {
    let hypo = 0;
    let target = 0;
    let hyper = 0;
    let veryHigh = 0;
    for (const p of ptsMg) {
      if (p.v < GLU.hypo) hypo++;
      else if (p.v < GLU.targetMin) target++;
      else if (p.v <= GLU.targetMax) target++;
      else if (p.v <= GLU.hyper) hyper++;
      else veryHigh++;
    }
    return { hypo, target, hyper, veryHigh, total: ptsMg.length };
  }, [items]);

  const byDay = groupCountByDay(items.map((i) => i.timestamp));
  const labels = byDay.map(([d]) => d);
  const values = byDay.map(([, c]) => c);

  return (
    <SectionCard title="Glucose — Analytics" subtitle="Trend, stats, and episodes per day">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 border rounded bg-white md:col-span-2">
          <div className="text-sm font-medium mb-1">Trend (mg/dL)</div>
          <LineMini labels={ptsMg.map((p) => p.t)} values={ptsMg.map((p) => +p.v.toFixed(1))} />
          <div className="text-xs text-slate-600 mt-1">
            Slope/day: {slope} mg/dL • Min {min.toFixed(0)} • Avg {avg.toFixed(0)} • Max {max.toFixed(0)}
          </div>
        </div>
        <div className="p-3 border rounded bg-white">
          <div className="text-sm font-medium mb-1">Zones (mg/dL)</div>
          <BarsMini
            labels={['Hypo<70', '80–180', '>180', '>250']}
            values={[dist.hypo, dist.target, dist.hyper, dist.veryHigh]}
          />
          <div className="text-xs text-slate-600 mt-1">Total {dist.total} readings</div>
        </div>
      </div>

      <div className="mt-3 p-3 border rounded bg-white">
        <div className="text-sm font-medium mb-1">Episodes per day</div>
        <BarsMini labels={labels} values={values} />
        <div className="text-xxs text-slate-500 mt-1">Each bar = # glucose readings on that date</div>
      </div>

      <div className="mt-3">
        <Collapsible title="Notes" defaultOpen={false}>
          Analytics use mg/dL thresholds (70 / 80–180 / &gt;180 / &gt;250). Values sent as mmol/L are converted.
        </Collapsible>
      </div>
    </SectionCard>
  );
}

function ECGAnalytics({ sessions }: { sessions: ECGSess[] }) {
  const counts = sessions.length;
  const totalSec = sessions.reduce((a, s) => a + (s.durationSec ?? secondsBetween(s.start, s.end)), 0);
  const byDay = groupCountByDay(sessions.map((s) => s.start));
  const labels = byDay.map(([d]) => d);
  const values = byDay.map(([, c]) => c);
  const avgPerDay = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  const pts = sessions.map((s) => ({ t: s.start, v: (s.durationSec ?? secondsBetween(s.start, s.end)) / 60 }));
  const slope = slopePerDay(pts).toFixed(2);

  return (
    <SectionCard title="ECG — Session analytics" subtitle="Counts, total duration, and episodes per day">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
        <div className="p-2 border rounded bg-white">
          <div className="font-medium">Sessions</div>
          <div className="text-base">{counts}</div>
        </div>
        <div className="p-2 border rounded bg-white">
          <div className="font-medium">Total duration</div>
          <div className="text-base">{Math.round(totalSec / 60)} min</div>
        </div>
        <div className="p-2 border rounded bg-white">
          <div className="font-medium">Avg/day</div>
          <div className="text-base">{avgPerDay.toFixed(1)}</div>
        </div>
        <div className="p-2 border rounded bg-white">
          <div className="font-medium">Duration slope</div>
          <div className="text-base">{slope} min/day</div>
        </div>
      </div>

      <div className="mt-3 p-3 border rounded bg-white">
        <div className="text-sm font-medium mb-1">Episodes per day</div>
        <BarsMini labels={labels} values={values} />
        <div className="text-xxs text-slate-500 mt-1">Each bar = # sessions on that date</div>
      </div>

      <div className="mt-3">
        <Collapsible title="Notes" defaultOpen={false}>
          Sessions are derived from ECG start/end times. If the API omits <code>durationSec</code>, it’s computed from timestamps.
        </Collapsible>
      </div>
    </SectionCard>
  );
}

function AnalyticsDashboard({ patientId }: { patientId: string }) {
  const [range, setRange] = useState<RangeOpt>(30);
  const to = toISO();
  const from = toISO(addDays(new Date(), -range));

  const [bp, setBP] = useState<BPRec[]>([]);
  const [spo2, setSpO2] = useState<SpO2Rec[]>([]);
  const [temp, setTemp] = useState<TempRec[]>([]);
  const [hr, setHR] = useState<HRRec[]>([]);
  const [glu, setGlu] = useState<GluRec[]>([]);
  const [ecg, setECG] = useState<ECGSess[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const [bpL, spL, tL, hL, gL, eL] = await Promise.all([
          fetchListSafe<BPRec>(API.bp(patientId, from, to), []),
          fetchListSafe<SpO2Rec>(API.spo2(patientId, from, to), []),
          fetchListSafe<TempRec>(API.temp(patientId, from, to), []),
          fetchListSafe<HRRec>(API.hr(patientId, from, to), []),
          fetchListSafe<GluRec>(API.glu(patientId, from, to), []),
          fetchListSafe<ECGSess>(API.ecg(patientId, from, to), []),
        ]);
        if (!mounted) return;
        setBP(bpL);
        setSpO2(spL);
        setTemp(tL);
        setHR(hL);
        setGlu(gL);
        setECG(eL);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [patientId, from, to]);

  return (
    <div className="space-y-4">
      <SectionCard
        title="Analytics"
        subtitle="Cross-vital trends for the selected date range"
        status={<Badge tone="slate">{loading ? 'Loading...' : 'Ready'}</Badge>}
        menu={
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">Range</label>
            <select
              value={range}
              onChange={(e) => setRange(Number(e.target.value) as RangeOpt)}
              className="p-1 border rounded text-sm bg-white"
            >
              <option value={7}>7d</option>
              <option value={14}>14d</option>
              <option value={30}>30d</option>
              <option value={90}>90d</option>
            </select>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 text-xs">
          <div className="p-2 border rounded bg-white">
            <div className="font-medium">BP readings</div>
            <div className="text-base">{bp.length}</div>
            <div className="text-xxs text-gray-500">{from} → {to}</div>
          </div>
          <div className="p-2 border rounded bg-white">
            <div className="font-medium">SpO₂ readings</div>
            <div className="text-base">{spo2.length}</div>
            <div className="text-xxs text-gray-500">{from} → {to}</div>
          </div>
          <div className="p-2 border rounded bg-white">
            <div className="font-medium">Temp readings</div>
            <div className="text-base">{temp.length}</div>
            <div className="text-xxs text-gray-500">{from} → {to}</div>
          </div>
          <div className="p-2 border rounded bg-white">
            <div className="font-medium">HR readings</div>
            <div className="text-base">{hr.length}</div>
            <div className="text-xxs text-gray-500">{from} → {to}</div>
          </div>
          <div className="p-2 border rounded bg-white">
            <div className="font-medium">Glucose readings</div>
            <div className="text-base">{glu.length}</div>
            <div className="text-xxs text-gray-500">{from} → {to}</div>
          </div>
          <div className="p-2 border rounded bg-white">
            <div className="font-medium">ECG sessions</div>
            <div className="text-base">{ecg.length}</div>
            <div className="text-xxs text-gray-500">{from} → {to}</div>
          </div>
        </div>
      </SectionCard>

      <BPAnalytics items={bp} />
      <SpO2Analytics items={spo2} />
      <TempAnalytics items={temp} />
      <HRAnalytics items={hr} />
      <GlucoseAnalytics items={glu} />
      <ECGAnalytics sessions={ecg} />
    </div>
  );
}

function SimpleWaveCanvas({
  running,
  samples = [],
}: {
  running: boolean;
  samples?: number[];
}) {
  const ref = React.useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const w = c.width;
    const h = c.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, w, h);

    if (!samples.length) return;

    ctx.beginPath();
    for (let i = 0; i < samples.length; i++) {
      const x = (i / Math.max(1, samples.length - 1)) * w;
      const y = h / 2 - (samples[i] / 32768) * (h * 0.4);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = running ? '#60a5fa' : '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [samples, running]);

  return <canvas ref={ref} width={700} height={140} className="w-full h-32 rounded-xl bg-slate-950" />;
}

type VitalPanelKey = 'bp' | 'spo2' | 'temp' | 'glu' | 'hr' | 'ecg';
type ChildVitalTab = 'capture' | 'history' | 'thresholds';

function toChildVitalTab(tab: 'capture' | 'history' | 'thresholds' | 'devices' | ''): ChildVitalTab {
  return tab === 'history' || tab === 'thresholds' ? tab : 'capture';
}

function measurementStateForPanel(
  panel: VitalPanelKey,
  sessionMode: HealthMonitorMode,
  sessionStreaming: boolean,
): 'idle' | 'connecting' | 'measuring' | 'done' | 'error' {
  const activeForPanel =
    panel === 'hr'
      ? sessionMode === 'hr' || sessionMode === 'spo2'
      : panel === 'glu'
        ? sessionMode === 'glucose'
        : sessionMode === panel;

  if (!activeForPanel) return 'idle';
  return sessionStreaming ? 'measuring' : 'done';
}

function TabbedVitals({
  active,
  setActive,
  deepTab,
  patientId,
  emitVital,
  liveEcgSamples,
  livePpgSamples,
  bpHistory,
  spo2History,
  tempHistory,
  gluHistory,
  hrHistory,
  ecgHistory,
  sessionState,
  startMeasurement,
  stopMeasurement,
}: {
  active: VitalPanelKey;
  setActive: (k: VitalPanelKey) => void;
  deepTab?: 'capture' | 'history' | 'thresholds' | 'devices' | '';
  patientId: string;
  emitVital: (opts: {
    type: string;
    payload: any;
    deviceId?: string;
    recorded_at?: string;
    meta?: any;
    dedupeKey?: string;
  }) => Promise<void>;
  liveEcgSamples?: number[];
  livePpgSamples?: number[];
  bpHistory: any[];
  spo2History: any[];
  tempHistory: any[];
  gluHistory: any[];
  hrHistory: any[];
  ecgHistory: any[];
  sessionState: HealthMonitorSessionState;
  startMeasurement: (mode: Exclude<HealthMonitorMode, 'idle'>) => Promise<void>;
  stopMeasurement: () => Promise<void>;
}) {
  const tabs: Array<{ key: VitalPanelKey; label: string; hint?: string }> = [
    { key: 'bp', label: 'BP', hint: 'mmHg + pulse' },
    { key: 'spo2', label: 'SpO₂', hint: 'oxygen + HR' },
    { key: 'temp', label: 'Temp', hint: '°C/°F' },
    { key: 'glu', label: 'Glucose', hint: 'trend' },
    { key: 'hr', label: 'HR' },
    { key: 'ecg', label: 'ECG' },
  ];

  return (
    <SectionCard
      title="Vitals"
      subtitle="Capture, review history, adjust thresholds."
      status={<span className="rounded-full border border-white/70 bg-white/90 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 shadow-sm">Vitals hub</span>}
    >
      <div className="mb-4 rounded-[26px] border border-slate-200/70 bg-slate-50/70 p-2">
        <div role="tablist" aria-label="Vitals" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={active === t.key}
            onClick={() => setActive(t.key)}
            className={cn(
              'rounded-2xl border px-3.5 py-2 text-xs font-medium transition md:text-sm',
              active === t.key
                ? 'border-slate-900 bg-slate-900 text-white shadow-sm shadow-slate-900/20'
                : 'border-white/80 bg-white text-slate-600 hover:border-slate-200 hover:text-slate-900'
            )}
          >
            {t.label}
            {t.hint ? <span className="opacity-70"> — {t.hint}</span> : null}
          </button>
        ))}
        </div>
      </div>

      <div role="tabpanel" hidden={active !== 'bp'} id="panel-bp">
        <Suspense fallback={<SkeletonRow />}>
          <BloodPressure
            defaultTab={active === 'bp' ? toChildVitalTab(deepTab ?? '') : 'capture'}
            initialHistory={bpHistory}
            measurementState={measurementStateForPanel('bp', sessionState.mode, sessionState.streaming)}
            livePressure={sessionState.lastBpPressure}
            peakPressure={sessionState.bpPeakPressure}
            pressureFrames={sessionState.bpPressureFrames}
            pressureSamplesSeen={sessionState.bpPressureSamplesSeen}
            latestResult={sessionState.lastBpResult}
            lastCycleComplete={sessionState.lastBpCycleComplete}
            onStart={() => startMeasurement('bp')}
            onStop={() => stopMeasurement()}
            onSave={async (rec: any) => {
              await emitVital({
                type: 'blood_pressure',
                recorded_at: rec.timestamp ?? new Date().toISOString(),
                deviceId: 'duecare.health-monitor',
                payload: {
                  systolic: rec.systolic,
                  diastolic: rec.diastolic,
                  pulse: rec.pulse,
                  unit: 'mmHg',
                },
                meta: { cuffStatus: rec.cuffStatus, source: 'ble', algorithm: 'web_oscillometric_calibrated' },
              });
            }}
          />
        </Suspense>
      </div>

      <div role="tabpanel" hidden={active !== 'spo2'} id="panel-spo2">
        <Suspense fallback={<SkeletonRow />}>
          <BloodOxygen
            initialHistory={spo2History}
            measurementState={measurementStateForPanel('spo2', sessionState.mode, sessionState.streaming)}
            latestResult={sessionState.lastSpo2Result}
            lastCycleComplete={sessionState.lastSpo2CycleComplete}
            liveSampleCount={livePpgSamples?.length ?? 0}
            onStart={() => startMeasurement('spo2')}
            onStop={() => stopMeasurement()}
            onSave={async (rec: any) => {
              await emitVital({
                type: 'spo2',
                recorded_at: rec.timestamp ?? new Date().toISOString(),
                deviceId: 'duecare.health-monitor',
                payload: { spo2: rec.spo2, pulse: rec.pulse, perfIndex: rec.perfIndex, unit: '%' },
                meta: { source: rec.source ?? 'ble' },
              });
            }}
          />
        </Suspense>
      </div>

      <div role="tabpanel" hidden={active !== 'temp'} id="panel-temp">
        <Suspense fallback={<SkeletonRow />}>
          <Temperature
            defaultTab={active === 'temp' ? toChildVitalTab(deepTab ?? '') : 'capture'}
            initialHistory={tempHistory}
            measurementState={measurementStateForPanel('temp', sessionState.mode, sessionState.streaming)}
            latestResult={sessionState.lastTempResult}
            lastCycleComplete={sessionState.lastTempCycleComplete}
            onStart={() => startMeasurement('temp')}
            onStop={() => stopMeasurement()}
            onSave={async (rec: any) => {
              await emitVital({
                type: 'temperature',
                recorded_at: rec.timestamp ?? new Date().toISOString(),
                deviceId: 'duecare.health-monitor',
                payload: { celsius: rec.celsius, fahrenheit: rec.fahrenheit, unit: 'C' },
                meta: { source: 'ble', algorithm: 'web_temperature_calibrated' },
              });
            }}
          />
        </Suspense>
      </div>

      <div role="tabpanel" hidden={active !== 'glu'} id="panel-glu">
        <Suspense fallback={<SkeletonRow />}>
          <Glucose
            initialHistory={gluHistory}
            measurementState={measurementStateForPanel('glu', sessionState.mode, sessionState.streaming)}
            onStart={() => startMeasurement('glucose')}
            onStop={() => stopMeasurement()}
            onSave={async (rec: any) => {
              await emitVital({
                type: 'blood_glucose',
                deviceId: 'duecare.health-monitor',
                recorded_at: rec.timestamp,
                payload: {
                  glucose: rec.glucose,
                  unit: rec.unit === 'mg_dl' ? 'mg/dL' : 'mmol/L',
                  stripCode: rec.stripCode,
                  testType: rec.testType,
                  fasting: rec.fasting,
                  note: rec.note,
                },
                meta: { source: rec.note ? 'manual-ui' : 'ble' },
              });
            }}
          />
        </Suspense>
      </div>

      <div role="tabpanel" hidden={active !== 'ecg'} id="panel-ecg">
        <Suspense fallback={<SkeletonRow />}>
          <ECG
            running={sessionState.mode === 'ecg' && sessionState.streaming}
            samples={liveEcgSamples}
            initialHistory={ecgHistory}
            lastCycleComplete={sessionState.lastEcgCycleComplete}
            latestSession={null}
            onStart={() => startMeasurement('ecg')}
            onStop={() => stopMeasurement()}
            ECGCanvas={({ running }: { running: boolean }) => (
              <SimpleWaveCanvas running={running} samples={liveEcgSamples} />
            )}
            onSave={async (rec: any) => {
              await emitVital({
                type: 'ecg',
                recorded_at: rec.timestamp ?? new Date().toISOString(),
                deviceId: 'duecare.health-monitor',
                payload: { durationSec: rec.durationSec, rhr: rec.rhr, summary: rec.rawSummary },
                meta: { source: 'ble' },
              });
            }}
          />
        </Suspense>
      </div>

      <div role="tabpanel" hidden={active !== 'hr'} id="panel-hr">
        <Suspense fallback={<SkeletonRow />}>
          <HeartRate
            initialHistory={hrHistory}
            measurementState={measurementStateForPanel('hr', sessionState.mode, sessionState.streaming)}
            latestResult={
              sessionState.lastSpo2Result
                ? {
                    hr: sessionState.lastSpo2Result.pulse ?? null,
                    spo2: sessionState.lastSpo2Result.spo2 ?? null,
                    recordedAt: sessionState.lastSpo2Result.recordedAt,
                  }
                : sessionState.lastBpResult
                  ? {
                      hr: sessionState.lastBpResult.pulse ?? null,
                      spo2: null,
                      recordedAt: sessionState.lastBpResult.recordedAt,
                    }
                  : null
            }
            lastCycleComplete={
              sessionState.lastSpo2CycleComplete
                ? {
                    reason: sessionState.lastSpo2CycleComplete.reason,
                    hr: sessionState.lastSpo2CycleComplete.pulse,
                    spo2: sessionState.lastSpo2CycleComplete.spo2,
                    recordedAt: sessionState.lastSpo2CycleComplete.recordedAt,
                    signalFrames: sessionState.lastSpo2CycleComplete.ppgFrames,
                  }
                : null
            }
            liveSampleCount={livePpgSamples?.length ?? 0}
            onStart={() => startMeasurement('hr')}
            onStop={() => stopMeasurement()}
            onSave={async (rec: any) => {
              await emitVital({
                type: 'heart_rate',
                recorded_at: rec.timestamp ?? new Date().toISOString(),
                deviceId: 'duecare.health-monitor',
                payload: { hr: rec.hr, unit: 'bpm' },
                meta: { source: rec.source ?? 'ble' },
                dedupeKey: 'hr',
              });
            }}
          />
        </Suspense>
      </div>
    </SectionCard>
  );
}

function HealthMonitorPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const qs = useMemo(() => new URLSearchParams(search?.toString() ?? ''), [search]);
  const deepPanel = (qs.get('panel') || '') as VitalPanelKey | '';
  const deepTab = (qs.get('vtab') || '') as 'capture' | 'history' | 'thresholds' | 'devices' | '';

  const locale = APP_LOCALE;

  const {
    patientId: contextPatientId,
    roomId: contextRoomId,
    profile,
    vitalsSummary,
    loadingProfile,
    refreshOverview,
    emitVital: persistVital,
  } = useVitalsContext();

  const patientId = contextPatientId ?? '';
  const roomId = contextRoomId ?? (patientId ? `room-${patientId}` : 'room-loading');

  const lastSeenRef = React.useRef<Record<string, number>>({});

  const emitVital = useCallback(
    async (opts: {
      type: string;
      payload: any;
      deviceId?: string;
      recorded_at?: string;
      meta?: any;
      dedupeKey?: string;
    }) => {
      const recorded_at = opts.recorded_at ?? new Date().toISOString();
      const deviceId = opts.deviceId ?? 'duecare.health-monitor';
      const payload = opts.payload ?? {};
      const meta = opts.meta ?? {};
      const type = opts.type;

      if (opts.dedupeKey) {
        const key = `${opts.dedupeKey}:${type}`;
        const now = Date.now();
        const last = lastSeenRef.current[key] ?? 0;
        if (now - last < 5000) return;
        lastSeenRef.current[key] = now;
      }

      if (!patientId) {
        console.warn('emitVital skipped: no authenticated patientId available');
        return;
      }

      try {
        await persistVital({
          type: type as any,
          payload,
          deviceId,
          recorded_at,
          meta,
        });
      } catch (err) {
        console.warn('emitVital persist failed', err);
      }

      const makeId = () => {
        const token =
          typeof globalThis.crypto?.randomUUID === 'function'
            ? globalThis.crypto.randomUUID()
            : `${Date.now().toString(36)}-${performance.now().toString(36).replace('.', '')}`;

        return `${type}-${token}`;
      };

      if (type === 'blood_pressure') {
        const rec = {
          id: makeId(),
          timestamp: recorded_at,
          systolic: payload.systolic,
          diastolic: payload.diastolic,
          pulse: payload.pulse,
          unit: payload.unit ?? 'mmHg',
          cuffStatus: meta?.cuffStatus,
          raw: meta,
        };
        setBpHistory((prev) => [rec, ...prev].slice(0, 500));
      }

      if (type === 'spo2') {
        const rec = {
          id: makeId(),
          timestamp: recorded_at,
          spo2: payload.spo2,
          pulse: payload.pulse,
          perfIndex: payload.perfIndex,
          unit: payload.unit ?? '%',
          source: 'ble',
          raw: meta,
        };
        setSpo2History((prev) => [rec, ...prev].slice(0, 500));
      }

      if (type === 'temperature') {
        const rec = {
          id: makeId(),
          timestamp: recorded_at,
          celsius: payload.celsius,
          fahrenheit: payload.fahrenheit,
          unit: 'C',
          raw: meta,
        };
        setTempHistory((prev) => [rec, ...prev].slice(0, 500));
      }

      if (type === 'blood_glucose') {
        const unitNorm = payload.unit === 'mg/dL' ? 'mg_dl' : 'mmol_l';
        const rec = {
          id: makeId(),
          timestamp: recorded_at,
          glucose: payload.glucose,
          unit: unitNorm,
          stripCode: payload.stripCode,
          testType: payload.testType,
          fasting: payload.fasting,
          note: payload.note,
        };
        setGluHistory((prev) => [rec, ...prev].slice(0, 3000));
      }

      if (type === 'heart_rate') {
        const rec = {
          id: makeId(),
          timestamp: recorded_at,
          hr: payload.hr,
          unit: payload.unit ?? 'bpm',
          source: 'ble',
          raw: meta,
        };
        setHrHistory((prev) => [rec, ...prev].slice(0, 500));
      }

      if (type === 'ecg') {
        const rec = {
          id: makeId(),
          timestamp: recorded_at,
          durationSec: payload.durationSec,
          rhr: payload.rhr,
          rawSummary: payload.summary ?? meta,
        };
        setEcgHistory((prev) => [rec, ...prev].slice(0, 200));
      }

      try {
        await fetch('/api/iomt/push', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            roomId,
            type,
            value:
              payload.value ??
              payload.hr ??
              payload.spo2 ??
              payload.glucose ??
              payload.systolic ??
              payload.celsius ??
              null,
            unit: payload.unit ?? null,
          }),
        });
      } catch {}
    },
    [patientId, roomId, persistVital]
  );


  const [hmSessionState, setHmSessionState] = useState<HealthMonitorSessionState>({
    connected: false,
    connecting: false,
    streaming: false,
    batteryPct: null,
    rssi: null,
    error: null,
    mode: 'idle',

    lastBpPressure: null,
    bpPeakPressure: null,
    bpPressureFrames: 0,
    bpPressureSamplesSeen: 0,
    lastBpResult: null,
    lastBpCycleComplete: null,

    lastSpo2Result: null,
    lastSpo2CycleComplete: null,

    lastTempResult: null,
    lastTempCycleComplete: null,

    lastGlucoseResult: null,
    lastGlucoseCycleComplete: null,

    ecgSampleCount: 0,
    lastEcgCycleComplete: null,
  });

  const [liveEcgSamples, setLiveEcgSamples] = useState<number[]>([]);
  const [livePpgSamples, setLivePpgSamples] = useState<number[]>([]);

  const [bpHistory, setBpHistory] = useState<any[]>([]);
  const [spo2History, setSpo2History] = useState<any[]>([]);
  const [tempHistory, setTempHistory] = useState<any[]>([]);
  const [gluHistory, setGluHistory] = useState<any[]>([]);
  const [hrHistory, setHrHistory] = useState<any[]>([]);
  const [ecgHistory, setEcgHistory] = useState<any[]>([]);
  const hmSessionRef = React.useRef<ReturnType<typeof createHealthMonitorSession> | null>(null);

  const lastBridgeBpResultRef = React.useRef<string | null>(null);
  const lastBridgeSpo2ResultRef = React.useRef<string | null>(null);
  const lastBridgeTempResultRef = React.useRef<string | null>(null);
  const lastBridgeGlucoseResultRef = React.useRef<string | null>(null);
  const lastBridgeEcgCycleRef = React.useRef<string | null>(null);

  const [tab, setTab] = useState<'overview' | 'vitals' | 'analytics' | 'reports'>(
    ((qs.get('t') as any) || 'overview')
  );
  useEffect(() => {
    const qp = new URLSearchParams(qs.toString());
    qp.set('t', tab);
    router.replace(`?${qp.toString()}`, { scroll: false });
  }, [router, qs, tab]);

  const [alertsOpen, setAlertsOpen] = useState<boolean>(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  const [devices, setDevices] = useState<DeviceInfo[]>([
    {
      id: 'duecare-health-monitor',
      name: 'HealthMonitor-001',
      transport: 'ble',
      connected: false,
      batteryPct: null,
      rssi: null,
    },
  ]);

  const upsertDevice = useCallback((patch: Partial<DeviceInfo> & { id: string }) => {
    setDevices((curr) => {
      const idx = curr.findIndex((d) => d.id === patch.id);
      if (idx === -1)
        return [
          ...curr,
          { name: patch.id, transport: 'ble', connected: false, batteryPct: null, rssi: null, ...patch },
        ];
      const next = curr.slice();
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }, []);

  useEffect(() => {
    if (!patientId) return;

    const session = createHealthMonitorSession({
      patientId,
      onState: (s) => {
        setHmSessionState(s);

        upsertDevice({
          id: 'duecare-health-monitor',
          name: 'HealthMonitor-001',
          transport: 'ble',
          connected: s.connected,
          batteryPct: s.batteryPct,
          rssi: s.rssi,
        });
      },
      onLiveEvent: (evt) => {
        if (evt.type === 'ecg') {
          const next = Array.isArray((evt as any).detail?.samples)
            ? (evt as any).detail.samples
            : (evt as any).detail?.chunk?.samples;
          if (Array.isArray(next) && next.length) {
            setLiveEcgSamples((prev) => prev.concat(next).slice(-2500));
          }
        }

        if (evt.type === 'ppg') {
          const next = Array.isArray((evt as any).detail?.samples)
            ? (evt as any).detail.samples
            : (evt as any).detail?.chunk?.samples;
          if (Array.isArray(next) && next.length) {
            setLivePpgSamples((prev) => prev.concat(next).slice(-500));
          }
        }
      },
    });

    hmSessionRef.current = session;

    return () => {
      void hmSessionRef.current?.disconnect();
      hmSessionRef.current = null;
    };
  }, [patientId, upsertDevice]);

  const { push: pushToast, Toasts } = useToasts();

  const connectHealthMonitor = useCallback(async () => {
    const bt = typeof navigator !== 'undefined' ? (navigator as any).bluetooth : undefined;

    if (!bt?.requestDevice) {
      const msg = 'Bluetooth is not available in this browser. Use Chrome or Edge on desktop/Android over HTTPS, or connect through the supported native bridge.';
      setHmSessionState((prev) => ({ ...prev, connecting: false, error: msg }));
      pushToast(msg);
      return;
    }

    try {
      await hmSessionRef.current?.connect();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to connect to the health monitor.';
      setHmSessionState((prev) => ({ ...prev, connecting: false, error: msg }));
      pushToast(msg);
    }
  }, [pushToast]);

  useEffect(() => {
    const r = hmSessionState.lastBpResult;
    if (!r?.recordedAt) return;
    if (lastBridgeBpResultRef.current === r.recordedAt) return;
    lastBridgeBpResultRef.current = r.recordedAt;

    const rec = {
      id: `bp-bridge-${r.recordedAt}`,
      timestamp: r.recordedAt,
      systolic: r.systolic,
      diastolic: r.diastolic,
      pulse: r.pulse ?? undefined,
      unit: 'mmHg' as const,
      cuffStatus: 'completed',
      raw: {
        source: 'bridge-session',
        map: r.map ?? null,
      },
    };

    setBpHistory((prev) => {
      const exists = prev.some(
        (x) =>
          x.timestamp === rec.timestamp &&
          x.systolic === rec.systolic &&
          x.diastolic === rec.diastolic
      );
      if (exists) return prev;
      return [rec, ...prev].slice(0, 500);
    });
  }, [hmSessionState.lastBpResult]);

  useEffect(() => {
    const r = hmSessionState.lastSpo2Result;
    if (!r?.recordedAt) return;
    if (lastBridgeSpo2ResultRef.current === r.recordedAt) return;
    lastBridgeSpo2ResultRef.current = r.recordedAt;

    const rec = {
      id: `spo2-bridge-${r.recordedAt}`,
      timestamp: r.recordedAt,
      spo2: r.spo2 ?? undefined,
      pulse: r.pulse ?? undefined,
      perfIndex: r.pi ?? undefined,
      unit: '%',
      source: 'ble',
      raw: { source: 'bridge-session' },
    };

    setSpo2History((prev) => {
      const exists = prev.some(
        (x) =>
          x.timestamp === rec.timestamp &&
          x.spo2 === rec.spo2 &&
          x.pulse === rec.pulse
      );
      if (exists) return prev;
      return [rec, ...prev].slice(0, 500);
    });

    if (typeof r.pulse === 'number' && r.pulse > 0) {
      const hrRec = {
        id: `hr-from-spo2-${r.recordedAt}`,
        timestamp: r.recordedAt,
        hr: r.pulse,
        unit: 'bpm',
        source: 'ble',
        raw: {
          source: 'bridge-session',
          parent: 'spo2',
          spo2: r.spo2 ?? null,
        },
      };

      setHrHistory((prev) => {
        const exists = prev.some(
          (x) =>
            x.timestamp === hrRec.timestamp &&
            x.hr === hrRec.hr
        );
        if (exists) return prev;
        return [hrRec, ...prev].slice(0, 500);
      });
    }
  }, [hmSessionState.lastSpo2Result]);

  useEffect(() => {
    const r = hmSessionState.lastTempResult;
    if (!r?.recordedAt) return;
    if (lastBridgeTempResultRef.current === r.recordedAt) return;
    lastBridgeTempResultRef.current = r.recordedAt;

    const rec = {
      id: `temp-bridge-${r.recordedAt}`,
      timestamp: r.recordedAt,
      celsius: r.celsius,
      fahrenheit: r.fahrenheit ?? undefined,
      unit: 'C',
      raw: { source: 'bridge-session' },
    };

    setTempHistory((prev) => {
      const exists = prev.some(
        (x) =>
          x.timestamp === rec.timestamp &&
          x.celsius === rec.celsius
      );
      if (exists) return prev;
      return [rec, ...prev].slice(0, 500);
    });
  }, [hmSessionState.lastTempResult]);

  useEffect(() => {
    const r = hmSessionState.lastGlucoseResult;
    if (!r?.recordedAt) return;
    if (lastBridgeGlucoseResultRef.current === r.recordedAt) return;
    lastBridgeGlucoseResultRef.current = r.recordedAt;

    const rec = {
      id: `glucose-bridge-${r.recordedAt}`,
      timestamp: r.recordedAt,
      glucose: r.glucose,
      unit: r.unit === 'mg/dL' ? 'mg_dl' : 'mmol_l',
      stripCode: '',
      testType: '',
      fasting: null,
      note: '',
    };

    setGluHistory((prev) => {
      const exists = prev.some(
        (x) =>
          x.timestamp === rec.timestamp &&
          x.glucose === rec.glucose
      );
      if (exists) return prev;
      return [rec, ...prev].slice(0, 3000);
    });
  }, [hmSessionState.lastGlucoseResult]);

  useEffect(() => {
    const c = hmSessionState.lastEcgCycleComplete;
    if (!c?.recordedAt) return;
    if (lastBridgeEcgCycleRef.current === c.recordedAt) return;
    lastBridgeEcgCycleRef.current = c.recordedAt;

    if (c.sampleCount > 0) {
      const rec = {
        id: `ecg-bridge-${c.recordedAt}`,
        timestamp: c.recordedAt,
        durationSec: undefined,
        rhr: undefined,
        rawSummary: {
          source: 'bridge-session',
          sampleCount: c.sampleCount,
          signalQuality: c.signalQuality,
          reason: c.reason,
        },
      };

      setEcgHistory((prev) => {
        const exists = prev.some((x) => x.timestamp === rec.timestamp);
        if (exists) return prev;
        return [rec, ...prev].slice(0, 200);
      });
    }
  }, [hmSessionState.lastEcgCycleComplete]);

  useEffect(() => {
    const c = hmSessionState.lastBpCycleComplete;
    if (!c) return;

    if (
      c.reason === 'silence_after_pressure' &&
      !hmSessionState.lastBpResult
    ) {
      pushToast('Blood pressure cycle completed, but no final decoded result was received yet.', 'default');
    }
  }, [
    hmSessionState.lastBpCycleComplete,
    hmSessionState.lastBpResult,
    pushToast,
  ]);

  useEffect(() => {
    const c = hmSessionState.lastSpo2CycleComplete;
    if (!c) return;
    if (c.reason === 'signal_detected_no_result') {
      pushToast('SpO₂ signal was detected, but no final saturation value was decoded.', 'default');
    }
    if (c.reason === 'timeout') {
      pushToast('SpO₂ measurement timed out.', 'error');
    }
  }, [hmSessionState.lastSpo2CycleComplete, pushToast]);

  useEffect(() => {
    const c = hmSessionState.lastTempCycleComplete;
    if (!c) return;
    if (c.reason === 'timeout') {
      pushToast('Temperature measurement timed out.', 'error');
    }
  }, [hmSessionState.lastTempCycleComplete, pushToast]);

  useEffect(() => {
    const c = hmSessionState.lastGlucoseCycleComplete;
    if (!c) return;
    if (c.reason === 'timeout') {
      pushToast('Glucose measurement timed out.', 'error');
    }
    if (c.reason === 'signal_detected_no_result') {
      pushToast('Glucose workflow started, but no final value was decoded.', 'default');
    }
  }, [hmSessionState.lastGlucoseCycleComplete, pushToast]);

  useEffect(() => {
    function onTelemetry(e: Event) {
      const detail = (e as CustomEvent).detail as Partial<DeviceInfo> & { id: string };
      if (!detail?.id) return;
      upsertDevice(detail);
    }
    window.addEventListener('iomt:telemetry' as any, onTelemetry as any);
    return () => window.removeEventListener('iomt:telemetry' as any, onTelemetry as any);
  }, [upsertDevice]);

  const startMeasurement = useCallback(
    async (mode: Exclude<HealthMonitorMode, 'idle'>) => {
      if (!hmSessionRef.current) return;
      if (mode === 'ecg') {
        setLiveEcgSamples([]);
      }
      if (mode === 'spo2' || mode === 'hr') {
        setLivePpgSamples([]);
      }
      await hmSessionRef.current.startMeasurement(mode);
    },
    []
  );

  const stopMeasurement = useCallback(async () => {
    if (!hmSessionRef.current) return;
    await hmSessionRef.current.stopMeasurement();
  }, []);

  function shareSummary() {
    const text = `Ambulant+ Health Monitor — Patient ${patientId} on ${new Date().toLocaleString(locale)}`;
    if (navigator.share) {
      navigator.share({ title: 'Health summary', text }).catch(() => {});
    } else {
      navigator.clipboard
        ?.writeText(text)
        .then(() => pushToast('Copied summary to clipboard', 'success'))
        .catch(() => {});
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'a') setAlertsOpen(true);
      if (e.key === '1') setTab('overview');
      if (e.key === '2') setTab('vitals');
      if (e.key === '3') setTab('analytics');
      if (e.key === '4') setTab('reports');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const hrSeries = vitalsSummary?.hr24 ?? EMPTY_SUMMARY.hr24!;
  const spo2Series = vitalsSummary?.spo224 ?? EMPTY_SUMMARY.spo224!;
  const bpSeries = vitalsSummary?.bp24 ?? EMPTY_SUMMARY.bp24!;
  const tempSeries = vitalsSummary?.temp24 ?? EMPTY_SUMMARY.temp24!;
  const gluSeries = vitalsSummary?.glu24 ?? EMPTY_SUMMARY.glu24!;

  const [today, setToday] = useState<TodayItem[]>(EMPTY_TODAY);
  async function refreshTodayAndAlerts(currentPatientId: string) {
    if (!currentPatientId) {
      setToday(EMPTY_TODAY);
      setAlerts(EMPTY_ALERTS);
      return;
    }

    const recent = await getJSON<{ items?: any[] }>(
      `/api/vitals/recent?since=today&patientId=${encodeURIComponent(currentPatientId)}`,
      { fallback: { items: [] } }
    );
    const items: TodayItem[] = (recent.items || []).slice(0, 8).map((it: any) => ({
      t: new Date(it.timestamp || it.t || Date.now()).toLocaleTimeString(),
      label: it.label || it.type || 'Reading',
      route: `?t=vitals&panel=${it.panel || it.type || 'bp'}&vtab=history`,
    }));
    setToday(items);

    const alertRes = await getJSON<{ items?: AlertItem[] }>(
      `/api/alerts/active?patientId=${encodeURIComponent(currentPatientId)}`,
      { fallback: { items: [] } }
    );
    setAlerts(alertRes.items ?? EMPTY_ALERTS);
  }

  useEffect(() => {
    refreshTodayAndAlerts(patientId);
    const id = setInterval(() => refreshTodayAndAlerts(patientId), 60_000);
    return () => clearInterval(id);
  }, [patientId]);

  const [activeVital, setActiveVital] = useState<VitalPanelKey>(deepPanel || 'bp');
  useEffect(() => {
    if (deepPanel && deepPanel !== activeVital) setActiveVital(deepPanel);
  }, [deepPanel, activeVital]);

  const setActiveVitalAndUpdateUrl = useCallback(
    (k: VitalPanelKey) => {
      setActiveVital(k);
      const qp = new URLSearchParams(qs.toString());
      qp.set('t', 'vitals');
      qp.set('panel', k);
      router.replace(`?${qp.toString()}`, { scroll: false });
      (document.querySelector('main') as HTMLElement | null)?.scrollTo?.({ top: 0, behavior: 'smooth' });
    },
    [router, qs]
  );

  const currentMeasurementLabel = useMemo(() => {
    switch (activeVital) {
      case 'bp':
        return 'Blood Pressure';
      case 'spo2':
        return 'SpO₂';
      case 'temp':
        return 'Temperature';
      case 'glu':
        return 'Glucose';
      case 'hr':
        return 'Heart Rate';
      case 'ecg':
        return 'ECG';
      default:
        return 'Measurement';
    }
  }, [activeVital]);

  const currentMeasurementMode = useMemo<Exclude<HealthMonitorMode, 'idle'>>(() => {
    switch (activeVital) {
      case 'glu':
        return 'glucose';
      case 'hr':
        return 'hr';
      default:
        return activeVital;
    }
  }, [activeVital]);

  const spo2Tone = (v: number | undefined) => ((v ?? 100) < 92 ? 'red' : 'slate');
  const gluTone = (v: number | null | undefined, unit?: string | null) => {
    if (v == null) return 'slate' as const;
    const mg = unit === 'mmol/L' ? mmolToMgdl(v) : v;
    if (mg < GLU.hypo) return 'red' as const;
    if (mg > GLU.targetMax) return 'amber' as const;
    return 'slate' as const;
  };

  if (!patientId) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <Bluetooth className="h-3.5 w-3.5" />
            Health Monitor
          </div>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
            Patient profile required
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            {loadingProfile
              ? 'Resolving the signed-in patient profile...'
              : 'Health Monitor readings must be linked to a real patient profile before measurements can be saved.'}
          </p>

          {!loadingProfile ? (
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void refreshOverview()}
                className="inline-flex items-center rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white"
              >
                Retry profile lookup
              </button>

              <a
                href="/profile"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              >
                Open profile
              </a>

              <a
                href="/auth/login"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              >
                Sign in
              </a>
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <>
      <StickyHeader
        profile={profile ?? undefined}
        patientId={patientId || 'Patient'}
        lastSyncHuman={vitalsSummary?.lastSyncHuman}
        onExport={() => setTab('reports')}
        onShare={shareSummary}
        onOpenAlerts={() => setAlertsOpen(true)}
        tab={tab}
        setTab={setTab}
        devices={devices}
      />

      <main className="mx-auto max-w-6xl space-y-6 bg-[radial-gradient(circle_at_top,rgba(191,219,254,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(226,232,240,0.32),transparent_24%)] p-4 md:p-6">
        {tab === 'overview' && (
          <>
            <SectionCard
              title="Health Monitor overview"
              subtitle="A refined command center for live telemetry, recent activity, and device-led capture."
              status={
                <span
                  className={cn(
                    'rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em]',
                    hmSessionState.connected
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-500'
                  )}
                >
                  {hmSessionState.connected ? 'Monitor ready' : 'Awaiting device'}
                </span>
              }
            >
              <div className="grid gap-3 lg:grid-cols-[1.35fr_0.95fr]">
                <div className="rounded-[26px] border border-slate-700/30 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.92))] p-5 text-white shadow-[0_25px_80px_-45px_rgba(15,23,42,0.9)]">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-3">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-200">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        Contactless Medicine Console
                      </div>
                      <div>
                        <div className="text-2xl font-semibold tracking-tight md:text-3xl">{profile?.name ?? 'Patient'}</div>
                        <div className="mt-1 max-w-2xl text-sm text-slate-300">
                          Unified capture for blood pressure, oxygen saturation, temperature, glucose, pulse, and ECG with stable page-owned device control.
                        </div>
                      </div>
                    </div>
                    <div className="grid min-w-[220px] gap-2 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-slate-300">Connection</div>
                        <div className="mt-1 text-lg font-semibold">{hmSessionState.connected ? 'Connected' : hmSessionState.connecting ? 'Connecting...' : 'Offline'}</div>
                        <div className="mt-1 text-xs text-slate-300">Mode: {hmSessionState.mode === 'idle' ? 'Standby' : hmSessionState.mode.toUpperCase()}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-slate-300">Telemetry</div>
                        <div className="mt-1 text-lg font-semibold">{hmSessionState.batteryPct ?? '—'}%</div>
                        <div className="mt-1 text-xs text-slate-300">RSSI {hmSessionState.rssi ?? '—'} dBm</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  <div className="rounded-[24px] border border-slate-200/70 bg-white/90 p-4">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Capture focus</div>
                    <div className="mt-2 text-lg font-semibold text-slate-900">{currentMeasurementLabel}</div>
                    <div className="mt-1 text-sm text-slate-500">The current panel determines the active device workflow and keeps session control centralized on this page.</div>
                  </div>
                  <div className="rounded-[24px] border border-slate-200/70 bg-white/90 p-4">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Recent timeline</div>
                    <div className="mt-2 text-sm text-slate-700">{today[0]?.label ?? 'No recent reading yet'}</div>
                    <div className="mt-1 text-xs text-slate-500">{today[0]?.t ?? 'Waiting for first reading today'}</div>
                  </div>
                  <div className="rounded-[24px] border border-slate-200/70 bg-white/90 p-4">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Alert posture</div>
                    <div className="mt-2 text-sm font-medium text-slate-900">{alerts.length ? `${alerts.length} active alert${alerts.length === 1 ? '' : 's'}` : 'No active alerts'}</div>
                    <div className="mt-1 text-xs text-slate-500">Threshold events remain available from the dedicated alert center.</div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <KPIStat
                label="Heart Rate"
                value={<span>{vitalsSummary?.hrNow ?? "—"} bpm</span>}
                hint={`Latest • ${fmtTime(vitalsSummary?.hrTs)}`}
                series={hrSeries}
              />
              <KPIStat
                label="SpO₂"
                value={<span>{vitalsSummary?.spo2Now ?? "—"}%</span>}
                hint={`Latest • ${fmtTime(vitalsSummary?.spo2Ts)}`}
                series={spo2Series}
                tone={spo2Tone(vitalsSummary?.spo2Now)}
              />
              <KPIStat
                label="Blood Pressure"
                value={
                  <span>
                    {vitalsSummary?.bpNow ? `${vitalsSummary.bpNow.s}/${vitalsSummary.bpNow.d}` : '—'}{' '}
                    mmHg
                  </span>
                }
                hint={`Latest • ${fmtTime(vitalsSummary?.bpTs)}`}
                series={bpSeries}
              />
              <KPIStat
                label="Temperature"
                value={<span>{vitalsSummary?.tempNow ?? "—"}°C</span>}
                hint={`Latest • ${fmtTime(vitalsSummary?.tempTs)}`}
                series={tempSeries}
              />
              <KPIStat
                label="Glucose"
                value={
                  <span>
                    {vitalsSummary?.gluNow ?? "—"} {vitalsSummary?.gluUnit ?? ''}
                  </span>
                }
                hint={`Latest • ${fmtTime(vitalsSummary?.gluTs)}`}
                series={gluSeries}
                tone={gluTone(vitalsSummary?.gluNow, vitalsSummary?.gluUnit)}
              />
            </div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SectionCard
                title="Today"
                subtitle="Recent readings (read-only). Click to open History."
                status={
                  <span className="text-xs px-2 py-1 rounded-lg bg-slate-50 border inline-flex items-center gap-1">
                    <LineChart className="w-3.5 h-3.5" />
                    Timeline
                  </span>
                }
              >
                <ul className="text-sm text-slate-700 space-y-2">
                  {today.length === 0 && <li className="text-slate-500">No readings yet today.</li>}
                  {today.map((it, i) => (
                    <li key={`${it.route}-${i}`} className="flex items-center justify-between">
                      <span className="text-slate-500 tabular-nums">{it.t}</span>
                      <a
                        href={it.route}
                        onClick={(e) => {
                          e.preventDefault();
                          router.replace(it.route, { scroll: false });
                          setTab('vitals');
                        }}
                        className="underline"
                      >
                        {it.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </SectionCard>

              <SectionCard
                title="Alerts"
                subtitle="Rule-based thresholds"
                status={<span className="text-xs px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border">Center</span>}
              >
                <div className="text-sm">{alerts.length ? `${alerts.length} active` : 'No active alerts'}</div>
                <div className="mt-2 space-y-2">
                  {alerts.slice(0, 3).map((a) => (
                    <div key={a.id} className="rounded-xl border p-2 flex items-start gap-2">
                      <div className={cn('h-2 w-2 rounded-full mt-1', a.level === 'red' ? 'bg-red-500' : 'bg-amber-500')} />
                      <div className="text-xs">
                        <div className="font-medium">
                          {a.vital} — {a.value}
                        </div>
                        <div className="text-[11px] text-slate-500">{a.when}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2">
                  <button onClick={() => setAlertsOpen(true)} className="px-3 py-1.5 rounded-xl border">
                    Open Alert Center
                  </button>
                </div>
              </SectionCard>
            </motion.div>
          </>
        )}

        {tab === 'vitals' && (
          <>
            <SectionCard
              title="Health Monitor device"
              subtitle="Bridge-driven BLE connection for BP, SpO₂, Temperature, Glucose, HR and ECG."
              status={
                <span
                  className={cn(
                    'text-xs px-2 py-1 rounded-lg border',
                    hmSessionState.connected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-700'
                  )}
                >
                  {hmSessionState.connected
                    ? hmSessionState.streaming
                      ? `Connected • Streaming • ${hmSessionState.mode.toUpperCase()}`
                      : 'Connected'
                    : hmSessionState.connecting
                      ? 'Connecting...'
                      : 'Disconnected'}
                </span>
              }
            >
              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {!hmSessionState.connected ? (
                      <button
                        onClick={() => void connectHealthMonitor()}
                        disabled={hmSessionState.connecting}
                        className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-slate-900/20 transition hover:-translate-y-0.5 disabled:opacity-60"
                      >
                        {hmSessionState.connecting ? 'Connecting...' : 'Connect monitor'}
                      </button>
                    ) : (
                      <>
                        {!hmSessionState.streaming ? (
                          <button
                            onClick={() => void startMeasurement(currentMeasurementMode)}
                            className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-indigo-600/20 transition hover:-translate-y-0.5"
                          >
                            Start {currentMeasurementLabel}
                          </button>
                        ) : (
                          <button
                            onClick={() => void stopMeasurement()}
                            className="rounded-2xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-amber-600/20 transition hover:-translate-y-0.5"
                          >
                            Stop {currentMeasurementLabel}
                          </button>
                        )}

                        <button
                          onClick={() => void hmSessionRef.current?.disconnect()}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50"
                        >
                          Disconnect
                        </button>
                      </>
                    )}

                    <div className="text-xs text-slate-500">
                      Battery: {hmSessionState.batteryPct ?? '—'}% • RSSI: {hmSessionState.rssi ?? '—'}
                    </div>
                  </div>

                  {hmSessionState.error ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                      {hmSessionState.error}
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[24px] border border-slate-200/70 bg-slate-50/80 p-4">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Session status</div>
                    <div className="mt-2 text-lg font-semibold text-slate-900">{hmSessionState.streaming ? 'Measurement active' : hmSessionState.connected ? 'Ready for capture' : 'Waiting for connection'}</div>
                    <div className="mt-1 text-sm text-slate-500">{hmSessionState.mode === 'idle' ? 'Select a vital tab and start from the page-owned bridge.' : `Current device mode: ${hmSessionState.mode.toUpperCase()}`}</div>
                  </div>
                  <div className="rounded-[24px] border border-slate-200/70 bg-slate-50/80 p-4">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Signal telemetry</div>
                    <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl border border-white bg-white p-3">
                        <div className="text-slate-500">Battery</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">{hmSessionState.batteryPct ?? '—'}%</div>
                      </div>
                      <div className="rounded-2xl border border-white bg-white p-3">
                        <div className="text-slate-500">RSSI</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">{hmSessionState.rssi ?? '—'}</div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-slate-200/70 bg-slate-50/80 p-4 sm:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Capture focus</div>
                        <div className="mt-1 text-base font-semibold text-slate-900">{currentMeasurementLabel}</div>
                      </div>
                      <span className="rounded-full border border-white bg-white px-3 py-1 text-xs font-medium text-slate-600">Page-owned device orchestration</span>
                    </div>
                    <div className="mt-3 text-sm text-slate-500">Tabs no longer open their own Bluetooth sessions. This page remains the single source of truth for connection, battery, measurement mode, and live telemetry.</div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <TabbedVitals
              active={activeVital}
              setActive={setActiveVitalAndUpdateUrl}
              deepTab={deepTab || ''}
              patientId={patientId}
              emitVital={emitVital}
              liveEcgSamples={liveEcgSamples}
              livePpgSamples={livePpgSamples}
              bpHistory={bpHistory}
              spo2History={spo2History}
              tempHistory={tempHistory}
              gluHistory={gluHistory}
              hrHistory={hrHistory}
              ecgHistory={ecgHistory}
              sessionState={hmSessionState}
              startMeasurement={startMeasurement}
              stopMeasurement={stopMeasurement}
            />
          </>
        )}

        {tab === 'analytics' && <AnalyticsDashboard patientId={patientId} />}

        {tab === 'reports' && (
          <>
            {patientId ? (
              <>
                <ExportComposer patient={profile} vitalsSummary={vitalsSummary ?? EMPTY_SUMMARY} onAfterDownload={() => {}} />
                <SavedExports patientId={patientId} />
              </>
            ) : (
              <SectionCard
                title="Reports unavailable"
                subtitle="Sign in as a patient before generating or downloading health-monitor reports."
              >
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  No authenticated patient profile is currently available.
                </div>
              </SectionCard>
            )}
          </>
        )}

        <div aria-live="polite" className="sr-only">
          Current locale {locale}. Patient {profile?.name ?? 'Patient'}. Room {roomId}. PPG samples {livePpgSamples.length}.
        </div>
      </main>

      <AlertDrawer open={alertsOpen} onClose={() => setAlertsOpen(false)} items={alerts} />
      <Toasts />
    </>
  );
}

function HealthMonitorPageContent() {
  const vitalsCtx = useVitalsProvider();

  useEffect(() => {
    void vitalsCtx.refreshOverview();

    const id = window.setInterval(() => {
      void vitalsCtx.refreshOverview();
    }, 60_000);

    return () => window.clearInterval(id);
  }, [vitalsCtx.refreshOverview]);

  return (
    <VitalsProvider value={vitalsCtx}>
      <HealthMonitorPageInner />
    </VitalsProvider>
  );
}

export default function HealthMonitorPage() {
  return (
    <Suspense fallback={null}>
      <HealthMonitorPageContent />
    </Suspense>
  );
}

