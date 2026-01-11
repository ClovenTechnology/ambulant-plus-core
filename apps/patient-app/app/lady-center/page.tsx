// apps/patient-app/app/lady-center/page.tsx
'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Baby,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FileText,
  Settings,
  X,
} from 'lucide-react';

import { FertilitySetup } from '@/src/screens/FertilitySetup';
import { generateHealthReport } from '@/src/analytics/report';
import {
  predictCycleDates,
  type FertilityPrefs,
  type WearablePoint,
  detectPregnancy,
} from '@/src/analytics/prediction';
import { buildFertilityICSUrlFromPrefs } from '@/src/analytics/ics';
import { track } from '@/src/lib/analytics';

// ✅ NEW imports (Lady Center extracted components)
import TodaySummaryCard from '@/components/lady-center/TodaySummaryCard';
import InsightFeed from '@/components/lady-center/InsightFeed';
import ScreeningChecklist from '@/components/lady-center/ScreeningChecklist';
import DocumentsFolder from '@/components/lady-center/DocumentsFolder';
import CarePathFlow from '@/components/lady-center/CarePathFlow';

import type { InsightCoreInsight } from '@/src/lib/insightcore/api';

import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

/* =========================================================
   Types
========================================================= */

type LadyMode = 'cycle' | 'symptoms' | 'pregnancy' | 'menopause';
type BannerKind = 'info' | 'success' | 'error';
type DocTag = 'Gynae' | 'Labs' | 'Imaging' | 'Rx' | 'Notes';

type LadyProfile = {
  mode: LadyMode;
  trackCycle: boolean;
  trackSymptoms: boolean;
  trackVitals: boolean;
  remindScreening: boolean;
  createdAtISO: string;
};

type ScreeningItem = {
  key: string;
  title: string;
  desc: string;
  cadence: string;
  lastDoneISO?: string | null;
  nextDueISO?: string | null;
  status: 'due' | 'ok' | 'overdue' | 'unknown';
};

type LadyDoc = {
  id: string;
  title: string;
  tag: DocTag;
  createdISO: string;
  fileName?: string;
};

type SymptomChoice =
  | 'cramps'
  | 'headache'
  | 'fatigue'
  | 'mood'
  | 'acne'
  | 'bloating'
  | 'nausea'
  | 'tenderness'
  | 'migraine'
  | 'hot_flashes'
  | 'sleep';

type CyclePhase = 'follicular' | 'luteal' | 'ovulation' | 'period';

type CycleDay = {
  date: string; // YYYY-MM-DD
  phase: CyclePhase;
  fertileWindow?: boolean;
  deltaTemp: number;
  rhr?: number;
  hrv?: number;
  respRate?: number;
  spo2?: number;
  sleepScore?: number;
  predicted?: boolean;
};

type DayLog = {
  date: string; // YYYY-MM-DD
  period?: boolean; // start marker
  ovulation?: boolean;
  pregnancyTestPositive?: boolean;
  meds?: string;
  notes?: string;
  symptoms?: SymptomChoice[];
};

type LadyServerState = {
  profile: LadyProfile | null;
  docs: LadyDoc[];
  notes: { id: string; text: string; createdISO: string }[];
  screening: Record<string, { lastDoneISO?: string | null }>;
  dayLogs: Record<string, DayLog>;
  updatedAtISO?: string | null;
};

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { message?: string; code?: string };
};

/* =========================================================
   Storage keys (keeps backward compat with the “old” file)
========================================================= */

const LS = {
  // new page controls
  discreet: 'ambulant.lady.discreet',
  profile: 'ambulant.lady.profile.v2',
  docs: 'ambulant.lady.docs.v2',
  screening: 'ambulant.lady.screening.v2',
  notes: 'ambulant.lady.notes.v2',
  daylogs: 'ambulant.lady.daylogs.v2',

  // chart prefs
  windowDays: 'ladyCenter:windowDays',
  series: 'ladyCenter:series',

  // pregnancy banner dismiss
  pregDismiss: 'ladyCenter:pregnancy:dismissedAt',

  // legacy (read-only migration fallback)
  legacyDaylogs: 'fertilityDayLogs',
};

/* =========================================================
   API endpoints (adjust here if your gateway routes differ)
========================================================= */

const LADY_API = {
  // Load everything in one call (recommended)
  state: '/api/lady-center/state', // GET -> LadyServerState, PUT -> LadyServerState

  // Optional granular endpoints (we try these first when saving)
  profile: '/api/lady-center/profile', // PUT { profile }
  dayLogsUpsert: '/api/lady-center/daylogs', // POST { log }
  notes: '/api/lady-center/notes', // POST { note } | DELETE { id }
  documents: '/api/lady-center/documents', // POST { doc } | DELETE { id }
  screening: '/api/lady-center/screening', // POST { key, lastDoneISO }
  reminders: '/api/reminders', // POST reminder requests
  reportPdf: '/api/reports/lady-center', // GET (pdf blob) OR POST (generate)
};

/* =========================================================
   Utils
========================================================= */

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function safeJsonParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function nowISO() {
  return new Date().toISOString();
}

function addDaysISO(baseISO: string, days: number) {
  const d = new Date(baseISO);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function formatNiceDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

function formatNiceTime(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function modeLabel(mode: LadyMode) {
  switch (mode) {
    case 'cycle':
      return 'Cycle Tracking';
    case 'symptoms':
      return 'Symptoms Only';
    case 'pregnancy':
      return 'Pregnancy';
    case 'menopause':
      return 'Peri/Menopause';
  }
}

function neutralize(label: string, discreet: boolean) {
  if (!discreet) return label;
  if (/period|bleeding/i.test(label)) return 'Tracking window';
  if (/fertile|ovulation/i.test(label)) return 'Timing window';
  if (/pregnan/i.test(label)) return 'Health mode';
  if (/menopause/i.test(label)) return 'Health mode';
  return label;
}

function loadPrefsClient(): FertilityPrefs | null {
  try {
    const raw = localStorage.getItem('fertilityPrefs');
    return raw ? (JSON.parse(raw) as FertilityPrefs) : null;
  } catch {
    return null;
  }
}

/** tiny deterministic-ish pseudo random for stable demo */
function seeded(seed: number) {
  let x = seed || 1234567;
  return () => {
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    return ((x >>> 0) % 10000) / 10000;
  };
}

function guessTag(fileName: string): DocTag {
  const f = fileName.toLowerCase();
  if (f.includes('ultra') || f.includes('scan') || f.includes('xray') || f.includes('mri')) return 'Imaging';
  if (f.includes('rx') || f.includes('prescrip') || f.includes('med')) return 'Rx';
  if (f.includes('lab') || f.includes('cbc') || f.includes('hpv') || f.includes('horm') || f.includes('iron')) return 'Labs';
  if (f.includes('note')) return 'Notes';
  return 'Gynae';
}

function defaultProfile(mode: LadyMode = 'cycle'): LadyProfile {
  return {
    mode,
    trackCycle: mode === 'cycle',
    trackSymptoms: true,
    trackVitals: true,
    remindScreening: true,
    createdAtISO: nowISO(),
  };
}

function demoDocs(): LadyDoc[] {
  const t = nowISO();
  return [
    { id: uid('doc'), title: 'CBC + Iron panel', fileName: 'labs_cbc_iron.pdf', tag: 'Labs', createdISO: addDaysISO(t, -18) },
    { id: uid('doc'), title: 'Pelvic ultrasound', fileName: 'imaging_ultrasound.jpg', tag: 'Imaging', createdISO: addDaysISO(t, -32) },
    { id: uid('doc'), title: 'Prescription summary', fileName: 'rx_summary.pdf', tag: 'Rx', createdISO: addDaysISO(t, -7) },
    { id: uid('doc'), title: 'Clinician note', fileName: 'gynae_note.pdf', tag: 'Notes', createdISO: addDaysISO(t, -3) },
  ];
}

/* =========================================================
   API helpers (safe envelopes + graceful fallbacks)
========================================================= */

function unwrapEnvelope<T>(x: any): T {
  if (x && typeof x === 'object' && 'ok' in x) {
    const env = x as ApiEnvelope<T>;
    if (env.ok) return (env.data ?? (null as any)) as T;
    throw new Error(env.error?.message || 'Request failed');
  }
  return x as T;
}

async function fetchJson<T>(url: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const timeoutMs = init?.timeoutMs ?? 15000;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      signal: init?.signal ?? ctrl.signal,
      headers: {
        ...(init?.headers ?? {}),
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });

    const text = await res.text();
    const data = text ? safeJsonParse<any>(text) : null;

    if (!res.ok) {
      const msg = data?.error?.message || data?.message || res.statusText || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return unwrapEnvelope<T>(data ?? ({} as any));
  } finally {
    clearTimeout(t);
  }
}

async function fetchBlob(url: string, init?: RequestInit & { timeoutMs?: number }): Promise<Blob> {
  const timeoutMs = init?.timeoutMs ?? 25000;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      signal: init?.signal ?? ctrl.signal,
      headers: { ...(init?.headers ?? {}), Accept: 'application/pdf' },
    });
    if (!res.ok) throw new Error(res.statusText || `HTTP ${res.status}`);
    return await res.blob();
  } finally {
    clearTimeout(t);
  }
}

async function apiTry<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Request failed' };
  }
}

/* =========================================================
   UI primitives
========================================================= */

