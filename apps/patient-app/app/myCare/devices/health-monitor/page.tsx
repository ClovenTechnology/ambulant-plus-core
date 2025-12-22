'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  Suspense,
} from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
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

/** Lazy vitals (preserve TTI) */
const Glucose = dynamic(() => import('@/components/iomt/vitals/Glucose'), { ssr: false });
const BloodPressure = dynamic(() => import('@/components/iomt/vitals/BloodPressure'), { ssr: false });
const Temperature = dynamic(() => import('@/components/iomt/vitals/Temperature'), { ssr: false });
const BloodOxygen = dynamic(() => import('@/components/iomt/vitals/BloodOxygen'), { ssr: false });
const HeartRate = dynamic(() => import('@/components/iomt/vitals/HeartRate'), { ssr: false });
const ECG = dynamic(() => import('@/components/iomt/vitals/ECG'), { ssr: false });

/* =========================================================================================
   PROD-FIRST FETCHING WITH MOCK FALLBACKS
   ========================================================================================= */
type VitalsSummary = {
  lastSyncHuman?: string;

  /** Latest “now” values */
  hrNow?: number;
  spo2Now?: number;
  bpNow?: { s: number; d: number } | null;
  tempNow?: number;
  gluNow?: number | null;
  gluUnit?: 'mg/dL' | 'mmol/L' | null;

  /** Timestamps for latest values */
  hrTs?: string | null;
  spo2Ts?: string | null;
  bpTs?: string | null;
  tempTs?: string | null;
  gluTs?: string | null;

  /** 24h/period series for sparklines (still kept for trend) */
  hr24?: number[];
  spo224?: number[];
  bp24?: number[];
  temp24?: number[];
  glu24?: number[];
};

type TodayItem = { t: string; label: string; route: string };
type AlertItem = { id: string; vital: string; value: string; level: 'amber' | 'red'; when: string };

const MOCK_PROFILE = {
  patientId: 'patient-1111',
  name: 'John Doe',
  age: 54,
  gender: 'M',
  avatarUrl: '/images/avatar-placeholder.png',
  chronicConditions: ['Hypertension', 'Type 2 Diabetes'],
  primaryConditionsText: undefined as string | undefined,
};

/** Mock shows “latest” timestamps for the tiles */
const nowISO = new Date().toISOString();
const MOCK_SUMMARY: VitalsSummary = {
  lastSyncHuman: new Date().toLocaleString(),
  hrNow: 74,
  spo2Now: 97,
  bpNow: { s: 122, d: 78 },
  tempNow: 36.8,
  gluNow: 8.2,
  gluUnit: 'mmol/L',

  hrTs: nowISO,
  spo2Ts: nowISO,
  bpTs: nowISO,
  tempTs: nowISO,
  gluTs: nowISO,

  hr24: [72, 74, 71, 76, 79, 77, 75],
  spo224: [97, 96, 98, 97, 95, 97, 98],
  bp24: [120, 118, 121, 124, 119, 122, 123],
  temp24: [36.7, 36.8, 36.9, 36.8, 37.0, 36.9, 36.8],
  glu24: [7.1, 6.8, 8.9, 9.3, 8.2, 7.4, 8.6],
};

const MOCK_TODAY: TodayItem[] = [
  { t: '08:14', label: 'Blood Pressure', route: '?t=vitals&panel=bp&vtab=history' },
  { t: '10:02', label: 'SpO₂', route: '?t=vitals&panel=spo2&vtab=history' },
  { t: '12:25', label: 'Temperature', route: '?t=vitals&panel=temp&vtab=history' },
  { t: '16:40', label: 'Glucose', route: '?t=vitals&panel=glu&vtab=history' },
];

const MOCK_ALERTS: AlertItem[] = [
  { id: 'a1', vital: 'Blood Pressure', value: '165/101', level: 'red', when: 'Today 07:58' },
  { id: 'a2', vital: 'SpO₂', value: '89%', level: 'amber', when: 'Yesterday 22:11' },
];

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

/** ------------ Utilities & Context ------------ */
function cn(...a: Array<string | false | undefined>) {
  return a.filter(Boolean).join(' ');
}
function fmtTime(ts?: string | null) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return '—';
  }
}

/** VitalsContext */
type VitalsContextType = {
  patientId: string;
  roomId: string;
  emitVital: (opts: {
    type: string;
    payload: any;
    deviceId?: string;
    recorded_at?: string;
    meta?: any;
    dedupeKey?: string;
  }) => Promise<void>;
};
const VitalsContext = createContext<VitalsContextType | null>(null);
export function useVitals() {
  const ctx = useContext(VitalsContext);
  if (!ctx) throw new Error('useVitals must be used inside VitalsProvider');
  return ctx;
}