function Pill({
  children,
  tone = 'slate',
}: {
  children: React.ReactNode;
  tone?: 'slate' | 'blue' | 'emerald' | 'amber' | 'rose' | 'violet';
}) {
  const toneCls =
    tone === 'blue'
      ? 'bg-blue-50 text-blue-700 ring-blue-200'
      : tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : tone === 'amber'
      ? 'bg-amber-50 text-amber-800 ring-amber-200'
      : tone === 'rose'
      ? 'bg-rose-50 text-rose-700 ring-rose-200'
      : tone === 'violet'
      ? 'bg-violet-50 text-violet-700 ring-violet-200'
      : 'bg-slate-50 text-slate-700 ring-slate-200';
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ring-1', toneCls)}>
      {children}
    </span>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200/70 bg-white/70 shadow-[0_1px_0_rgba(15,23,42,0.04),0_18px_45px_rgba(2,6,23,0.07)] backdrop-blur',
        className
      )}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        {subtitle ? <div className="mt-0.5 text-xs text-slate-600">{subtitle}</div> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

function Modal({
  open,
  title,
  subtitle,
  children,
  onClose,
  footer,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      ref.current?.querySelector<HTMLElement>('[data-autofocus="1"]')?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-slate-950/40"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          ref={ref}
          className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          role="dialog"
          aria-modal="true"
        >
          <div className="border-b px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold text-slate-900">{title}</div>
                {subtitle ? <div className="mt-0.5 text-sm text-slate-600">{subtitle}</div> : null}
              </div>
              <button
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={onClose}
                aria-label="Close"
              >
                Close
              </button>
            </div>
          </div>
          <div className="max-h-[75vh] overflow-auto px-5 py-4">{children}</div>
          {footer ? <div className="border-t px-5 py-4">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

function RevealOverlay({ onReveal }: { onReveal: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-2xl">
      <button className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow hover:bg-slate-800" onClick={onReveal}>
        Tap to reveal
      </button>
    </div>
  );
}

function LegendBadge({ symbol, text }: { symbol: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50">
      <span>{symbol}</span>
      <span className="text-slate-700">{text}</span>
    </span>
  );
}

/* =========================================================
   Page
========================================================= */

const SYMPTOM_CHOICES: SymptomChoice[] = [
  'cramps',
  'headache',
  'fatigue',
  'mood',
  'acne',
  'bloating',
  'nausea',
  'tenderness',
  'migraine',
  'hot_flashes',
  'sleep',
];

export default function LadyCenterPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [banner, setBanner] = useState<{ kind: BannerKind; text: string } | null>(null);

  const [discreet, setDiscreet] = useState(false);
  const [revealUntil, setRevealUntil] = useState<number>(0);

  const [profile, setProfile] = useState<LadyProfile | null>(null);

  const [docs, setDocs] = useState<LadyDoc[]>([]);
  const [notes, setNotes] = useState<{ id: string; text: string; createdISO: string }[]>([]);
  const [screening, setScreening] = useState<Record<string, { lastDoneISO?: string | null }>>({});
  const [dayLogs, setDayLogs] = useState<Record<string, DayLog>>({});
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const [openSettings, setOpenSettings] = useState(false);
  const [openSetup, setOpenSetup] = useState(false);
  const [openAddNote, setOpenAddNote] = useState(false);
  const [openCarePath, setOpenCarePath] = useState<null | { key: string; title: string; desc: string }>(null);

  // cycle panels
  const [showChart, setShowChart] = useState(true);
  const [showCalendar, setShowCalendar] = useState(true);
  const [showReport, setShowReport] = useState(false);

  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [windowDays, setWindowDays] = useState<14 | 28 | 90>(28);
  const [visibleSeries, setVisibleSeries] = useState<Record<string, boolean>>({
    deltaTemp: true,
    rhr: true,
    hrv: false,
    respRate: false,
    spo2: false,
    sleepScore: false,
  });

  // PDF report
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const pdfObjectUrlRef = useRef<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // ICS subscribe toast
  const [toastOpen, setToastOpen] = useState(false);
  const [toastCopied, setToastCopied] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // pregnancy banner dismiss
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  // server sync status
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle');
  const [syncHint, setSyncHint] = useState<string>('');
  const serverHydratedRef = useRef(false);
  const lastRemoteUpdatedAtRef = useRef<string | null>(null);
  const lastPushAtRef = useRef<number>(0);

  const sensitiveHidden = discreet && Date.now() > revealUntil;

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const prefs: FertilityPrefs | null = useMemo(() => (mounted ? loadPrefsClient() : null), [mounted]);

  function showBanner(kind: BannerKind, text: string) {
    setBanner({ kind, text });
    window.setTimeout(() => setBanner(null), 3200);
  }

  function revealSensitive(seconds = 30) {
    setRevealUntil(Date.now() + seconds * 1000);
    track('lady_discreet_reveal', { seconds });
  }

  // ---- Load local state + migrate legacy day logs
  useEffect(() => {
    if (!mounted) return;

    try {
      const d = localStorage.getItem(LS.discreet);
      setDiscreet(d === '1');
    } catch {}

    const p = safeJsonParse<LadyProfile>(localStorage.getItem(LS.profile));
    setProfile(p);

    const dd = safeJsonParse<LadyDoc[]>(localStorage.getItem(LS.docs));
    setDocs(dd ?? demoDocs());

    const nn = safeJsonParse<{ id: string; text: string; createdISO: string }[]>(localStorage.getItem(LS.notes));
    setNotes(nn ?? []);

    const ss = safeJsonParse<Record<string, { lastDoneISO?: string | null }>>(localStorage.getItem(LS.screening));
    setScreening(ss ?? {});

    // day logs (new -> fallback old)
    const dlNew = safeJsonParse<Record<string, DayLog>>(localStorage.getItem(LS.daylogs));
    if (dlNew) {
      setDayLogs(dlNew);
    } else {
      const legacy = safeJsonParse<Record<string, DayLog>>(localStorage.getItem(LS.legacyDaylogs));
      if (legacy) {
        setDayLogs(legacy);
        try {
          localStorage.setItem(LS.daylogs, JSON.stringify(legacy));
        } catch {}
      }
    }

    // chart prefs
    try {
      const w = localStorage.getItem(LS.windowDays);
      if (w && ['14', '28', '90'].includes(w)) setWindowDays(Number(w) as 14 | 28 | 90);
      const s = localStorage.getItem(LS.series);
      if (s) setVisibleSeries((prev) => ({ ...prev, ...(safeJsonParse<Record<string, boolean>>(s) ?? {}) }));
    } catch {}

    // pregnancy dismiss
    try {
      const ds = localStorage.getItem(LS.pregDismiss);
      if (ds) setDismissedAt(Number(ds));
    } catch {}
  }, [mounted]);

  // ---- Remote hydrate (best-effort; never breaks demo)
  useEffect(() => {
    if (!mounted) return;

    const ac = new AbortController();

    const hydrate = async () => {
      setSyncState('syncing');
      setSyncHint('Loading from server…');

      const r = await apiTry(async () => {
        const st = await fetchJson<LadyServerState>(LADY_API.state, { method: 'GET', signal: ac.signal, timeoutMs: 12000 });
        return st;
      });

      if (!r.ok) {
        setSyncState('error');
        setSyncHint('Offline mode');
        return;
      }

      const remote = r.data;

      // Avoid noisy overrides if server returns nothing during early setup
      const remoteSeemsEmpty =
        !remote ||
        (!remote.profile &&
          (!remote.docs || remote.docs.length === 0) &&
          (!remote.notes || remote.notes.length === 0) &&
          (!remote.dayLogs || Object.keys(remote.dayLogs).length === 0) &&
          (!remote.screening || Object.keys(remote.screening).length === 0));

      if (!remoteSeemsEmpty) {
        setProfile(remote.profile ?? null);
        setDocs(Array.isArray(remote.docs) ? remote.docs : []);
        setNotes(Array.isArray(remote.notes) ? remote.notes : []);
        setScreening(remote.screening ?? {});
        setDayLogs(remote.dayLogs ?? {});

        // mirror into localStorage for offline resilience
        try {
          localStorage.setItem(LS.profile, JSON.stringify(remote.profile ?? null));
          localStorage.setItem(LS.docs, JSON.stringify(remote.docs ?? []));
          localStorage.setItem(LS.notes, JSON.stringify(remote.notes ?? []));
          localStorage.setItem(LS.screening, JSON.stringify(remote.screening ?? {}));
          localStorage.setItem(LS.daylogs, JSON.stringify(remote.dayLogs ?? {}));
          localStorage.setItem(LS.legacyDaylogs, JSON.stringify(remote.dayLogs ?? {}));
        } catch {}
      }

      serverHydratedRef.current = true;
      lastRemoteUpdatedAtRef.current = remote.updatedAtISO ?? null;

      setSyncState('ok');
      setSyncHint('Synced');
    };

    hydrate();

    return () => ac.abort();
  }, [mounted]);

  // ---- local persistence
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(LS.discreet, discreet ? '1' : '0');
    } catch {}
  }, [discreet, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      if (profile) localStorage.setItem(LS.profile, JSON.stringify(profile));
      else localStorage.removeItem(LS.profile);
    } catch {}
  }, [profile, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(LS.docs, JSON.stringify(docs));
    } catch {}
  }, [docs, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(LS.notes, JSON.stringify(notes));
    } catch {}
  }, [notes, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(LS.screening, JSON.stringify(screening));
    } catch {}
  }, [screening, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(LS.daylogs, JSON.stringify(dayLogs));
      // keep legacy up to date to avoid regressions for any other page still reading it
      localStorage.setItem(LS.legacyDaylogs, JSON.stringify(dayLogs));
    } catch {}
  }, [dayLogs, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(LS.windowDays, String(windowDays));
      localStorage.setItem(LS.series, JSON.stringify(visibleSeries));
    } catch {}
  }, [windowDays, visibleSeries, mounted]);

  // ---- Server push: profile changes (debounced)
  useEffect(() => {
    if (!mounted) return;
    if (!serverHydratedRef.current) return;

    const t = setTimeout(async () => {
      const now = Date.now();
      if (now - lastPushAtRef.current < 500) return;

      lastPushAtRef.current = now;
      await apiTry(async () => {
        await fetchJson(LADY_API.profile, {
          method: 'PUT',
          body: JSON.stringify({ profile }),
          timeoutMs: 12000,
        });
      });
    }, 550);

    return () => clearTimeout(t);
  }, [profile, mounted]);

  // ---- Prediction from prefs (real logic hook-in)
  const prediction = useMemo(() => {
    if (!mounted) return null;
    // uses prefs from FertilitySetup if present
    return predictCycleDates(prefs, todayISO, { useLogs: true });
  }, [mounted, prefs, todayISO]);

  // ---- Build history series (demo data, but aligned with old file + prediction window tinting)
  const history: CycleDay[] = useMemo(() => {
    const rnd = seeded(1337);
    const today = new Date();
    const days = 90;
    const start = new Date(today);
    start.setDate(today.getDate() - (days - 1));

    const cycleLen = clamp(Math.floor(rnd() * 6) + 26, 22, 35);
    const ovDay = clamp(Math.floor(cycleLen * 0.54), 11, 19);

    const out: CycleDay[] = Array.from({ length: days }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = d.toISOString().slice(0, 10);

      const dayInCycle = (i % cycleLen) + 1;
      const phase: CyclePhase =
        dayInCycle <= 5 ? 'period' : dayInCycle === ovDay ? 'ovulation' : dayInCycle < ovDay ? 'follicular' : 'luteal';

      const lutealBoost = phase === 'luteal' ? 0.35 : 0;
      const ovBoost = phase === 'ovulation' ? 0.15 : 0;
      const deltaTemp = (rnd() - 0.5) * 0.15 + lutealBoost + ovBoost;

      const rhr = clamp(60 + (rnd() - 0.5) * 6 + (phase === 'luteal' ? 4 : 0), 48, 96);
      const hrv = clamp(70 + (rnd() - 0.5) * 10 + (phase === 'ovulation' ? -6 : 0), 18, 130);
      const respRate = clamp(16 + (rnd() - 0.5) * 1.2 + (phase === 'luteal' ? 0.8 : 0), 12, 22);
      const spo2 = clamp(98 + (rnd() - 0.5) * 1.0 + (phase === 'luteal' ? -0.6 : 0), 92, 100);
      const sleepScore = clamp(85 + (rnd() - 0.5) * 8 + (phase === 'ovulation' ? -4 : 0), 40, 100);

      return {
        date: iso,
        phase,
        fertileWindow: false,
        deltaTemp: Math.round(deltaTemp * 100) / 100,
        rhr: Math.round(rhr),
        hrv: Math.round(hrv),
        respRate: Math.round(respRate * 10) / 10,
        spo2: Math.round(spo2),
        sleepScore: Math.round(sleepScore),
        predicted: false,
      };
    });

    // fertile window around ovulation (demo)
    const idxs = out.map((d) => d.phase).reduce<number[]>((acc, ph, idx) => {
      if (ph === 'ovulation') acc.push(idx);
      return acc;
    }, []);
    for (const ovIdx of idxs) {
      for (let i = Math.max(0, ovIdx - 5); i <= ovIdx; i++) out[i]!.fertileWindow = true;
    }

    // prediction tinting (if prefs exist)
    if (prediction) {
      out.forEach((d) => {
        if (d.date >= prediction.fertileStart && d.date <= prediction.fertileEnd) d.predicted = true;
      });
    }

    // apply explicit user logs (period/ovulation overrides symbols, but we keep phase as context)
    out.forEach((d) => {
      const log = dayLogs[d.date];
      if (log?.period) d.phase = 'period';
      if (log?.ovulation) {
        d.phase = 'ovulation';
        d.fertileWindow = true;
      }
    });

    return out;
  }, [prediction, dayLogs]);

  // ---- WearablePoint[] from history
  const wearableSeries: WearablePoint[] = useMemo(() => {
    return history.map((h) => ({
      date: h.date,
      deltaTemp: h.deltaTemp,
      rhr: h.rhr,
      hrv: h.hrv,
      spo2: h.spo2,
    }));
  }, [history]);

  // ---- Pregnancy signal
  const preg = useMemo(() => detectPregnancy(prefs, wearableSeries), [prefs, wearableSeries]);

  const showPregnancyBanner = useMemo(() => {
    if (!mounted) return false;
    if (preg.status === 'unlikely') return false;
    if (!dismissedAt) return true;
    const daysSince = (Date.now() - dismissedAt) / 86400000;
    return daysSince > 7;
  }, [mounted, preg.status, dismissedAt]);

  const dismissPregnancyBanner = () => {
    const now = Date.now();
    setDismissedAt(now);
    try {
      localStorage.setItem(LS.pregDismiss, String(now));
    } catch {}
    track('pregnancy_dismiss', { status: preg.status });
  };

  // ---- Chart data
  const trimmedHistory = useMemo(() => history.slice(-windowDays), [history, windowDays]);

  const chartData = useMemo(() => {
    const labels = trimmedHistory.map((h) => h.date.slice(5));
    const ds: any[] = [];

    if (visibleSeries.deltaTemp) ds.push({ label: 'ΔTemp (°C)', data: trimmedHistory.map((h) => h.deltaTemp), yAxisID: 'y' });
    if (visibleSeries.rhr) ds.push({ label: 'Resting HR (bpm)', data: trimmedHistory.map((h) => h.rhr), yAxisID: 'y1' });
    if (visibleSeries.hrv) ds.push({ label: 'HRV (ms)', data: trimmedHistory.map((h) => h.hrv), yAxisID: 'y1' });
    if (visibleSeries.respRate) ds.push({ label: 'Resp Rate', data: trimmedHistory.map((h) => h.respRate), yAxisID: 'y1' });
    if (visibleSeries.spo2) ds.push({ label: 'SpO₂ (%)', data: trimmedHistory.map((h) => h.spo2), yAxisID: 'y1' });
    if (visibleSeries.sleepScore) ds.push({ label: 'Sleep Score', data: trimmedHistory.map((h) => h.sleepScore), yAxisID: 'y1' });

    return { labels, datasets: ds };
  }, [trimmedHistory, visibleSeries]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false as const,
      plugins: {
        legend: { position: 'top' as const },
        tooltip: { intersect: false as const, mode: 'index' as const },
      },
      scales: {
        y: { type: 'linear' as const, position: 'left' as const, title: { display: true, text: 'ΔTemp (°C)' } },
        y1: { type: 'linear' as const, position: 'right' as const, grid: { drawOnChartArea: false } },
      },
    }),
    []
  );

  // ---- Calendar build
  const firstDay = useMemo(() => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1), [currentMonth]);
  const lastDay = useMemo(() => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0), [currentMonth]);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay();
  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const calendarCells = useMemo(() => {
    const cells: React.ReactNode[] = [];
    for (let pad = 0; pad < startWeekday; pad++) cells.push(<div key={`pad-${pad}`} className="h-16 sm:h-20 rounded-xl" />);

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
      const iso = d.toISOString().slice(0, 10);
      const cd = history.find((h) => h.date === iso);
      const log = dayLogs[iso];

      const symbols: string[] = [];
      let ring = '';

      if (log?.period) symbols.push('💧');
      else if (cd) {
        if (cd.phase === 'period') symbols.push('💧');
        if (cd.phase === 'follicular') symbols.push('🟦');
        if (cd.phase === 'luteal') symbols.push('🔴');
        if (cd.phase === 'ovulation') symbols.push('⭐');
        if (cd.fertileWindow) symbols.push('🌿');
      }
      if (log?.ovulation && !symbols.includes('⭐')) symbols.push('⭐');
      if (log?.pregnancyTestPositive) symbols.push('🧪');

      if (cd?.predicted) ring = 'ring-1 ring-dashed ring-emerald-500';

      let bg = 'bg-slate-50';
      if (log?.period) bg = 'bg-rose-100';
      else if (cd?.fertileWindow) bg = 'bg-emerald-100';
      else if (cd?.phase === 'ovulation') bg = 'bg-emerald-200';
      else if (cd?.phase === 'follicular') bg = 'bg-blue-100';
      else if (cd?.phase === 'luteal') bg = 'bg-amber-100';

      const isToday = iso === todayISO ? 'outline outline-1 outline-rose-500/60' : '';

      cells.push(
        <button
          key={iso}
          className={cn(
            'h-16 sm:h-20 rounded-xl border border-slate-200 p-2 text-xs cursor-pointer transition hover:scale-[1.01] text-left',
            bg,
            ring,
            isToday,
            sensitiveHidden ? 'blur-sm select-none' : ''
          )}
          onClick={() => setSelectedDay(iso)}
          aria-label={`Open log for ${iso}`}
        >
          <div className="flex items-center justify-between">
            <div className="font-semibold">{i}</div>
            <div className="flex gap-1">
              {symbols.length ? symbols.map((s, idx) => <span key={idx}>{s}</span>) : <span className="text-slate-400">◌</span>}
            </div>
          </div>
          {log?.notes ? <div className="mt-1 line-clamp-2 text-[10px] opacity-70">📝 {log.notes}</div> : null}
        </button>
      );
    }
    return cells;
  }, [startWeekday, daysInMonth, currentMonth, history, dayLogs, sensitiveHidden, todayISO]);

  const selectedLog: DayLog | null = useMemo(() => {
    if (!selectedDay) return null;
    return dayLogs[selectedDay] ?? { date: selectedDay };
  }, [selectedDay, dayLogs]);

  const persistDayLog = useCallback(async (log: DayLog) => {
    if (!serverHydratedRef.current) return;

    // Try granular endpoint first
    const r = await apiTry(async () => {
      await fetchJson(LADY_API.dayLogsUpsert, { method: 'POST', body: JSON.stringify({ log }), timeoutMs: 12000 });
    });

    if (r.ok) return;

    // Fallback: push full state
    await apiTry(async () => {
      const state: LadyServerState = {
        profile,
        docs,
        notes,
        screening,
        dayLogs: { ...dayLogs, [log.date]: log },
        updatedAtISO: nowISO(),
      };
      await fetchJson(LADY_API.state, { method: 'PUT', body: JSON.stringify(state), timeoutMs: 15000 });
    });
  }, [dayLogs, docs, notes, profile, screening]);

  function saveLog(log: DayLog) {
    setDayLogs((prev) => ({ ...prev, [log.date]: log }));
    track('lady_daylog_save', { date: log.date });

    // Fire-and-forget server persist (best effort)
    void persistDayLog(log);
  }

  // symptom heatmap (last 28)
  const symptomIntensity = useMemo(() => {
    const last = history.slice(-28);
    return last.map((d) => (dayLogs[d.date]?.symptoms?.length ?? 0));
  }, [history, dayLogs]);
  const allZeroSymptoms = useMemo(() => symptomIntensity.every((n) => n === 0), [symptomIntensity]);

  // quick symptoms for selected day or today
  const quickDate = selectedDay || todayISO;
  const quickSymptoms: SymptomChoice[] = (dayLogs[quickDate]?.symptoms ?? []) as SymptomChoice[];

  const toggleSymptom = (name: SymptomChoice) => {
    const has = quickSymptoms.includes(name);
    const next = has ? quickSymptoms.filter((s) => s !== name) : [...quickSymptoms, name];
    const base = dayLogs[quickDate] ?? { date: quickDate };
    saveLog({ ...base, symptoms: next });
    track('lady_symptom_toggle', { name, active: !has, date: quickDate });
  };

  // ---- PDF generator (server-first, fallback local)
  const loadPdfOnce = useCallback(async () => {
    if (!mounted) return;
    setPdfLoading(true);
    try {
      let blob: Blob | null = null;

      // 1) Try server PDF endpoint (recommended for production)
      const serverPdf = await apiTry(async () => {
        const b = await fetchBlob(LADY_API.reportPdf, { method: 'GET', timeoutMs: 25000 });
        return b;
      });

      if (serverPdf.ok) blob = serverPdf.data;

      // 2) fallback: local generator
      if (!blob) {
        const r = await generateHealthReport('current-user', { fertility: true, ladyCenter: true } as any);
        blob = r.blob;
      }

      if (pdfObjectUrlRef.current) {
        try {
          URL.revokeObjectURL(pdfObjectUrlRef.current);
        } catch {}
      }
      const url = URL.createObjectURL(blob);
      pdfObjectUrlRef.current = url;
      setPdfUrl(url);
    } catch (err) {
      console.error('Failed to generate Lady Center PDF', err);
      showBanner('error', 'Could not generate report.');
    } finally {
      setPdfLoading(false);
    }
  }, [mounted]);

  useEffect(() => {
    return () => {
      if (pdfObjectUrlRef.current) {
        try {
          URL.revokeObjectURL(pdfObjectUrlRef.current);
        } catch {}
        pdfObjectUrlRef.current = null;
      }
    };
  }, []);

  const handleDownload = useCallback(() => {
    if (!pdfUrl) return;
    track('lady_report_download');
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = 'lady_center_report.pdf';
    link.click();
  }, [pdfUrl]);

  // ---- ICS subscribe url (real wiring via prefs)
  const icsUrl = useMemo(() => {
    if (!mounted) return null;
    try {
      return buildFertilityICSUrlFromPrefs(prefs, window.location.origin);
    } catch {
      return null;
    }
  }, [mounted, prefs]);

  const openSubscribeToast = () => {
    const enabled = !!icsUrl;
    setToastMsg(enabled ? icsUrl! : 'Set preferences first (LMP + cycle length) in Setup Preferences.');
    setToastOpen(true);
    setToastCopied(false);
    track('lady_ics_toast', { enabled });
  };

  useEffect(() => {
    if (!toastOpen) return;
    const t = setTimeout(() => setToastOpen(false), 5000);
    return () => clearTimeout(t);
  }, [toastOpen]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setToastCopied(true);
    track('lady_ics_copy');
  };

  // ---- Care paths
  const carePaths = useMemo(
    () => [
      { key: 'period_pain', title: 'Period pain', desc: 'Track patterns and decide next steps.' },
      { key: 'irregular', title: 'Irregular cycles', desc: 'Spot trends and plan care.' },
      { key: 'fertility', title: 'Fertility goals', desc: 'Timing, lifestyle, and support.' },
      { key: 'pregnancy', title: 'Pregnancy', desc: 'Week-by-week support and checks.' },
      { key: 'menopause', title: 'Peri/Menopause', desc: 'Symptoms, triggers, comfort tools.' },
      { key: 'sexual_health', title: 'Sexual health', desc: 'Discreet support and screening.' },
    ],
    []
  );

  // ---- Screening list
  const screeningItems: ScreeningItem[] = useMemo(() => {
    const base: Array<Omit<ScreeningItem, 'lastDoneISO' | 'nextDueISO' | 'status'>> = [
      {
        key: 'pap',
        title: 'Cervical screening (Pap/HPV)',
        desc: 'Routine check based on local guidelines and risk factors.',
        cadence: 'Every 3–5 years (varies)',
      },
      {
        key: 'breast',
        title: 'Breast screening',
        desc: 'Self-check reminders and imaging when appropriate.',
        cadence: 'Age/clinician guided',
      },
      {
        key: 'sti',
        title: 'STI screening',
        desc: 'Routine or symptom-based testing.',
        cadence: 'As needed',
      },
      {
        key: 'hpv_vax',
        title: 'HPV vaccine',
        desc: 'Check status and schedule doses if eligible.',
        cadence: 'Course-based',
      },
    ];

    return base.map((b) => {
      const lastDoneISO = screening[b.key]?.lastDoneISO ?? null;

      let nextDueISO: string | null = null;
      if (lastDoneISO) {
        const add =
          b.key === 'pap' ? 365 * 3 : b.key === 'breast' ? 365 * 2 : b.key === 'sti' ? 365 : b.key === 'hpv_vax' ? 365 : 365;
        nextDueISO = addDaysISO(lastDoneISO, add);
      }

      const status: ScreeningItem['status'] = !lastDoneISO
        ? 'unknown'
        : nextDueISO && new Date(nextDueISO).getTime() < Date.now()
        ? 'overdue'
        : 'ok';

      return { ...b, lastDoneISO, nextDueISO, status };
    });
  }, [screening]);

  const scheduleScreeningReminders = useCallback(async () => {
    // This is intentionally generic so it can plug into your existing reminders service.
    // If your reminders API differs, adjust payload here only.
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const payload = {
      kind: 'lady_screening',
      timezone: tz,
      items: screeningItems.map((x) => ({
        key: x.key,
        title: x.title,
        cadence: x.cadence,
        nextDueISO: x.nextDueISO ?? null,
        lastDoneISO: x.lastDoneISO ?? null,
      })),
    };

    const r = await apiTry(async () => {
      await fetchJson(LADY_API.reminders, { method: 'POST', body: JSON.stringify(payload), timeoutMs: 15000 });
    });

    if (r.ok) {
      showBanner('success', 'Reminders scheduled.');
      track('lady_screening_reminders_scheduled');
      return;
    }

    showBanner('info', 'Could not schedule reminders (offline).');
  }, [screeningItems]);

  const markScreeningDone = useCallback(async (key: string) => {
    const iso = nowISO();
    setScreening((s) => ({ ...s, [key]: { lastDoneISO: iso } }));
    showBanner('success', 'Marked as done.');
    track('lady_screening_done', { key });

    if (!serverHydratedRef.current) return;

    const r = await apiTry(async () => {
      await fetchJson(LADY_API.screening, { method: 'POST', body: JSON.stringify({ key, lastDoneISO: iso }), timeoutMs: 12000 });
    });

    if (r.ok) return;

    // fallback push full state
    await apiTry(async () => {
      const state: LadyServerState = {
        profile,
        docs,
        notes,
        screening: { ...screening, [key]: { lastDoneISO: iso } },
        dayLogs,
        updatedAtISO: nowISO(),
      };
      await fetchJson(LADY_API.state, { method: 'PUT', body: JSON.stringify(state), timeoutMs: 15000 });
    });
  }, [dayLogs, docs, notes, profile, screening]);

  // ---- “Today summary”
  const todaySummary = useMemo(() => {
    const mode = profile?.mode ?? 'cycle';

    if (mode === 'cycle') {
      const cd = prediction?.cycleDay ?? null;
      const cl = prediction?.cycleLength ?? null;
      return {
        title: 'Today',
        subtitle: cd && cl ? `Cycle day ${cd}/${cl} • Calm, explainable insights` : 'Your cycle & patterns at a glance',
        primary: { k: 'Cycle', v: cd && cl ? `Day ${cd} of ~${cl}` : 'Not configured' },
        secondary: [
          {
            k: 'Next window',
            v: prediction ? `${formatNiceDate(prediction.nextPeriodStart)} → ${formatNiceDate(prediction.nextPeriodEnd)}` : 'Set preferences',
          },
          {
            k: 'Timing window',
            v: prediction ? `${formatNiceDate(prediction.fertileStart)} → ${formatNiceDate(prediction.fertileEnd)}` : 'Set preferences',
          },
        ],
      };
    }

    if (mode === 'pregnancy') {
      return {
        title: 'Today',
        subtitle: 'A calm check-in for this week',
        primary: { k: 'Focus', v: 'Hydration, sleep, and gentle movement' },
        secondary: [
          { k: 'Note', v: 'Log what you feel — patterns matter more than single days' },
          { k: 'Care', v: 'Discuss anything worrying with a clinician' },
        ],
      };
    }

    if (mode === 'menopause') {
      return {
        title: 'Today',
        subtitle: 'Trends, triggers, and comfort tools',
        primary: { k: 'Focus', v: 'Sleep & temperature comfort' },
        secondary: [
          { k: 'Pattern', v: 'Track triggers (heat, caffeine, stress)' },
          { k: 'Plan', v: 'Small changes, consistent check-ins' },
        ],
      };
    }

    return {
      title: 'Today',
      subtitle: 'Track only what matters to you',
      primary: { k: 'Focus', v: 'Symptoms & notes' },
      secondary: [
        { k: 'Quick log', v: '10 seconds' },
        { k: 'Patterns', v: 'We connect dots over time' },
      ],
    };
  }, [profile, prediction]);

  const pregModePill = useMemo(() => {
    if (syncState === 'syncing') return <Pill tone="blue">Syncing…</Pill>;
    if (syncState === 'ok') return <Pill tone="emerald">Synced</Pill>;
    if (syncState === 'error') return <Pill tone="amber">Offline</Pill>;
    return <Pill tone="slate">Local</Pill>;
  }, [syncState]);

  return (
    <div className="min-h-screen">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50" />
        <div className="absolute -top-24 left-1/2 h-72 w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-200/40 via-violet-200/30 to-emerald-200/30 blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-10rem] h-80 w-80 rounded-full bg-gradient-to-tr from-amber-200/25 via-rose-200/25 to-blue-200/25 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 shadow-sm" />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold text-slate-900">Lady Center</h1>
                  {pregModePill}
                  <span className="text-xs text-slate-500">{syncHint}</span>
                </div>
                <p className="mt-0.5 text-sm text-slate-600">
                  {profile ? `${modeLabel(profile.mode)} • Private, supportive, actionable` : 'Your cycle, hormones, and screenings—tracked privately.'}
                </p>
              </div>
            </div>

            {banner ? (
              <div
                className={cn(
                  'mt-3 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm',
                  banner.kind === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : banner.kind === 'error'
                    ? 'border-rose-200 bg-rose-50 text-rose-800'
                    : 'border-blue-200 bg-blue-50 text-blue-800'
                )}
              >
                <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                <span>{banner.text}</span>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm',
                discreet ? 'border-slate-300 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              )}
              onClick={() => {
                const next = !discreet;
                setDiscreet(next);
                if (next) showBanner('success', 'Discreet Mode enabled.');
                else showBanner('info', 'Discreet Mode disabled.');
                track('lady_discreet_toggle', { on: next });
              }}
              aria-pressed={discreet}
              title="Discreet Mode"
            >
              {discreet ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              Discreet Mode
            </button>

            <button
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setOpenSettings(true)}
              title="Settings"
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
          </div>
        </div>

        {/* Pregnancy banner */}
        {mounted && showPregnancyBanner ? (
          <Card
            className={cn(
              'mt-6 p-4',
              preg.status === 'confirmed'
                ? 'border-emerald-200 bg-emerald-50/70'
                : preg.status === 'likely'
                ? 'border-amber-200 bg-amber-50/70'
                : 'border-blue-200 bg-blue-50/70'
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn('p-2 rounded-xl', preg.status === 'confirmed' ? 'bg-emerald-100' : preg.status === 'likely' ? 'bg-amber-100' : 'bg-blue-100')}>
                <Baby className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900">
                  {preg.status === 'confirmed'
                    ? 'Congratulations'
                    : preg.status === 'likely'
                    ? 'Possible pregnancy'
                    : 'Maybe pregnant'}
                  {preg.confidence ? <span className="ml-2 text-xs text-slate-500">({Math.round(preg.confidence * 100)}%)</span> : null}
                </div>
                <div className="mt-1 text-sm text-slate-700">
                  {sensitiveHidden
                    ? 'Discreet Mode is on. Tap reveal to see details.'
                    : preg.reasons?.length
                    ? preg.reasons.join(' • ')
                    : 'Keep wearing your device and logging symptoms.'}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {discreet && sensitiveHidden ? (
                    <button
                      className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                      onClick={() => {
                        revealSensitive(30);
                        showBanner('info', 'Revealed for 30 seconds.');
                      }}
                    >
                      Reveal
                    </button>
                  ) : null}

                  {preg.status === 'confirmed' ? (
                    <Link
                      href="/antenatal-center"
                      className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                      onClick={() => track('lady_pregnancy_cta', { cta: 'start_antenatal' })}
                    >
                      Start antenatal journey →
                    </Link>
                  ) : (
                    <>
                      <button
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                          setSelectedDay(todayISO);
                          showBanner('info', 'Open day log to record test result.');
                        }}
                      >
                        Log test / symptoms
                      </button>
                      <a
                        href="https://www.google.com/search?q=pregnancy+test"
                        target="_blank"
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => track('lady_pregnancy_cta', { cta: 'take_test' })}
                        rel="noreferrer"
                      >
                        Take a test
                      </a>
                    </>
                  )}

                  <button
                    className="rounded-xl border border-transparent bg-white/0 px-3 py-2 text-sm text-slate-700 hover:bg-white/60"
                    onClick={dismissPregnancyBanner}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </Card>
        ) : null}

        {/* Quick actions */}
        <div className="mt-6">
          <Card className="p-3">
            <div className="flex flex-wrap gap-2">
              <QuickAction label="Setup preferences" hint="LMP & cycle length" onClick={() => setOpenSetup(true)} />
              <QuickAction
                label={neutralize('Log period', discreet)}
                hint={selectedDay ? 'selected day' : 'today'}
                onClick={() => {
                  if (!profile) setProfile(defaultProfile('cycle'));
                  setSelectedDay(selectedDay ?? todayISO);
                }}
              />
              <QuickAction
                label="Log symptom"
                hint="10 seconds"
                onClick={() => {
                  if (!profile) setProfile(defaultProfile('cycle'));
                  document.getElementById('lady-quick-symptoms')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  showBanner('info', 'Use Quick Symptoms to log in seconds.');
                }}
              />
              <QuickAction label="Book consult" hint="gynae/GP" asLink href="/appointments/new" />
              <QuickAction label="Order tests" hint="labs" asLink href="/reports" />
              <QuickAction
                label="Export report"
                hint="PDF"
                onClick={async () => {
                  setShowReport(true);
                  if (!pdfUrl) await loadPdfOnce();
                  document.getElementById('lady-report')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              />
              <QuickAction label="Subscribe calendar" hint=".ics" onClick={openSubscribeToast} />

              <div className="ml-auto flex items-center gap-2">
                {profile ? (
                  <Pill tone="slate">
                    Mode: <span className="font-semibold">{modeLabel(profile.mode)}</span>
                  </Pill>
                ) : (
                  <button
                    className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                    onClick={() => setOpenSetup(true)}
                  >
                    Set up tracking
                  </button>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Main grid */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left */}
          <div className="lg:col-span-8 space-y-4">
            {/* ✅ Today summary (extracted component) */}
            <TodaySummaryCard
              summary={todaySummary}
              discreet={discreet}
              sensitiveHidden={sensitiveHidden}
              onReveal={() => revealSensitive(30)}
              onFindCare={() => track('lady_find_care')}
            />

            {/* First-time empty state */}
            {!profile ? (
              <Card className="p-5">
                <SectionHeader
                  title="Set up what you want to track"
                  subtitle="Nothing is forced. Choose a mode — you can change it anytime."
                  right={
                    <button
                      className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                      onClick={() => setOpenSetup(true)}
                    >
                      Start setup
                    </button>
                  }
                />
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <SetupChoice
                    title="Track cycle"
                    desc="Windows, patterns, and context."
                    onClick={() => {
                      setProfile(defaultProfile('cycle'));
                      showBanner('success', 'Cycle tracking enabled.');
                    }}
                  />
                  <SetupChoice
                    title="Track symptoms only"
                    desc="No cycle labels. Just what you feel."
                    onClick={() => {
                      setProfile(defaultProfile('symptoms'));
                      showBanner('success', 'Symptoms-only tracking enabled.');
                    }}
                  />
                  <SetupChoice title="Health mode" desc="Pregnancy or peri/menopause support." onClick={() => setOpenSetup(true)} />
                </div>
              </Card>
            ) : null}

            {/* Cycle panels */}
            <Card className="p-5">
              <SectionHeader
                title="Cycle timeline"
                subtitle="Calendar + trends. Predictions improve with consistent logs."
                right={
                  <div className="flex items-center gap-2">
                    <Pill tone="blue">
                      <Calendar className="h-3.5 w-3.5" /> Calendar
                    </Pill>
                    <Pill tone="violet">
                      <FileText className="h-3.5 w-3.5" /> Report
                    </Pill>
                  </div>
                }
              />

              {/* Chart */}
              <div className="mt-4">
                <button
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
                  onClick={() => setShowChart((v) => !v)}
                >
                  <div className="flex items-center gap-2">
                    <ChevronDown className={cn('h-4 w-4 transition', showChart ? 'rotate-0' : '-rotate-90')} />
                    <span className="text-sm font-semibold text-slate-900">Trends</span>
                    <span className="text-xs text-slate-500">ΔTemp, HRV, RHR, sleep</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {[14, 28, 90].map((d) => (
                      <button
                        key={d}
                        className={cn(
                          'rounded-xl border px-2.5 py-1 text-xs',
                          windowDays === d ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          setWindowDays(d as any);
                          track('lady_chart_timeframe', { days: d });
                        }}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                </button>

                {showChart ? (
                  <div className={cn('mt-3 rounded-2xl border border-slate-200 bg-white p-4', sensitiveHidden ? 'blur-sm select-none' : '')}>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      {[
                        ['ΔTemp', 'deltaTemp'],
                        ['RHR', 'rhr'],
                        ['HRV', 'hrv'],
                        ['Resp', 'respRate'],
                        ['SpO₂', 'spo2'],
                        ['Sleep', 'sleepScore'],
                      ].map(([label, key]) => (
                        <label key={key} className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            className="accent-slate-900"
                            checked={!!visibleSeries[key]}
                            onChange={() => {
                              setVisibleSeries((s) => ({ ...s, [key]: !s[key] }));
                              track('lady_chart_series_toggle', { key, enabled: !visibleSeries[key] });
                            }}
                          />
                          <span className="text-slate-700">{label}</span>
                        </label>
                      ))}
                      {discreet ? (
                        <button
                          className="ml-auto rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          onClick={() => revealSensitive(30)}
                        >
                          Reveal
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-3 h-[320px]">
                      <Line data={chartData} options={chartOptions as any} />
                    </div>

                    {sensitiveHidden ? <RevealOverlay onReveal={() => revealSensitive(30)} /> : null}
                  </div>
                ) : null}
              </div>

              {/* Calendar */}
              <div className="mt-4">
                <button
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
                  onClick={() => setShowCalendar((v) => !v)}
                >
                  <div className="flex items-center gap-2">
                    <ChevronDown className={cn('h-4 w-4 transition', showCalendar ? 'rotate-0' : '-rotate-90')} />
                    <span className="text-sm font-semibold text-slate-900">Calendar</span>
                    <span className="text-xs text-slate-500">Windows, ovulation markers, notes</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
                      }}
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="text-sm font-medium text-slate-900">
                      {currentMonth.toLocaleString('default', { month: 'long' })} {currentMonth.getFullYear()}
                    </div>
                    <button
                      className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
                      }}
                      aria-label="Next month"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </button>

                {showCalendar ? (
                  <div className={cn('mt-3 rounded-2xl border border-slate-200 bg-white p-4', sensitiveHidden ? 'blur-sm select-none' : '')}>
                    <div className="grid grid-cols-7 gap-2 text-xs text-slate-500 mb-2">
                      {weekdayLabels.map((w) => (
                        <div key={w} className="text-center">
                          {w}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-2">{calendarCells}</div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <LegendBadge symbol="💧" text="Period" />
                      <LegendBadge symbol="🟦" text="Follicular" />
                      <LegendBadge symbol="🔴" text="Luteal" />
                      <LegendBadge symbol="⭐" text="Ovulation" />
                      <LegendBadge symbol="🌿" text="Fertile window" />
                      <LegendBadge symbol="🧪" text="Positive test (log)" />
                      <LegendBadge symbol="◌" text="Predicted (tinted ring)" />
                    </div>

                    {/* Quick symptoms */}
                    <div id="lady-quick-symptoms" className="mt-5 space-y-2">
                      <div className="text-sm font-semibold text-slate-900">
                        Quick symptoms <span className="text-slate-500 font-normal">(for {selectedDay ? selectedDay : 'today'})</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {SYMPTOM_CHOICES.map((s) => {
                          const active = (dayLogs[quickDate]?.symptoms ?? []).includes(s);
                          return (
                            <button
                              key={s}
                              onClick={() => toggleSymptom(s)}
                              aria-pressed={active}
                              className={cn(
                                'px-3 py-1.5 rounded-full border text-sm transition inline-flex items-center gap-1',
                                active
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              )}
                            >
                              {active ? <Check className="h-4 w-4" /> : null}
                              {s.replace(/_/g, ' ')}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Symptom heatmap */}
                    <div className="mt-5">
                      <div className="mb-1 text-sm font-semibold text-slate-900">Symptom heatmap (last 28 days)</div>
                      {allZeroSymptoms ? (
                        <div className="border border-dashed rounded-xl p-4 text-xs text-slate-500">
                          No symptoms logged yet. Add symptoms to unlock richer insights.
                        </div>
                      ) : (
                        <div className="grid gap-1 overflow-x-auto" style={{ gridTemplateColumns: 'repeat(28, 12px)' }}>
                          {symptomIntensity.map((n, idx) => (
                            <div
                              key={idx}
                              title={`Day ${idx + 1}: ${n} symptom${n === 1 ? '' : 's'}`}
                              className={cn(
                                'h-3 w-3 rounded',
                                n === 0 ? 'bg-slate-200' : n === 1 ? 'bg-blue-200' : n === 2 ? 'bg-amber-300' : 'bg-rose-400'
                              )}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {sensitiveHidden ? <RevealOverlay onReveal={() => revealSensitive(30)} /> : null}
                  </div>
                ) : null}
              </div>

              {/* Report */}
              <div id="lady-report" className="mt-4">
                <button
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
                  onClick={() => setShowReport((v) => !v)}
                >
                  <div className="flex items-center gap-2">
                    <ChevronDown className={cn('h-4 w-4 transition', showReport ? 'rotate-0' : '-rotate-90')} />
                    <span className="text-sm font-semibold text-slate-900">Report preview</span>
                    <span className="text-xs text-slate-500">PDF</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!pdfUrl) await loadPdfOnce();
                        else handleDownload();
                      }}
                      disabled={pdfLoading}
                      title={pdfUrl ? 'Download' : 'Generate'}
                    >
                      <Download className="h-4 w-4 inline-block mr-2" />
                      {pdfLoading ? 'Preparing…' : pdfUrl ? 'Download' : 'Generate'}
                    </button>
                  </div>
                </button>

                {showReport ? (
                  <div className={cn('mt-3 rounded-2xl border border-slate-200 bg-white p-4', sensitiveHidden ? 'blur-sm select-none' : '')}>
                    {!pdfUrl ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-600">
                        Generate a PDF report to preview here.
                        <div className="mt-3">
                          <button
                            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                            onClick={loadPdfOnce}
                            disabled={pdfLoading}
                          >
                            <FileText className="h-4 w-4 inline-block mr-2" />
                            {pdfLoading ? 'Generating…' : 'Generate report'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <iframe src={pdfUrl} className="w-full h-[65vh] border rounded-xl" title="Lady Center Report" />
                    )}
                    {sensitiveHidden ? <RevealOverlay onReveal={() => revealSensitive(30)} /> : null}
                  </div>
                ) : null}
              </div>
            </Card>

            {/* ✅ Insights (InsightCore: real API + feedback loop) */}
            <InsightFeed
              mode={profile?.mode ?? 'cycle'}
              todayISO={todayISO}
              discreet={discreet}
              sensitiveHidden={sensitiveHidden}
              onReveal={() => revealSensitive(30)}
              onBanner={showBanner}
              fallbackInsights={buildInsights(profile?.mode ?? 'cycle', prediction, preg) as InsightCoreInsight[]}
              signals={{
                pregnancyStatus: preg?.status ?? 'unknown',
                cycleDay: prediction?.cycleDay ?? null,
                cycleLength: prediction?.cycleLength ?? null,
                nextPeriodStart: prediction?.nextPeriodStart ?? null,
                fertileStart: prediction?.fertileStart ?? null,
                symptomsToday: (dayLogs[todayISO]?.symptoms ?? []) as any,
              }}
            />
          </div>

          {/* Right */}
          <div className="lg:col-span-4 space-y-4">
            {/* ✅ Screening (extracted component) */}
            <ScreeningChecklist
              items={screeningItems as any}
              formatNiceDate={formatNiceDate}
              onReminders={scheduleScreeningReminders}
              onMarkDone={(key) => void markScreeningDone(key)}
              onBook={() => showBanner('info', 'Route to booking flow + clinician suggestions next.')}
            />

            {/* Care paths */}
            <Card className="p-5">
              <SectionHeader title="Care paths" subtitle="I know what I need — guide me." right={<Pill tone="violet">Guided</Pill>} />
              <div className="mt-4 grid grid-cols-1 gap-2">
                {carePaths.map((x) => (
                  <button
                    key={x.key}
                    className="group rounded-2xl border border-slate-200 bg-white p-3 text-left hover:bg-slate-50"
                    onClick={() => {
                      if (!profile) setProfile(defaultProfile('cycle'));
                      setOpenCarePath(x);
                      track('lady_carepath_open', { key: x.key });
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{x.title}</div>
                        <div className="mt-0.5 text-xs text-slate-600">{x.desc}</div>
                      </div>
                      <div className="text-xs text-slate-500 group-hover:text-slate-700">Open</div>
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            {/* ✅ Documents (extracted component) */}
            <DocumentsFolder
              docs={docs as any}
              sensitiveHidden={sensitiveHidden}
              onReveal={() => revealSensitive(30)}
              formatNiceDate={formatNiceDate}
              formatNiceTime={formatNiceTime}
              onAddFileName={(fileName) => {
                const doc: LadyDoc = {
                  id: uid('doc'),
                  title: fileName.replace(/\.[a-z0-9]+$/i, ''),
                  fileName,
                  tag: guessTag(fileName),
                  createdISO: nowISO(),
                };
                setDocs((d) => [doc, ...d]);
                showBanner('success', 'Document added.');
                track('lady_doc_add', { fileName });

                // Best-effort persist
                void (async () => {
                  if (!serverHydratedRef.current) return;

                  const r = await apiTry(async () => {
                    await fetchJson(LADY_API.documents, { method: 'POST', body: JSON.stringify({ doc }), timeoutMs: 12000 });
                  });

                  if (r.ok) return;

                  await apiTry(async () => {
                    const state: LadyServerState = {
                      profile,
                      docs: [doc, ...docs],
                      notes,
                      screening,
                      dayLogs,
                      updatedAtISO: nowISO(),
                    };
                    await fetchJson(LADY_API.state, { method: 'PUT', body: JSON.stringify(state), timeoutMs: 15000 });
                  });
                })();
              }}
              onView={() => showBanner('info', 'Open viewer + share/export controls next.')}
              onSummarize={() => showBanner('info', 'Route to clinician summary + AI extraction next.')}
              onRemove={(docId) => {
                setDocs((xs) => xs.filter((x) => x.id !== docId));
                showBanner('success', 'Removed.');
                track('lady_doc_remove', { id: docId });

                // Best-effort persist
                void (async () => {
                  if (!serverHydratedRef.current) return;

                  const r = await apiTry(async () => {
                    await fetchJson(LADY_API.documents, { method: 'DELETE', body: JSON.stringify({ id: docId }), timeoutMs: 12000 });
                  });

                  if (r.ok) return;

                  await apiTry(async () => {
                    const state: LadyServerState = {
                      profile,
                      docs: docs.filter((x) => x.id !== docId),
                      notes,
                      screening,
                      dayLogs,
                      updatedAtISO: nowISO(),
                    };
                    await fetchJson(LADY_API.state, { method: 'PUT', body: JSON.stringify(state), timeoutMs: 15000 });
                  });
                })();
              }}
            />

            {/* Notes */}
            <Card className="p-5">
              <SectionHeader
                title="Private notes"
                subtitle="For patterns you don’t want to forget."
                right={
                  <button
                    className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                    onClick={() => setOpenAddNote(true)}
                  >
                    Add
                  </button>
                }
              />

              <div className="mt-4 space-y-2">
                {notes.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                    No notes yet. Add one after a symptom, log, or appointment.
                  </div>
                ) : (
                  notes.slice(0, 5).map((n) => (
                    <div key={n.id} className="relative rounded-2xl border border-slate-200 bg-white p-3">
                      <div className={cn('text-sm text-slate-800 whitespace-pre-wrap', sensitiveHidden ? 'blur-[6px] select-none' : '')}>
                        {n.text}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">{formatNiceDate(n.createdISO)}</div>
                      {sensitiveHidden ? <RevealOverlay onReveal={() => revealSensitive(30)} /> : null}
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Footer CTA */}
            <div className="text-sm text-slate-600 text-center">
              Don’t have a wearable?{' '}
              <a href="https://nexring.cloventechnology.com/" target="_blank" rel="noreferrer" className="underline decoration-rose-400 hover:text-slate-900">
                Get NexRing for better insights →
              </a>
            </div>

            {/* Disclaimer */}
            <Card className="p-4 bg-amber-50/70 border-amber-200">
              <div className="text-sm text-slate-700">
                ⚠ Tracking and predictions are estimates — not medical advice. If symptoms are severe, changing, or worrying, please consult a clinician.
              </div>
            </Card>
          </div>
        </div>

        {/* Day Log bottom sheet */}
        {selectedLog ? (
          <DayLogSheet
            discreet={discreet}
            hidden={sensitiveHidden}
            log={selectedLog}
            onClose={() => setSelectedDay(null)}
            onSave={saveLog}
          />
        ) : null}

        {/* Settings modal */}
        <Modal
          open={openSettings}
          title="Lady Center settings"
          subtitle="Choose what you want to track and how it appears."
          onClose={() => setOpenSettings(false)}
          footer={
            <div className="flex items-center justify-between gap-3">
              <button
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  try {
                    localStorage.removeItem(LS.profile);
                  } catch {}
                  setProfile(null);
                  showBanner('info', 'Tracking reset.');
                  setOpenSettings(false);
                  track('lady_reset_tracking');

                  // best-effort server reset (push empty profile only)
                  void apiTry(async () => {
                    await fetchJson(LADY_API.profile, { method: 'PUT', body: JSON.stringify({ profile: null }), timeoutMs: 12000 });
                  });
                }}
              >
                Reset tracking
              </button>
              <button
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                onClick={() => {
                  showBanner('success', 'Saved.');
                  setOpenSettings(false);
                }}
              >
                Done
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Privacy</div>
              <div className="mt-1 text-sm text-slate-600">
                Discreet Mode keeps labels neutral and details hidden until you tap Reveal.
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">Discreet Mode</div>
                  <div className="text-xs text-slate-600">Hide sensitive labels & blur details</div>
                </div>
                <button
                  data-autofocus="1"
                  className={cn(
                    'rounded-xl px-3 py-2 text-sm font-medium',
                    discreet ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                  onClick={() => setDiscreet((x) => !x)}
                >
                  {discreet ? 'On' : 'Off'}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Tracking</div>
              <div className="mt-1 text-sm text-slate-600">Your choices control home cards, insights, and reminders.</div>

              <div className="mt-3 grid grid-cols-1 gap-3">
                <SettingRow
                  label="Mode"
                  desc="Pick the experience you want."
                  right={
                    <select
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                      value={profile?.mode ?? 'cycle'}
                      onChange={(e) => {
                        const m = e.target.value as LadyMode;
                        setProfile((p) => ({ ...(p ?? defaultProfile(m)), mode: m, trackCycle: m === 'cycle' }));
                        track('lady_mode_change', { mode: m });
                      }}
                    >
                      <option value="cycle">Cycle tracking</option>
                      <option value="symptoms">Symptoms only</option>
                      <option value="pregnancy">Pregnancy</option>
                      <option value="menopause">Peri/Menopause</option>
                    </select>
                  }
                />

                <SettingToggle
                  label="Track vitals context"
                  desc="Sleep, resting HR, temperature trend (optional)."
                  value={profile?.trackVitals ?? true}
                  onChange={(v) => setProfile((p) => ({ ...(p ?? defaultProfile()), trackVitals: v }))}
                />

                <SettingToggle
                  label="Preventive reminders"
                  desc="Screening checklist nudges."
                  value={profile?.remindScreening ?? true}
                  onChange={(v) => setProfile((p) => ({ ...(p ?? defaultProfile()), remindScreening: v }))}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Export</div>
              <div className="mt-1 text-sm text-slate-600">PDF report and calendar subscription.</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  onClick={async () => {
                    setShowReport(true);
                    if (!pdfUrl) await loadPdfOnce();
                    showBanner('success', 'Report ready.');
                  }}
                >
                  Export PDF
                </button>
                <button
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={openSubscribeToast}
                >
                  Subscribe calendar (.ics)
                </button>
              </div>
            </div>
          </div>
        </Modal>

        {/* Setup modal */}
        <Modal
          open={openSetup}
          title="Setup preferences"
          subtitle="Set LMP + cycle length for better predictions (and choose your mode)."
          onClose={() => setOpenSetup(false)}
          footer={
            <div className="flex items-center justify-between gap-3">
              <button
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setOpenSetup(false)}
              >
                Close
              </button>
              <button
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                onClick={() => {
                  if (!profile) setProfile(defaultProfile('cycle'));
                  showBanner('success', 'Saved.');
                  setOpenSetup(false);
                  track('lady_setup_done');
                }}
              >
                Done
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Mode</div>
              <div className="mt-1 text-sm text-slate-600">Choose the experience you want. You can change this anytime.</div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(['cycle', 'symptoms', 'pregnancy', 'menopause'] as LadyMode[]).map((m) => (
                  <button
                    key={m}
                    className={cn(
                      'rounded-2xl border p-4 text-left hover:bg-slate-50',
                      (profile?.mode ?? 'cycle') === m ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900'
                    )}
                    onClick={() => {
                      setProfile((p) => ({ ...(p ?? defaultProfile(m)), mode: m, trackCycle: m === 'cycle' }));
                      track('lady_mode_change', { mode: m });
                    }}
                  >
                    <div className="text-sm font-semibold">{modeLabel(m)}</div>
                    <div className={cn('mt-1 text-sm', (profile?.mode ?? 'cycle') === m ? 'text-white/80' : 'text-slate-600')}>
                      {m === 'cycle'
                        ? 'Windows + patterns, with discreet controls.'
                        : m === 'symptoms'
                        ? 'No cycle labels — track symptoms & notes.'
                        : m === 'pregnancy'
                        ? 'Weekly check-ins and supportive reminders.'
                        : 'Comfort tools, triggers, and trend tracking.'}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Pill tone="slate">Change anytime</Pill>
                      <Pill tone="emerald">Private</Pill>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Cycle preferences</div>
              <div className="mt-1 text-sm text-slate-600">
                This is your existing FertilitySetup. It stores preferences used for predictions & calendar subscription.
              </div>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                <FertilitySetup />
              </div>
            </div>
          </div>
        </Modal>

        {/* Add note modal */}
        <Modal
          open={openAddNote}
          title="Add a private note"
          subtitle="Keep it short — future you will thank you."
          onClose={() => setOpenAddNote(false)}
          footer={
            <div className="flex items-center justify-end gap-2">
              <button
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setOpenAddNote(false)}
              >
                Cancel
              </button>
            </div>
          }
        >
          <NoteComposer
            onSaved={(text) => {
              const note = { id: uid('note'), text, createdISO: nowISO() };
              setNotes((n) => [note, ...n]);
              showBanner('success', 'Note added.');
              setOpenAddNote(false);
              track('lady_note_add');

              // best-effort persist
              void (async () => {
                if (!serverHydratedRef.current) return;

                const r = await apiTry(async () => {
                  await fetchJson(LADY_API.notes, { method: 'POST', body: JSON.stringify({ note }), timeoutMs: 12000 });
                });

                if (r.ok) return;

                await apiTry(async () => {
                  const state: LadyServerState = {
                    profile,
                    docs,
                    notes: [note, ...notes],
                    screening,
                    dayLogs,
                    updatedAtISO: nowISO(),
                  };
                  await fetchJson(LADY_API.state, { method: 'PUT', body: JSON.stringify(state), timeoutMs: 15000 });
                });
              })();
            }}
          />
        </Modal>

        {/* Care path modal */}
        <Modal
          open={!!openCarePath}
          title={openCarePath?.title ?? 'Care path'}
          subtitle="A guided flow: a few questions → a clear next step."
          onClose={() => setOpenCarePath(null)}
        >
          {openCarePath ? (
            <CarePathFlow
              pathKey={openCarePath.key}
              discreet={discreet}
              onDone={(summary) => {
                const note = { id: uid('note'), text: summary, createdISO: nowISO() };
                setNotes((n) => [note, ...n]);
                showBanner('success', 'Saved to notes.');
                setOpenCarePath(null);

                // best-effort persist
                void apiTry(async () => {
                  await fetchJson(LADY_API.notes, { method: 'POST', body: JSON.stringify({ note }), timeoutMs: 12000 });
                });
              }}
            />
          ) : null}
        </Modal>

        {/* Subscribe toast */}
        {toastOpen ? (
          <div className="fixed right-6 bottom-6 z-50 w-[min(100%,32rem)]">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xl p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold mb-1">Subscribe in Calendar</div>
                  <div className="text-xs text-slate-600 break-all">{icsUrl ? toastMsg : 'Set preferences to enable: LMP + cycle length.'}</div>
                </div>
                <button className="p-1 rounded hover:bg-slate-100" onClick={() => setToastOpen(false)} aria-label="Close">
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  disabled={!icsUrl}
                  onClick={() => icsUrl && copy(icsUrl)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl border text-sm',
                    toastCopied ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50',
                    !icsUrl ? 'opacity-50 cursor-not-allowed' : ''
                  )}
                >
                  {toastCopied ? 'Copied' : 'Copy URL'}
                </button>
                <a
                  href={icsUrl ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => track('lady_ics_open')}
                  className={cn(
                    'px-3 py-1.5 rounded-xl border text-sm bg-white text-slate-800 border-slate-200 hover:bg-slate-50',
                    !icsUrl ? 'opacity-50 pointer-events-none' : ''
                  )}
                >
                  Open
                </a>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* =========================================================
   Subcomponents (still local)
========================================================= */

function QuickAction(props: { label: string; hint: string; onClick?: () => void; asLink?: boolean; href?: string }) {
  const { label, hint, onClick, asLink, href } = props;
  const cls = 'group inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50';
  const content = (
    <>
      <span className="font-medium">{label}</span>
      <span className="text-xs text-slate-500">{hint}</span>
    </>
  );

  if (asLink && href) {
    return (
      <Link href={href} className={cls}>
        {content}
      </Link>
    );
  }

  return (
    <button className={cls} onClick={onClick}>
      {content}
    </button>
  );
}

function SetupChoice({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }) {
  return (
    <button className="rounded-2xl border border-slate-200 bg-white p-4 text-left hover:bg-slate-50" onClick={onClick}>
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-600">{desc}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Pill tone="emerald">Private</Pill>
        <Pill tone="slate">Change anytime</Pill>
      </div>
    </button>
  );
}

function SettingRow({ label, desc, right }: { label: string; desc: string; right: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-medium text-slate-900">{label}</div>
        <div className="text-xs text-slate-600">{desc}</div>
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}

function SettingToggle({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div>
        <div className="text-sm font-medium text-slate-900">{label}</div>
        <div className="text-xs text-slate-600">{desc}</div>
      </div>
      <button
        className={cn(
          'rounded-xl px-3 py-2 text-sm font-medium',
          value ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
        )}
        onClick={() => onChange(!value)}
        aria-pressed={value}
      >
        {value ? 'On' : 'Off'}
      </button>
    </div>
  );
}

function NoteComposer({ onSaved }: { onSaved: (text: string) => void }) {
  const [text, setText] = useState('');
  const left = 280 - text.length;

  return (
    <div className="space-y-3">
      <textarea
        data-autofocus="1"
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 280))}
        placeholder="What happened? Any trigger? Anything to remember?"
      />
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-slate-500">{left} characters left</div>
        <button
          className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          disabled={!text.trim()}
          onClick={() => onSaved(text.trim())}
        >
          Save note
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   Day Log Sheet
========================================================= */

function DayLogSheet(props: {
  discreet: boolean;
  hidden: boolean;
  log: DayLog;
  onClose: () => void;
  onSave: (log: DayLog) => void;
}) {
  const { discreet, hidden, log, onClose, onSave } = props;

  // bottom-sheet drag (mobile)
  const startY = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    const sheet = document.getElementById('daylog-sheet');
    if (sheet && dy > 0) sheet.style.transform = `translateY(${Math.min(dy, 320)}px)`;
  };
  const onTouchEnd = () => {
    const sheet = document.getElementById('daylog-sheet');
    if (!sheet) return;
    const y = parseInt(sheet.style.transform.replace(/[^\d.-]/g, ''), 10) || 0;
    sheet.style.transform = '';
    if (y > 140) {
      onClose();
      navigator.vibrate?.(10);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} role="dialog" aria-modal="true">
      <div
        id="daylog-sheet"
        className="absolute inset-x-0 bottom-0 sm:inset-0 sm:m-auto sm:h-auto sm:max-w-md sm:rounded-2xl bg-white border border-slate-200 shadow-2xl rounded-t-2xl p-6 w-full sm:w-[32rem]"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-slate-900">{hidden ? neutralize('Day log', true) : `Day log – ${log.date}`}</h3>
          <button onClick={onClose} aria-label="Close">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className={cn('mt-3 space-y-3', hidden ? 'blur-sm select-none' : '')}>
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={!!log.period}
              onChange={(e) => onSave({ ...log, period: e.target.checked })}
            />
            {neutralize('Period started', discreet)}
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={!!log.ovulation}
              onChange={(e) => onSave({ ...log, ovulation: e.target.checked })}
            />
            {neutralize('Ovulation confirmed', discreet)}
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={!!log.pregnancyTestPositive}
              onChange={(e) => onSave({ ...log, pregnancyTestPositive: e.target.checked })}
            />
            {neutralize('Positive pregnancy test', discreet)}
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-700">Medication / Contraceptives</span>
            <input
              type="text"
              value={log.meds ?? ''}
              onChange={(e) => onSave({ ...log, meds: e.target.value })}
              className="mt-1 border border-slate-200 p-2 rounded-xl w-full text-sm"
              placeholder={discreet ? 'Optional' : 'e.g., iron, contraception, pain relief'}
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-700">Notes</span>
            <textarea
              value={log.notes ?? ''}
              onChange={(e) => onSave({ ...log, notes: e.target.value })}
              className="mt-1 border border-slate-200 p-2 rounded-xl w-full text-sm"
              rows={3}
              placeholder={discreet ? 'Optional' : 'Anything to remember?'}
            />
          </label>
        </div>

        {hidden ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow hover:bg-slate-800"
              onClick={() => {
                onClose();
              }}
            >
              Close (discreet)
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* =========================================================
   Logic builder (fallback insights for InsightFeed)
========================================================= */

function buildInsights(mode: LadyMode, prediction: any, preg: any): Array<{
  id: string;
  tone: 'info' | 'good' | 'attention';
  title: string;
  summary: string;
  why: string;
  next: string;
}> {
  const out: any[] = [];

  if (mode === 'cycle') {
    out.push({
      id: 'i_window',
      tone: 'info',
      title: prediction
        ? `Next window: ${formatNiceDate(prediction.nextPeriodStart)} → ${formatNiceDate(prediction.nextPeriodEnd)}`
        : 'Set preferences for predictions',
      summary: prediction
        ? 'This estimate uses your preferences and improves with consistent logs.'
        : 'Add LMP + cycle length in Setup Preferences to unlock predictions and calendar subscription.',
      why: prediction ? 'We use the cycle model configured in FertilitySetup, plus your logged events.' : 'No preferences are set yet.',
      next: 'Log cycle starts and symptoms for 2–3 cycles to refine. If timing varies a lot, Symptoms-only mode can still give clarity.',
    });

    if (preg.status && preg.status !== 'unlikely') {
      out.push({
        id: 'i_preg_signal',
        tone: preg.status === 'confirmed' ? 'good' : 'attention',
        title: preg.status === 'confirmed' ? 'Pregnancy signal: confirmed' : 'Pregnancy signal detected',
        summary: 'If you can, confirm with a test and discuss with a clinician for next steps.',
        why: preg.reasons?.length ? preg.reasons.join(' • ') : 'We noticed a pattern that can match early pregnancy signals.',
        next: 'Log your test result in the day log. If you feel unwell or worried, please consult a clinician.',
      });
    }
  } else if (mode === 'pregnancy') {
    out.push({
      id: 'i_preg',
      tone: 'info',
      title: 'Weekly check-in',
      summary: 'Consistency beats perfection — small steady habits compound.',
      why: 'We focus on trends that are sustainable, not day-to-day noise.',
      next: 'Pick one focus this week: hydration, gentle movement, or sleep consistency — then review next week.',
    });
  } else if (mode === 'menopause') {
    out.push({
      id: 'i_meno',
      tone: 'info',
      title: 'Triggers & comfort',
      summary: 'Tracking triggers can be more useful than tracking everything.',
      why: 'Patterns often show up around temperature, stress, caffeine, and sleep timing.',
      next: 'Log the top 1–2 symptoms weekly, plus a short note about triggers. Discuss options with a clinician if symptoms affect daily life.',
    });
  } else {
    out.push({
      id: 'i_symptoms',
      tone: 'info',
      title: 'Symptoms-only is a strong choice',
      summary: 'You can gain clarity without cycle labels.',
      why: 'Pattern detection can rely purely on symptoms + optional vitals context.',
      next: 'Log 1–2 symptoms weekly for a month — then compare trends and decide next steps.',
    });
  }

  return out.slice(0, 4);
}