/** ------------ Small UI Primitives ------------ */
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
      className="px-2.5 py-1.5 rounded-xl border bg-white hover:bg-slate-50 active:bg-slate-100 transition"
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
    <nav className="flex items-center gap-1" aria-label="Sections">
      {(['overview', 'vitals', 'analytics', 'reports'] as const).map((key) => (
        <button
          key={key}
          onClick={() => setTab(key)}
          className={cn(
            'px-3 py-1.5 rounded-xl border text-sm transition',
            tab === key ? 'bg-slate-900 text-white' : 'bg-white hover:bg-slate-50'
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

/** ------------ Device pills in header ------------ */
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
    <div className="flex items-center gap-2 px-2 py-1 rounded-full border bg-white shadow-sm">
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

/** ------------ Sticky header ------------ */
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
      : profile?.primaryConditionsText ?? '—';
  return (
    <motion.header
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-40 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b"
    >
      <div className="max-w-6xl mx-auto px-4 py-2.5 grid grid-cols-1 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0 w-10 h-10 md:w-12 md:h-12">
            <Image
              src={profile?.avatarUrl || '/images/avatar-placeholder.png'}
              alt={`${profile?.name ?? 'Patient'} avatar`}
              fill
              priority
              className="rounded-full object-cover border-4 border-white shadow"
            />
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
              <span>Last sync: {lastSyncHuman ?? '—'}</span>
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

/** ------------ KPI + spark (now “Latest @ time”) ------------ */
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
    <div className={cn('rounded-xl border p-3', tones[tone])} role="group" aria-label={`${label} summary`}>
      <div className="text-xxs uppercase tracking-wide opacity-80">{label}</div>
      <div className="flex items-end justify-between gap-2">
        <div className="text-base md:text-lg font-semibold">{value}</div>
        <Sparkline points={series} />
      </div>
      {hint ? <div className="text-xxs opacity-80 mt-0.5">{hint}</div> : null}
    </div>
  );
}
function Sparkline({ points = [] as number[] }) {
  if (!points.length) return <div className="h-6" />;
  const max = Math.max(...points),
    min = Math.min(...points);
  const norm = points.map((p) => ((p - min) / (max - min || 1)) * 18 + 3);
  const step = 80 / (points.length - 1 || 1);
  const d = norm.map((y, i) => `${i ? 'L' : 'M'} ${i * step},${22 - y}`).join(' ');
  return (
    <svg width="80" height="22" aria-hidden focusable="false">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" opacity=".6" />
    </svg>
  );
}

/** ------------ Card ------------ */
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
      className="p-3 md:p-4 rounded-2xl border bg-white shadow-sm"
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
      <div className="mt-3">{children}</div>
    </motion.section>
  );
}
function SkeletonRow() {
  return <div className="animate-pulse h-10 rounded-xl bg-slate-100" />;
}

/** ------------ Toasts ------------ */
function useToasts() {
  const [stack, setStack] = useState<{ id: number; title: string; tone?: 'default' | 'success' | 'error' }[]>(
    []
  );
  const push = useCallback((title: string, tone: 'default' | 'success' | 'error' = 'default') => {
    const id = Date.now() + Math.random();
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

/** ------------ Alert Drawer ------------ */
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

/** ------------ Report Help Drawer ------------ */
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

/** ------------ Export Composer (inline) ------------ */
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
    } catch (_e) {
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
          {downloading ? 'Preparing…' : 'Download PDF (server)'}
        </button>
      </div>
      <ReportHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </SectionCard>
  );
}

/** ------------ Saved Exports table ------------ */
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
                  Loading…
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

/* =========================================================================================
   ANALYTICS TAB (Cross-vital + ECG sessions + Glucose)
   ========================================================================================= */

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
    // allow either {items:[]} or []
    return (j.items ?? j) ?? fallback;
  } catch {
    return fallback;
  } finally {
    clearTimeout(id);
  }
}

function toISO(date = new Date()) { return date.toISOString().slice(0,10); }
function addDays(base: Date, d: number) { const x=new Date(base); x.setDate(x.getDate()+d); return x; }
function slopePerDay(points: Array<{ t: string; v: number }>) {
  if (!points.length) return 0;
  const xs = points.map(p => new Date(p.t).getTime());
  const ys = points.map(p => p.v);
  const n = xs.length;
  const xm = xs.reduce((a,b)=>a+b,0)/n;
  const ym = ys.reduce((a,b)=>a+b,0)/n;
  let num=0, den=0;
  for (let i=0;i<n;i++){ num+=(xs[i]-xm)*(ys[i]-ym); den+=(xs[i]-xm)*(xs[i]-xm); }
  const s = den===0 ? 0 : num/den;
  return s*1000*60*60*24;
}
function groupCountByDay(timestamps: string[]) {
  const map = new Map<string, number>();
  for (const ts of timestamps) {
    const d = new Date(ts);
    const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0,10);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries()).sort((a,b)=>a[0]<b[0]? -1:1);
}
function secondsBetween(a: string, b?: string | null) {
  const t1 = new Date(a).getTime();
  const t2 = b ? new Date(b).getTime() : Date.now();
  return Math.max(0, Math.round((t2 - t1)/1000));
}

/** Tiny UI bits for analytics */
function Badge({ children, tone='slate' as 'slate'|'green'|'amber'|'red'}) {
  const map: any = {
    slate: 'bg-slate-50 text-slate-700 border',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-300 border',
    amber: 'bg-amber-50 text-amber-700 border-amber-300 border',
    red: 'bg-red-50 text-red-700 border-red-300 border',
  };
  return <span className={cn('text-xs px-2 py-1 rounded-lg', map[tone])}>{children}</span>;
}

function Collapsible({ title, children, defaultOpen = true }:{ title:string; children:React.ReactNode; defaultOpen?:boolean }) {
  const [open,setOpen]=useState(defaultOpen);
  return (
    <div className="rounded border bg-white">
      <button className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium"
        onClick={()=>setOpen(o=>!o)}
        aria-expanded={open}
      >
        <span>{title}</span>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {open && <div className="px-3 py-2 text-xs text-slate-700 border-t">{children}</div>}
    </div>
  );
}

/** Minimal charts */
function LineMini({ labels, values }:{ labels:string[]; values:number[] }) {
  if (!values.length) return <div className="h-24" />;
  const w=320, h=90, pad=8;
  const min = Math.min(...values), max = Math.max(...values);
  const scaleY = (v:number)=> h - pad - ((v-min)/(max-min || 1))*(h-2*pad);
  const step = (w-2*pad)/Math.max(1, values.length-1);
  const d = values.map((v,i)=>`${i?'L':'M'} ${pad + i*step},${scaleY(v)}`).join(' ');
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Line chart">
      <path d={d} fill="none" stroke="#334155" strokeWidth="2" />
    </svg>
  );
}
function BarsMini({ labels, values }:{ labels:string[]; values:number[] }) {
  const w=320, h=90, pad=8;
  const max = Math.max(1, ...values);
  const bw = (w-2*pad)/values.length - 6;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Bar chart">
      {values.map((v,i)=>{
        const bh = ((v/max) * (h-2*pad));
        const x = pad + i*((w-2*pad)/values.length) + 3;
        const y = h - pad - bh;
        return <rect key={i} x={x} y={y} width={bw} height={bh} rx="3" ry="3" fill="#64748b" />;
      })}
    </svg>
  );
}
function HeatGrid({ matrix }:{ matrix:(number|null)[][] }) {
  const day=(i:number)=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][i];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[0,1,2,3].map(d=>(
          <div key={d} className="text-xxs">
            <div className="mb-1 font-medium">{day(d)}</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:4}}>
              {matrix[d]?.map((v,bi)=>(
                <div key={bi} title={v==null? 'No data' : String(v)}
                  className="text-white text-xxs rounded p-1 text-center"
                  style={{ background: v==null? '#e5e7eb' : '#64748b' }}
                >{v==null? '—': v}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[4,5,6].map(d=>(
          <div key={d} className="text-xxs">
            <div className="mb-1 font-medium">{day(d)}</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:4}}>
              {matrix[d]?.map((v,bi)=>(
                <div key={bi} title={v==null? 'No data' : String(v)}
                  className="text-white text-xxs rounded p-1 text-center"
                  style={{ background: v==null? '#e5e7eb' : '#64748b' }}
                >{v==null? '—': v}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function heatmapAvg(rows: Array<{ t:string; v:number }>) {
  const buckets = Array.from({ length: 7 }, () => Array.from({ length: 6 }, () => [] as number[]));
  for (const r of rows) {
    const d = new Date(r.t);
    const dow = d.getDay();
    const block = Math.floor(d.getHours()/4);
    buckets[dow][block].push(r.v);
  }
  return buckets.map(row => row.map(col => col.length ? +(col.reduce((a,b)=>a+b,0)/col.length).toFixed(1) : null));
}

/** Helpers for glucose */
function mgdlToMmol(v: number) { return v / 18.0; }
function mmolToMgdl(v: number) { return v * 18.0; }

/** Threshold presets (editable in future) */
const BPZ = {
  normal:   (s:number,d:number)=> s<120 && d<80,
  elevated: (s:number,d:number)=> s>=120 && s<=129 && d<80,
  stage1:   (s:number,d:number)=> (s>=130 && s<=139) || (d>=80 && d<=89),
  stage2:   (s:number,d:number)=> s>=140 || d>=90,
};
const SPO2 = { green:95, amber:90 };
const TEMP = { low:35.0, high:38.0 };
const HRTH = { brady:60, tachy:100 };
const GLU = {
  /** thresholds in mg/dL for analytics; we’ll convert if mmol/L arrives */
  hypo: 70,
  targetMin: 80,
  targetMax: 180,
  hyper: 250,
};

/** Per-vital analytics cards */
function BPAnalytics({ items }:{ items:BPRec[] }) {
  const ptsS = items.map(r=>({ t:r.timestamp, v:r.systolic }));
  const ptsD = items.map(r=>({ t:r.timestamp, v:r.diastolic }));
  const sS = slopePerDay(ptsS).toFixed(2);
  const sD = slopePerDay(ptsD).toFixed(2);
  const counts = useMemo(()=>{
    let normal=0, elev=0, s1=0, s2=0;
    for (const r of items) {
      if (BPZ.stage2(r.systolic,r.diastolic)) s2++;
      else if (BPZ.stage1(r.systolic,r.diastolic)) s1++;
      else if (BPZ.elevated(r.systolic,r.diastolic)) elev++;
      else if (BPZ.normal(r.systolic,r.diastolic)) normal++;
    }
    return { normal, elev, s1, s2, total: items.length };
  }, [items]);
  const heat = useMemo(()=>heatmapAvg(ptsS), [items]);

  return (
    <SectionCard title="Blood Pressure — Analytics" subtitle="Zones, trend, and time-of-day">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 border rounded bg-white md:col-span-2">
          <div className="text-sm font-medium mb-1">Trend (Systolic/Diastolic)</div>
          <LineMini labels={items.map(r=>r.timestamp)} values={items.map(r=>r.systolic)} />
          <LineMini labels={items.map(r=>r.timestamp)} values={items.map(r=>r.diastolic)} />
          <div className="text-xs text-slate-600 mt-1">Slope/day — Systolic {sS} • Diastolic {sD}</div>
        </div>
        <div className="p-3 border rounded bg-white">
          <div className="text-sm font-medium mb-1">Out-of-range breakdown</div>
          <BarsMini labels={['Normal','Elevated','Stage1','Stage2']} values={[counts.normal,counts.elev,counts.s1,counts.s2]} />
          <div className="text-xs text-slate-600 mt-1">Total {counts.total} readings</div>
        </div>
      </div>

      <div className="mt-3 p-3 border rounded bg-white">
        <div className="text-sm font-medium mb-1">Daily heatmap (avg Systolic)</div>
        <div className="text-xxs text-slate-500 mb-2">Each cell ≈ 4h block</div>
        <HeatGrid matrix={heat} />
      </div>

      <div className="mt-3">
        <Collapsible title="Targets & notes" defaultOpen={false}>
          Zones: Normal &lt;120/&lt;80 • Elevated 120–129/&lt;80 • Stage1 130–139 or 80–89 • Stage2 ≥140 or ≥90.
        </Collapsible>
      </div>
    </SectionCard>
  );
}

function SpO2Analytics({ items }:{ items:SpO2Rec[] }) {
  const pts = items.map(r=>({ t:r.timestamp, v:r.spo2 }));
  const slope = slopePerDay(pts).toFixed(2);
  const dist = useMemo(()=>{
    let green=0, amber=0, red=0;
    for (const r of items) {
      if (r.spo2 >= SPO2.green) green++;
      else if (r.spo2 >= SPO2.amber) amber++;
      else red++;
    }
    const total = items.length || 1;
    return { green, amber, red, total, inRangePct: Math.round(green/total*100), t90: Math.round(red/total*100) };
  }, [items]);
  const heat = useMemo(()=>heatmapAvg(pts), [items]);

  return (
    <SectionCard title="SpO₂ — Analytics" subtitle="Distribution, trend, time-of-day">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 border rounded bg-white md:col-span-2">
          <div className="text-sm font-medium mb-1">Trend</div>
          <LineMini labels={items.map(r=>r.timestamp)} values={items.map(r=>r.spo2)} />
          <div className="text-xs text-slate-600 mt-1">Slope/day: {slope} %</div>
        </div>
        <div className="p-3 border rounded bg-white">
          <div className="text-sm font-medium mb-1">Distribution</div>
          <BarsMini labels={['≥95','90–94','<90']} values={[dist.green, dist.amber, dist.red]} />
          <div className="text-xs text-slate-600 mt-1">
            In-range ≥95%: {dist.inRangePct}% • T90 (&lt;90%) {dist.t90}%
          </div>
        </div>
      </div>

      <div className="mt-3 p-3 border rounded bg-white">
        <div className="text-sm font-medium mb-1">Daily heatmap (avg %)</div>
        <div className="text-xxs text-slate-500 mb-2">Each cell ≈ 4h block</div>
        <HeatGrid matrix={heat} />
      </div>

      <div className="mt-3">
        <Collapsible title="Targets & notes" defaultOpen={false}>
          Targets: Green ≥{SPO2.green}% • Amber {SPO2.amber}–{SPO2.green-1}% • Red &lt;{SPO2.amber}%.
        </Collapsible>
      </div>
    </SectionCard>
  );
}

function TempAnalytics({ items }:{ items:TempRec[] }) {
  const pts = items.map(r=>({ t:r.timestamp, v:r.celsius }));
  const slope = slopePerDay(pts).toFixed(2);
  const dist = useMemo(()=>{
    let low=0, normal=0, high=0;
    for (const r of items) {
      if (r.celsius < TEMP.low) low++;
      else if (r.celsius >= TEMP.high) high++;
      else normal++;
    }
    const total = items.length || 1;
    return { low, normal, high, total, inRangePct: Math.round(normal/total*100) };
  }, [items]);

  return (
    <SectionCard title="Temperature — Analytics" subtitle="Trend & thresholds">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 border rounded bg-white md:col-span-2">
          <LineMini labels={items.map(r=>r.timestamp)} values={items.map(r=>r.celsius)} />
          <div className="text-xs text-slate-600 mt-1">Slope/day: {slope} °C</div>
        </div>
        <div className="p-3 border rounded bg-white">
          <div className="text-sm font-medium mb-1">In-range</div>
          <BarsMini labels={['Low','Normal','High']} values={[dist.low, dist.normal, dist.high]} />
          <div className="text-xs text-slate-600 mt-1">In-range {dist.inRangePct}%</div>
        </div>
      </div>
      <div className="mt-3">
        <Collapsible title="Targets & notes" defaultOpen={false}>
          Defaults: Low &lt; {TEMP.low}°C • High ≥ {TEMP.high}°C (editable later).
        </Collapsible>
      </div>
    </SectionCard>
  );
}

function HRAnalytics({ items }:{ items:HRRec[] }) {
  const pts = items.map(r=>({ t:r.timestamp, v:r.hr }));
  const slope = slopePerDay(pts).toFixed(2);
  const dist = useMemo(()=>{
    let brady=0, normal=0, tachy=0;
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
          <LineMini labels={items.map(r=>r.timestamp)} values={items.map(r=>r.hr)} />
          <div className="text-xs text-slate-600 mt-1">Slope/day: {slope} bpm</div>
        </div>
        <div className="p-3 border rounded bg-white">
          <BarsMini labels={['Brady','Normal','Tachy']} values={[dist.brady, dist.normal, dist.tachy]} />
          <div className="text-xs text-slate-600 mt-1">Total {dist.total}</div>
        </div>
      </div>
      <div className="mt-3">
        <Collapsible title="Targets & notes" defaultOpen={false}>
          Defaults: Brady &lt; {HRTH.brady} bpm • Tachy ≥ {HRTH.tachy} bpm.
        </Collapsible>
      </div>
    </SectionCard>
  );
}

/** Glucose analytics (trend, stats, hypo/hyper, episodes/day) */
function GlucoseAnalytics({ items }:{ items:GluRec[] }) {
  // normalize to mg/dL for analysis, keep unit label for display
  const ptsMg = items.map(r => {
    const v = r.unit === 'mmol/L' ? mmolToMgdl(r.glucose) : r.glucose;
    return { t: r.timestamp, v };
  });
  const slope = slopePerDay(ptsMg).toFixed(2);
  const vals = ptsMg.map(p=>p.v);
  const min = vals.length ? Math.min(...vals) : 0;
  const max = vals.length ? Math.max(...vals) : 0;
  const avg = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length) : 0;

  const dist = useMemo(()=>{
    let hypo=0, target=0, hyper=0, veryHigh=0;
    for (const p of ptsMg) {
      if (p.v < GLU.hypo) hypo++;
      else if (p.v < GLU.targetMin) target++; // pre-target low (counts as in-range for simplicity)
      else if (p.v <= GLU.targetMax) target++;
      else if (p.v <= GLU.hyper) hyper++;
      else veryHigh++;
    }
    return { hypo, target, hyper, veryHigh, total: ptsMg.length };
  }, [items]);

  const byDay = groupCountByDay(items.map(i=>i.timestamp));
  const labels = byDay.map(([d])=>d);
  const values = byDay.map(([,c])=>c);

  return (
    <SectionCard title="Glucose — Analytics" subtitle="Trend, stats, and episodes per day">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 border rounded bg-white md:col-span-2">
          <div className="text-sm font-medium mb-1">Trend (mg/dL)</div>
          <LineMini labels={ptsMg.map(p=>p.t)} values={ptsMg.map(p=>+p.v.toFixed(1))} />
          <div className="text-xs text-slate-600 mt-1">
            Slope/day: {slope} mg/dL • Min {min.toFixed(0)} • Avg {avg.toFixed(0)} • Max {max.toFixed(0)}
          </div>
        </div>
        <div className="p-3 border rounded bg-white">
          <div className="text-sm font-medium mb-1">Zones (mg/dL)</div>
          <BarsMini
            labels={['Hypo<70','80–180','>180','>250']}
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
          Analytics use mg/dL thresholds (70 / 80–180 / &gt;180 / &gt;250). Values sent as mmol/L are converted (×18).
        </Collapsible>
      </div>
    </SectionCard>
  );
}

/** ECG sessions analytics (counts, durations, episodes/day) */
function ECGAnalytics({ sessions }:{ sessions:ECGSess[] }) {
  const counts = sessions.length;
  const totalSec = sessions.reduce((a,s)=> a + (s.durationSec ?? secondsBetween(s.start, s.end)), 0);
  const byDay = groupCountByDay(sessions.map(s=>s.start));
  const labels = byDay.map(([d])=>d);
  const values = byDay.map(([,c])=>c);
  const avgPerDay = values.length ? (values.reduce((a,b)=>a+b,0)/values.length) : 0;

  const pts = sessions.map(s=>({ t:s.start, v:(s.durationSec ?? secondsBetween(s.start, s.end))/60 }));
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
          <div className="text-base">{Math.round(totalSec/60)} min</div>
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

function AnalyticsDashboard({ patientId }:{ patientId:string }) {
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
    return () => { mounted = false; };
  }, [patientId, from, to]);

  return (
    <div className="space-y-4">
      <SectionCard
        title="Analytics"
        subtitle="Cross-vital trends for the selected date range"
        status={<Badge tone="slate">{loading ? 'Loading…' : 'Ready'}</Badge>}
        menu={(
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">Range</label>
            <select
              value={range}
              onChange={(e)=>setRange(Number(e.target.value) as RangeOpt)}
              className="p-1 border rounded text-sm bg-white"
            >
              <option value={7}>7d</option>
              <option value={14}>14d</option>
              <option value={30}>30d</option>
              <option value={90}>90d</option>
            </select>
          </div>
        )}
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

/** ------------ Tabbed Vitals (mount-once) ------------ */
function TabbedVitals({
  active,
  setActive,
  deepTab,
  patientId,
  hm,
  emitVital,
}: {
  active: 'bp' | 'spo2' | 'temp' | 'glu' | 'hr' | 'ecg';
  setActive: (k: 'bp' | 'spo2' | 'temp' | 'glu' | 'hr' | 'ecg') => void;
  deepTab?: 'capture' | 'history' | 'thresholds' | 'devices' | '';
  patientId: string;
  hm?: { batteryPct?: number | null; rssi?: number | null } | undefined;
  emitVital: (opts: {
    type: string;
    payload: any;
    deviceId?: string;
    recorded_at?: string;
    meta?: any;
    dedupeKey?: string;
  }) => Promise<void>;
}) {
  const tabs: Array<{ key: 'bp' | 'spo2' | 'temp' | 'glu' | 'hr' | 'ecg'; label: string; hint?: string }> = [
    { key: 'bp', label: 'Blood Pressure', hint: 'mmHg + pulse' },
    { key: 'spo2', label: 'SpO₂', hint: 'oxygen + HR' },
    { key: 'temp', label: 'Temperature', hint: 'C/F' },
    { key: 'glu', label: 'Glucose', hint: 'trend & export' },
    { key: 'hr', label: 'Heart Rate' },
    { key: 'ecg', label: 'ECG', hint: 'lead preview' },
  ];

  return (
    <SectionCard
      title="Vitals"
      subtitle="Capture, review history, adjust thresholds."
      status={<span className="text-xs px-2 py-1 rounded-lg bg-slate-50 border">Tabbed</span>}
    >
      {/* Tabs */}
      <div role="tablist" aria-label="Vitals" className="flex flex-wrap gap-1 mb-3">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={active === t.key}
            onClick={() => setActive(t.key)}
            className={cn(
              'px-3 py-1.5 rounded-xl border text-xs md:text-sm',
              active === t.key ? 'bg-slate-900 text-white' : 'bg-white hover:bg-slate-50'
            )}
          >
            {t.label}
            {t.hint ? <span className="opacity-70"> — {t.hint}</span> : null}
          </button>
        ))}
      </div>

      {/* Panels: ALL RENDERED, hidden toggled → mount-once */}
      {/* BP */}
      <div role="tabpanel" hidden={active !== 'bp'} id="panel-bp">
        <Suspense fallback={<SkeletonRow />}>
          <BloodPressure
            defaultTab={active === 'bp' && deepTab ? deepTab : 'capture'}
            batteryPct={(hm?.batteryPct ?? null) as any}
            rssi={(hm?.rssi ?? null) as any}
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
                meta: { cuffStatus: rec.cuffStatus, source: rec.raw?.simulated ? 'sim' : 'ble' },
                dedupeKey: 'hr',
              });
            }}
          />
        </Suspense>
      </div>

      {/* SpO₂ */}
      <div role="tabpanel" hidden={active !== 'spo2'} id="panel-spo2">
        <Suspense fallback={<SkeletonRow />}>
          <BloodOxygen
            onSave={async (rec: any) => {
              await emitVital({
                type: 'spo2',
                recorded_at: rec.timestamp ?? new Date().toISOString(),
                deviceId: 'duecare.health-monitor',
                payload: { spo2: rec.spo2, pulse: rec.pulse, perfIndex: rec.perfIndex, unit: '%' },
                meta: { source: rec.source ?? 'ble' },
                dedupeKey: 'hr',
              });
            }}
            patientId={patientId}
          />
        </Suspense>
      </div>

      {/* Temp */}
      <div role="tabpanel" hidden={active !== 'temp'} id="panel-temp">
        <Suspense fallback={<SkeletonRow />}>
          <Temperature
            defaultTab={active === 'temp' && deepTab ? deepTab : 'capture'}
            onSave={async (rec: any) => {
              await emitVital({
                type: 'temperature',
                recorded_at: rec.timestamp ?? new Date().toISOString(),
                deviceId: 'duecare.health-monitor',
                payload: { celsius: rec.celsius, fahrenheit: rec.fahrenheit, unit: 'C' },
                meta: { source: rec.raw?.simulated ? 'sim' : 'ble' },
              });
            }}
          />
        </Suspense>
      </div>

      {/* Glucose */}
      <div role="tabpanel" hidden={active !== 'glu'} id="panel-glu">
        <Suspense fallback={<SkeletonRow />}>
          <Glucose
            onSave={async (rec: any) => {
              await emitVital({
                type: 'blood_glucose',
                deviceId: 'duecare.health-monitor',
                recorded_at: rec.timestamp,
                payload: {
                  glucose: rec.glucose,
                  unit: rec.unit,
                  stripCode: rec.stripCode,
                  testType: rec.testType,
                  fasting: rec.fasting,
                  note: rec.note,
                },
                meta: { source: 'ble' },
              });
            }}
            initialHistory={[]}
          />
        </Suspense>
      </div>

      {/* ECG */}
      <div role="tabpanel" hidden={active !== 'ecg'} id="panel-ecg">
        <Suspense fallback={<SkeletonRow />}>
          <ECG
            onSave={async (rec: any) => {
              await emitVital({
                type: 'ecg',
                recorded_at: rec.timestamp ?? new Date().toISOString(),
                deviceId: 'duecare.health-monitor',
                payload: { durationSec: rec.durationSec, rhr: rec.rhr, summary: rec.rawSummary },
                meta: { source: 'ble' },
              });
            }}
            patientId={patientId}
          />
        </Suspense>
      </div>

      {/* HR */}
      <div role="tabpanel" hidden={active !== 'hr'} id="panel-hr">
        <Suspense fallback={<SkeletonRow />}>
          <HeartRate
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

/** ------------ PAGE ------------ */
export default function HealthMonitorPage() {
  const router = useRouter();
  const search = useSearchParams();
  const deepPanel = (search.get('panel') || '') as 'bp' | 'spo2' | 'temp' | 'glu' | 'hr' | 'ecg' | '';
  const deepTab = (search.get('vtab') || '') as 'capture' | 'history' | 'thresholds' | 'devices' | '';

  const patientId = 'patient-1111';
  const roomId = `room-${patientId}`;
  const [locale] = useState<string>(() => (typeof navigator !== 'undefined' ? navigator.language : 'en-ZA'));

  const [profile, setProfile] = useState<any>(null);
  const [vitalsSummary, setVitalsSummary] = useState<VitalsSummary | null>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);

  // Live-first with mock fallback for Overview
  async function refreshOverview() {
    const [p, v] = await Promise.all([
      getJSON<any>('/api/profile', { fallback: MOCK_PROFILE }),
      getJSON<VitalsSummary>('/api/vitals/summary', { fallback: MOCK_SUMMARY }),
    ]);
    setProfile(p || MOCK_PROFILE);
    setVitalsSummary(v || MOCK_SUMMARY);
    setLoadingProfile(false);
  }

  useEffect(() => {
    let mounted = true;
    refreshOverview().finally(() => mounted && setLoadingProfile(false));

    // light auto-refresh (every 60s)
    const id = setInterval(() => refreshOverview(), 60_000);
    return () => {
      clearInterval(id);
      mounted = false;
    };
  }, []);

  const [lastSeenMap] = useState<Record<string, number>>({});
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
        const last = lastSeenMap[key] ?? 0;
        if (now - last < 5000) return;
        lastSeenMap[key] = now;
      }
      try {
        const resp = await fetch(`/api/v1/patients/${encodeURIComponent(patientId)}/vitals`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ deviceId, patientId, recorded_at, type, payload, meta } ),
        });
        if (!resp.ok) console.warn('emitVital persist failed', resp.status);
      } catch {}
      try {
        await fetch('/api/iomt/push', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            roomId,
            type,
            value: payload.value ?? payload.hr ?? payload.spo2 ?? payload.glucose ?? null,
            unit: payload.unit ?? (payload.u as any) ?? null,
          }),
        });
      } catch {}
    },
    [patientId, roomId, lastSeenMap]
  );
  const ctxVal = useMemo(() => ({ patientId, roomId, emitVital }), [patientId, roomId, emitVital]);

  const [tab, setTab] = useState<'overview' | 'vitals' | 'analytics' | 'reports'>(
    ((search.get('t') as any) || 'overview')
  );
  useEffect(() => {
    const qp = new URLSearchParams(search.toString());
    qp.set('t', tab);
    router.replace(`?${qp.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const [alertsOpen, setAlertsOpen] = useState<boolean>(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  /** Device telemetry (header pills) */
  const [devices, setDevices] = useState<DeviceInfo[]>([
    { id: 'duecare-health-monitor', name: 'HealthMonitor-001', transport: 'ble', connected: true, batteryPct: null, rssi: null },
  ]);
  const upsertDevice = useCallback((patch: Partial<DeviceInfo> & { id: string }) => {
    setDevices((curr) => {
      const idx = curr.findIndex((d) => d.id === patch.id);
      if (idx === -1)
        return [
          ...curr,
          { id: patch.id, name: patch.id, transport: 'ble', connected: true, batteryPct: null, rssi: null, ...patch },
        ];
      const next = curr.slice();
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }, []);
  useEffect(() => {
    function onTelemetry(e: Event) {
      const detail = (e as CustomEvent).detail as Partial<DeviceInfo> & { id: string };
      if (!detail?.id) return;
      upsertDevice(detail);
    }
    window.addEventListener('iomt:telemetry' as any, onTelemetry as any);
    return () => window.removeEventListener('iomt:telemetry' as any, onTelemetry as any);
  }, [upsertDevice]);
  const hm = devices.find((d) => d.id === 'duecare-health-monitor');

  const { push: pushToast, Toasts } = useToasts();
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

  // Overview series with safe defaults
  const hrSeries = vitalsSummary?.hr24 ?? MOCK_SUMMARY.hr24!;
  const spo2Series = vitalsSummary?.spo224 ?? MOCK_SUMMARY.spo224!;
  const bpSeries = vitalsSummary?.bp24 ?? MOCK_SUMMARY.bp24!;
  const tempSeries = vitalsSummary?.temp24 ?? MOCK_SUMMARY.temp24!;
  const gluSeries = vitalsSummary?.glu24 ?? MOCK_SUMMARY.glu24!;

  /** Today timeline (live with mock fallback) */
  const [today, setToday] = useState<TodayItem[]>([]);
  async function refreshTodayAndAlerts() {
    const recent = await getJSON<{ items?: any[] }>('/api/vitals/recent?since=today', { fallback: { items: [] } });
    const items: TodayItem[] = (recent.items || []).slice(0, 8).map((it: any) => ({
      t: new Date(it.timestamp || it.t || Date.now()).toLocaleTimeString(),
      label: it.label || it.type || 'Reading',
      route: `?t=vitals&panel=${it.panel || it.type || 'bp'}&vtab=history`,
    }));
    setToday(items.length ? items : MOCK_TODAY);

    const alertRes = await getJSON<{ items?: AlertItem[] }>('/api/alerts/active', { fallback: { items: [] } });
    setAlerts(alertRes.items && alertRes.items.length ? alertRes.items : MOCK_ALERTS);
  }
  useEffect(() => {
    refreshTodayAndAlerts();
    const id = setInterval(() => refreshTodayAndAlerts(), 60_000);
    return () => clearInterval(id);
  }, []);

  /** Deep link: default active vital tab */
  const [activeVital, setActiveVital] = useState<'bp' | 'spo2' | 'temp' | 'glu' | 'hr' | 'ecg'>(deepPanel || 'bp');
  useEffect(() => {
    if (deepPanel && deepPanel !== activeVital) setActiveVital(deepPanel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepPanel]);

  const setActiveVitalAndUpdateUrl = useCallback(
    (k: 'bp' | 'spo2' | 'temp' | 'glu' | 'hr' | 'ecg') => {
      setActiveVital(k);
      const qp = new URLSearchParams(search.toString());
      qp.set('t', 'vitals');
      qp.set('panel', k);
      router.replace(`?${qp.toString()}`, { scroll: false });
      (document.querySelector('main') as HTMLElement | null)?.scrollTo?.({ top: 0, behavior: 'smooth' });
    },
    [router, search]
  );

  /** Tone helpers for tiles */
  const spo2Tone = (v: number | undefined) => (v ?? 100) < 92 ? 'red' : 'slate';
  const gluTone = (v: number | null | undefined, unit?: string | null) => {
    if (v == null) return 'slate' as const;
    const mg = unit === 'mmol/L' ? mmolToMgdl(v) : v;
    if (mg < GLU.hypo) return 'red' as const;
    if (mg > GLU.targetMax) return 'amber' as const;
    return 'slate' as const;
  };

  return (
    <VitalsContext.Provider value={ctxVal}>
      <StickyHeader
        profile={profile ?? MOCK_PROFILE}
        patientId={profile?.patientId ?? patientId}
        lastSyncHuman={vitalsSummary?.lastSyncHuman ?? MOCK_SUMMARY.lastSyncHuman}
        onExport={() => setTab('reports')}
        onShare={shareSummary}
        onOpenAlerts={() => setAlertsOpen(true)}
        tab={tab}
        setTab={setTab}
        devices={devices}
      />

      <main className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
        {/* OVERVIEW — at a glance (tiles are “Latest @ time”) */}
        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <KPIStat
                label="Heart Rate"
                value={<span>{vitalsSummary?.hrNow ?? MOCK_SUMMARY.hrNow} bpm</span>}
                hint={`Latest • ${fmtTime(vitalsSummary?.hrTs ?? MOCK_SUMMARY.hrTs)}`}
                series={hrSeries}
              />
              <KPIStat
                label="SpO₂"
                value={<span>{vitalsSummary?.spo2Now ?? MOCK_SUMMARY.spo2Now}%</span>}
                hint={`Latest • ${fmtTime(vitalsSummary?.spo2Ts ?? MOCK_SUMMARY.spo2Ts)}`}
                series={spo2Series}
                tone={spo2Tone(vitalsSummary?.spo2Now ?? MOCK_SUMMARY.spo2Now)}
              />
              <KPIStat
                label="Blood Pressure"
                value={
                  <span>
                    {vitalsSummary?.bpNow
                      ? `${vitalsSummary.bpNow.s}/${vitalsSummary.bpNow.d}`
                      : MOCK_SUMMARY.bpNow
                      ? `${MOCK_SUMMARY.bpNow.s}/${MOCK_SUMMARY.bpNow.d}`
                      : '—'}{' '}
                    mmHg
                  </span>
                }
                hint={`Latest • ${fmtTime(vitalsSummary?.bpTs ?? MOCK_SUMMARY.bpTs)}`}
                series={bpSeries}
              />
              <KPIStat
                label="Temperature"
                value={<span>{vitalsSummary?.tempNow ?? MOCK_SUMMARY.tempNow}°C</span>}
                hint={`Latest • ${fmtTime(vitalsSummary?.tempTs ?? MOCK_SUMMARY.tempTs)}`}
                series={tempSeries}
              />
              <KPIStat
                label="Glucose"
                value={
                  <span>
                    {vitalsSummary?.gluNow ?? MOCK_SUMMARY.gluNow}{' '}
                    {vitalsSummary?.gluUnit ?? MOCK_SUMMARY.gluUnit}
                  </span>
                }
                hint={`Latest • ${fmtTime(vitalsSummary?.gluTs ?? MOCK_SUMMARY.gluTs)}`}
                series={gluSeries}
                tone={gluTone(vitalsSummary?.gluNow ?? MOCK_SUMMARY.gluNow, vitalsSummary?.gluUnit ?? MOCK_SUMMARY.gluUnit)}
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
                      <div className={cn('h-2 w-2 rounded-full mt-1',
                        a.level === 'red' ? 'bg-red-500' : 'bg-amber-500')} />
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

        {/* VITALS — mount-once tabbed capture */}
        {tab === 'vitals' && (
          <TabbedVitals
            active={activeVital}
            setActive={setActiveVitalAndUpdateUrl}
            deepTab={deepTab || ''}
            patientId={patientId}
            hm={{ batteryPct: hm?.batteryPct ?? null, rssi: hm?.rssi ?? null }}
            emitVital={emitVital}
          />
        )}

        {/* ANALYTICS — cross-vital trends + ECG + Glucose */}
        {tab === 'analytics' && (
          <AnalyticsDashboard patientId={patientId} />
        )}

        {/* REPORTS — composer + saved exports + help */}
        {tab === 'reports' && (
          <>
            <ExportComposer patient={profile ?? MOCK_PROFILE} vitalsSummary={vitalsSummary ?? MOCK_SUMMARY} onAfterDownload={() => {}} />
            <SavedExports patientId={(profile?.patientId ?? MOCK_PROFILE.patientId) as string} />
          </>
        )}

        <div aria-live="polite" className="sr-only">
          Current locale {locale}. Patient {profile?.name ?? MOCK_PROFILE.name}. Room {roomId}.
        </div>
      </main>

      {/* Alerts & Toasts */}
      <AlertDrawer open={alertsOpen} onClose={() => setAlertsOpen(false)} items={alerts} />
      <Toasts />
    </VitalsContext.Provider>
  );
}
