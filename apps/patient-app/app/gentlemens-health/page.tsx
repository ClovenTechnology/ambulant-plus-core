// apps/patient-app/app/gentlemens-health/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Dumbbell,
  FileText,
  HeartPulse,
  Info,
  Leaf,
  Lock,
  MinusCircle,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Target,
  Timer,
  Users,
  X,
} from 'lucide-react';

import { toast } from '@/components/ToastMount';

/* ---------------------------------
   Types
----------------------------------*/
type TabKey =
  | 'overview'
  | 'heart'
  | 'sexual'
  | 'prostate'
  | 'mental'
  | 'fitness'
  | 'lifestyle'
  | 'fatherhood';

type RiskLevel = 'Low' | 'Watch' | 'High';

type BpReading = {
  id: string;
  dateISO: string; // YYYY-MM-DD
  sys: number;
  dia: number;
  pulse?: number | null;
  note?: string | null;
};

type PlanBp = {
  active: boolean;
  startedISO?: string | null;
  days: Array<{
    dateISO: string;
    readingId?: string | null;
  }>;
};

type UrinaryLog = {
  id: string;
  dateISO: string;
  frequency: 'normal' | 'more_than_usual';
  urgency: 'none' | 'some' | 'often';
  weakStream: 'no' | 'sometimes' | 'often';
  nightUrination: '0-1' | '2-3' | '4+';
  note?: string | null;
};

type MentalCheck = {
  id: string;
  dateISO: string;
  sleepQuality: 1 | 2 | 3 | 4 | 5;
  stressLevel: 1 | 2 | 3 | 4 | 5;
  irritability: 0 | 1 | 2 | 3; // 0 none -> 3 high
  lowDrive: 0 | 1 | 2 | 3;
  note?: string | null;
};

type JournalEntry = {
  id: string;
  dateISO: string;
  text: string;
};

type WorkoutLog = {
  id: string;
  dateISO: string;
  type: 'strength' | 'cardio' | 'mobility' | 'sport' | 'other';
  durationMin: number;
  intensity: 1 | 2 | 3 | 4 | 5;
  note?: string | null;
};

type InjuryLog = {
  id: string;
  dateISO: string;
  area:
    | 'neck'
    | 'shoulder'
    | 'elbow'
    | 'wrist'
    | 'back'
    | 'hip'
    | 'knee'
    | 'ankle'
    | 'other';
  severity: 1 | 2 | 3 | 4 | 5;
  startedISO?: string | null;
  note?: string | null;
};

type HabitKey =
  | 'walk10'
  | 'sleep7'
  | 'bpCheck'
  | 'water'
  | 'veg'
  | 'screenBreak'
  | 'noNicotine'
  | 'noBingeAlcohol';

type WeeklyHabits = {
  weekOfISO: string; // Monday ISO (YYYY-MM-DD)
  selected: HabitKey[];
  doneByDate: Record<string, HabitKey[]>; // dateISO -> habits done
};

type SexualScreener = {
  lastRunISO?: string | null;
  edScore?: number | null; // 0..9
  stiRisk?: 'low' | 'medium' | 'high' | null;
  fertilityGoal?: 'not_now' | 'planning' | 'trying' | null;
};

type ProstateProfile = {
  ageBand: 'under40' | '40_49' | '50plus';
  familyHistory: boolean;
};

type Fatherhood = {
  goal: 'not_now' | 'planning' | 'parenting' | 'support_partner';
  remindersEnabled: boolean;
};

type GentlemenHealthState = {
  // privacy
  discreet: boolean;
  sensitiveHidden: boolean;

  // Heart/metabolic
  bpReadings: BpReading[];
  bpPlan: PlanBp;

  // Sexual health (screeners are local only)
  sexualScreener?: SexualScreener | null;

  // Prostate/urinary
  urinaryLogs: UrinaryLog[];
  prostateProfile?: ProstateProfile | null;

  // Mental health
  mentalChecks: MentalCheck[];
  journal: JournalEntry[];

  // Fitness
  workouts: WorkoutLog[];
  injuries: InjuryLog[];

  // Lifestyle
  weeklyHabits?: WeeklyHabits | null;

  // Fatherhood/family
  fatherhood?: Fatherhood | null;
};

type UrinaryLogInput = Omit<UrinaryLog, 'id' | 'dateISO'>;
type MentalCheckInput = Omit<MentalCheck, 'id' | 'dateISO'>;
type WorkoutLogInput = Omit<WorkoutLog, 'id' | 'dateISO'>;
type InjuryLogInput = Omit<InjuryLog, 'id' | 'dateISO'>;

/* ---------------------------------
   Storage helpers
----------------------------------*/
const LS_KEY = 'ambulant.gentlemensHealth.v2';

function safeJsonParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysISO(iso: string, delta: number) {
  const [y, m, d] = iso.split('-').map((x) => Number(x));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// Monday start (ISO-like, local)
function weekOfMondayISO(iso: string) {
  const [y, m, d] = iso.split('-').map((x) => Number(x));
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay(); // Sun=0 ... Sat=6
  const diffToMon = (day + 6) % 7; // Mon=0, Tue=1, ... Sun=6
  dt.setDate(dt.getDate() - diffToMon);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/* ---------------------------------
   Minimal UI building blocks (LIGHT)
----------------------------------*/
function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function Card({
  title,
  icon,
  right,
  children,
  className,
}: {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm',
        className,
      )}
    >
      {(title || right) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {icon}
            {title ? (
              <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            ) : null}
          </div>
          {right}
        </header>
      )}
      <div className="text-sm text-slate-800">{children}</div>
    </section>
  );
}

function Pill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const cls =
    tone === 'good'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : tone === 'warn'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : tone === 'bad'
          ? 'bg-rose-50 text-rose-700 border-rose-200'
          : 'bg-slate-50 text-slate-700 border-slate-200';

  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs', cls)}>
      {children}
    </span>
  );
}

function Btn({
  children,
  onClick,
  href,
  variant = 'solid',
  size = 'sm',
  leftIcon,
  rightIcon,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: 'solid' | 'ghost' | 'outline';
  size?: 'sm' | 'md';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  const base = size === 'md' ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs';

  const cls =
    variant === 'solid'
      ? 'bg-slate-900 text-white hover:bg-slate-800'
      : variant === 'outline'
        ? 'border border-slate-200 text-slate-900 hover:bg-slate-50'
        : 'text-slate-700 hover:bg-slate-50';

  const inner = (
    <span className="inline-flex items-center gap-2">
      {leftIcon}
      {children}
      {rightIcon}
    </span>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          'inline-flex items-center justify-center rounded-xl transition',
          base,
          cls,
          disabled ? 'pointer-events-none opacity-50' : '',
        )}
        title={title}
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center rounded-xl transition',
        base,
        cls,
        disabled ? 'pointer-events-none opacity-50' : '',
      )}
      disabled={disabled}
      title={title}
    >
      {inner}
    </button>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  hint,
  icon,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left hover:bg-slate-50"
      aria-pressed={checked}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-slate-600">{icon}</div>
        <div>
          <div className="text-xs font-semibold text-slate-900">{label}</div>
          {hint ? <div className="mt-0.5 text-[11px] text-slate-600">{hint}</div> : null}
        </div>
      </div>
      <div
        className={cn(
          'h-5 w-9 rounded-full border transition',
          checked ? 'border-emerald-300 bg-emerald-100' : 'border-slate-200 bg-slate-100',
        )}
      >
        <div
          className={cn(
            'h-4 w-4 translate-y-[2px] rounded-full transition',
            checked ? 'translate-x-[18px] bg-emerald-600' : 'translate-x-[2px] bg-slate-500',
          )}
        />
      </div>
    </button>
  );
}

function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-auto p-4 text-sm text-slate-800">{children}</div>
        {footer ? <div className="border-t border-slate-200 p-4">{footer}</div> : null}
      </div>
    </div>
  );
}

function Tabs({
  active,
  onChange,
  items,
}: {
  active: TabKey;
  onChange: (k: TabKey) => void;
  items: Array<{ key: TabKey; label: string; icon?: React.ReactNode; privateByDefault?: boolean }>;
}) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
      {items.map((it) => {
        const isActive = it.key === active;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition',
              isActive
                ? 'border-slate-300 bg-slate-100 text-slate-900'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
            )}
          >
            {it.icon}
            <span>{it.label}</span>
            {it.privateByDefault ? (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600">
                <Lock className="h-3 w-3" />
                Private
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------
   Small data utilities
----------------------------------*/
function bpCategory(sys: number, dia: number): RiskLevel {
  if (sys >= 140 || dia >= 90) return 'High';
  if (sys >= 130 || dia >= 80) return 'Watch';
  return 'Low';
}

function riskTone(r: RiskLevel): 'good' | 'warn' | 'bad' {
  if (r === 'Low') return 'good';
  if (r === 'Watch') return 'warn';
  return 'bad';
}

function formatBp(reading: BpReading | null, hide: boolean) {
  if (!reading) return hide ? 'Hidden' : '—';
  if (hide) return 'Hidden';
  return `${reading.sys}/${reading.dia}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function MiniSparkline({ values }: { values: number[] }) {
  const w = 160;
  const h = 40;
  const pad = 4;

  const pts = useMemo(() => {
    const v = values.filter((x) => Number.isFinite(x));
    if (v.length < 2) return '';
    const min = Math.min(...v);
    const max = Math.max(...v);
    const span = max - min || 1;

    return v
      .map((val, i) => {
        const x = pad + (i * (w - pad * 2)) / (v.length - 1);
        const y = pad + (1 - (val - min) / span) * (h - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [values]);

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="text-slate-600">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/* ---------------------------------
   Page
----------------------------------*/
const PRIVATE_TABS = new Set<TabKey>(['sexual', 'prostate', 'mental']);

export default function GentlemenHealthPage() {
  const today = useMemo(() => todayISO(), []);
  const [tab, setTab] = useState<TabKey>('overview');

  // Modals
  const [triageOpen, setTriageOpen] = useState(false);
  const [labOpen, setLabOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  // State
  const [state, setState] = useState<GentlemenHealthState>(() => {
    const saved = safeJsonParse<GentlemenHealthState>(
      typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null,
    );

    const base: GentlemenHealthState = {
      discreet: true, // ✅ discreet by default
      sensitiveHidden: true, // ✅ hide values by default

      bpReadings: [],
      bpPlan: { active: false, startedISO: null, days: [] },

      sexualScreener: null,

      urinaryLogs: [],
      prostateProfile: { ageBand: 'under40', familyHistory: false },

      mentalChecks: [],
      journal: [],

      workouts: [],
      injuries: [],

      weeklyHabits: null,

      fatherhood: { goal: 'not_now', remindersEnabled: false },
    };

    return { ...base, ...(saved || {}) };
  });

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  // Derived: latest BP + simple risk snapshot
  const latestBp = useMemo(() => {
    const items = [...state.bpReadings].sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
    return items[0] || null;
  }, [state.bpReadings]);

  const heartRisk = useMemo(() => {
    if (!latestBp) return { level: 'Watch' as RiskLevel, reason: 'No BP logged yet' };
    const level = bpCategory(latestBp.sys, latestBp.dia);
    const reason =
      level === 'Low'
        ? 'Within a healthy range'
        : level === 'Watch'
          ? 'Borderline range — keep tracking'
          : 'High range — consider a clinician check';
    return { level, reason };
  }, [latestBp]);

  const bpTrendSys = useMemo(() => {
    const items = [...state.bpReadings].sort((a, b) => (a.dateISO > b.dateISO ? 1 : -1));
    return items.slice(-10).map((r) => r.sys);
  }, [state.bpReadings]);

  const isPrivateTab = PRIVATE_TABS.has(tab);

  // Helper toasts
  function notifyOk(msg: string) {
    toast(msg, { type: 'success' });
  }
  function notifyInfo(msg: string) {
    toast(msg, { type: 'info' });
  }
  function notifyWarn(msg: string) {
    toast(msg, { type: 'warning' });
  }

  // Plans & logging
  function startBpPlan() {
    const start = today;
    const days = Array.from({ length: 14 }).map((_, i) => ({
      dateISO: addDaysISO(start, i),
      readingId: null as string | null,
    }));
    setState((s) => ({
      ...s,
      bpPlan: { active: true, startedISO: start, days },
    }));
    notifyOk('14-day BP plan started. Log today’s reading to begin.');
    setTab('heart');
  }

  function stopBpPlan() {
    setState((s) => ({
      ...s,
      bpPlan: { active: false, startedISO: null, days: [] },
    }));
    notifyInfo('BP plan archived.');
  }

  function addBpReading(sys: number, dia: number, pulse?: number | null, note?: string) {
    const r: BpReading = {
      id: uid('bp'),
      dateISO: today,
      sys,
      dia,
      pulse: pulse ?? null,
      note: note?.trim() || null,
    };

    setState((s) => {
      const bpReadings = [r, ...s.bpReadings.filter((x) => x.dateISO !== today)];
      const bpPlan = { ...s.bpPlan };

      if (bpPlan.active) {
        bpPlan.days = bpPlan.days.map((d) => (d.dateISO === today ? { ...d, readingId: r.id } : d));
      }

      return { ...s, bpReadings, bpPlan };
    });

    const lvl = bpCategory(sys, dia);
    if (lvl === 'High') notifyWarn('Logged. High range — consider booking a clinician check.');
    else if (lvl === 'Watch') notifyInfo('Logged. Borderline range — keep tracking over time.');
    else notifyOk('BP logged.');
  }

  function addUrinaryLog(log: UrinaryLogInput) {
    const entry: UrinaryLog = { id: uid('ur'), dateISO: today, ...log };
    setState((s) => ({
      ...s,
      urinaryLogs: [entry, ...s.urinaryLogs.filter((x) => x.dateISO !== today)],
    }));
    notifyOk('Saved today’s urinary check-in.');
  }

  function addMentalCheck(entry: MentalCheckInput) {
    const e: MentalCheck = { id: uid('mh'), dateISO: today, ...entry };
    setState((s) => ({
      ...s,
      mentalChecks: [e, ...s.mentalChecks.filter((x) => x.dateISO !== today)],
    }));
    notifyOk('Saved today’s check-in.');
  }

  function addJournal(text: string) {
    const t = text.trim();
    if (!t) return;
    const e: JournalEntry = { id: uid('jr'), dateISO: today, text: t };
    setState((s) => ({ ...s, journal: [e, ...s.journal] }));
    notifyOk('Saved.');
  }

  function addWorkout(w: WorkoutLogInput) {
    const entry: WorkoutLog = { id: uid('wk'), dateISO: today, ...w };
    setState((s) => ({ ...s, workouts: [entry, ...s.workouts] }));
    notifyOk('Workout logged.');
  }

  function addInjury(i: InjuryLogInput) {
    const entry: InjuryLog = { id: uid('inj'), dateISO: today, ...i };
    setState((s) => ({ ...s, injuries: [entry, ...s.injuries] }));
    notifyOk('Saved injury note.');
  }

  function ensureWeeklyHabits() {
    const weekOf = weekOfMondayISO(today);
    if (state.weeklyHabits?.weekOfISO === weekOf && state.weeklyHabits.selected?.length) return;
    setState((s) => ({
      ...s,
      weeklyHabits: {
        weekOfISO: weekOf,
        selected: ['walk10', 'sleep7', 'water'],
        doneByDate: {},
      },
    }));
  }

  function toggleHabitDone(dateISO: string, habit: HabitKey) {
    setState((s) => {
      const wh = s.weeklyHabits;
      if (!wh) return s;
      const done = new Set(wh.doneByDate[dateISO] || []);
      if (done.has(habit)) done.delete(habit);
      else done.add(habit);
      return {
        ...s,
        weeklyHabits: {
          ...wh,
          doneByDate: { ...wh.doneByDate, [dateISO]: Array.from(done) },
        },
      };
    });
  }

  useEffect(() => {
    ensureWeeklyHabits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Today status
  const todayUrinary = useMemo(
    () => state.urinaryLogs.find((x) => x.dateISO === today) || null,
    [state.urinaryLogs, today],
  );
  const todayMental = useMemo(
    () => state.mentalChecks.find((x) => x.dateISO === today) || null,
    [state.mentalChecks, today],
  );
  const todayWorkout = useMemo(
    () => state.workouts.find((x) => x.dateISO === today) || null,
    [state.workouts, today],
  );

  const tabs = useMemo(
    () =>
      [
        { key: 'overview', label: 'Overview', icon: <BarChart3 className="h-4 w-4 text-slate-600" /> },
        { key: 'heart', label: 'Heart + Metabolic', icon: <HeartPulse className="h-4 w-4 text-slate-600" /> },
        { key: 'sexual', label: 'Private Health', icon: <Lock className="h-4 w-4 text-slate-600" />, privateByDefault: true },
        { key: 'prostate', label: 'Prostate + Urinary', icon: <ShieldCheck className="h-4 w-4 text-slate-600" />, privateByDefault: true },
        { key: 'mental', label: 'Stress + Sleep', icon: <Brain className="h-4 w-4 text-slate-600" />, privateByDefault: true },
        { key: 'fitness', label: 'Fitness + Recovery', icon: <Dumbbell className="h-4 w-4 text-slate-600" /> },
        { key: 'lifestyle', label: 'Lifestyle Risks', icon: <Leaf className="h-4 w-4 text-slate-600" /> },
        { key: 'fatherhood', label: 'Fatherhood + Family', icon: <Users className="h-4 w-4 text-slate-600" /> },
      ] as Array<{ key: TabKey; label: string; icon: React.ReactNode; privateByDefault?: boolean }>,
    [],
  );

  // 30-sec triage (informational only)
  const [triage, setTriage] = useState({
    symptom: 'none' as 'none' | 'chest' | 'breath' | 'urine' | 'sexual' | 'stress' | 'injury',
    sudden: false,
    severe: false,
    lastingDays: 0,
  });

  const triageResult = useMemo(() => {
    const { symptom, sudden, severe, lastingDays } = triage;

    const base = {
      label: 'Monitor and track',
      detail: 'Track for a few days and book if it persists or worsens.',
      action: 'Go to Overview',
      go: () => setTab('overview' as TabKey),
    };

    if (symptom === 'none') return base;

    const urgent = severe && sudden;

    if (urgent) {
      return {
        label: 'Get urgent medical help',
        detail:
          'If symptoms are severe and sudden, it’s safest to get urgent medical attention now (emergency services / clinic / trusted adult).',
        action: 'Open safety note',
        go: () => setPrivacyOpen(true),
      };
    }

    if (symptom === 'chest' || symptom === 'breath') {
      if (lastingDays >= 2 || severe) {
        return {
          label: 'Book a clinician check',
          detail: 'If this is new, persistent, or affecting activity, booking a check is a good next step.',
          action: 'Book check-up',
          go: () => notifyInfo('Wire this button to your appointments route when ready.'),
        };
      }
      return {
        label: 'Track + reassess',
        detail: 'Track today. If it worsens or persists beyond ~48 hours, book a check.',
        action: 'Track Heart',
        go: () => setTab('heart'),
      };
    }

    if (symptom === 'urine') {
      return {
        label: 'Track urinary symptoms',
        detail: 'Log today’s urinary check-in. If persistent or worsening, book a check.',
        action: 'Log check-in',
        go: () => setTab('prostate'),
      };
    }

    if (symptom === 'sexual') {
      return {
        label: 'Private health check',
        detail: 'Run a quick private screener and consider a confidential consult if concerned.',
        action: 'Open Private Health',
        go: () => setTab('sexual'),
      };
    }

    if (symptom === 'stress') {
      return {
        label: 'Stress + sleep check-in',
        detail: 'Log today’s stress + sleep. If it’s impacting school/work/relationships, talk to someone.',
        action: 'Check in',
        go: () => setTab('mental'),
      };
    }

    if (symptom === 'injury') {
      return {
        label: 'Injury log + recovery',
        detail: 'Log what hurts and reduce load for a few days. If severe or not improving, book physio/clinician.',
        action: 'Log injury',
        go: () => setTab('fitness'),
      };
    }

    return base;
  }, [triage]);

  /* ---------------------------------
     Render helpers
  ----------------------------------*/
  function SectionLead({
    title,
    subtitle,
    right,
    privateDefault,
  }: {
    title: string;
    subtitle: string;
    right?: React.ReactNode;
    privateDefault?: boolean;
  }) {
    return (
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
            {privateDefault ? (
              <Pill tone="neutral">
                <span className="inline-flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Private by default
                </span>
              </Pill>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-600">{subtitle}</p>
        </div>
        {right}
      </div>
    );
  }

  function HiddenWrap({
    children,
    show,
    isPrivate,
  }: {
    children: React.ReactNode;
    show: boolean;
    isPrivate?: boolean;
  }) {
    if (show) return <>{children}</>;
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-2">
          <Lock className="mt-0.5 h-4 w-4 text-slate-600" />
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {isPrivate ? 'Private Health' : 'Details hidden'}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              Discreet mode hides sensitive details. You can still track—this only changes what’s shown on screen.
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn variant="outline" onClick={() => setPrivacyOpen(true)} leftIcon={<Info className="h-4 w-4" />}>
            Privacy controls
          </Btn>
          <Btn
            variant="solid"
            onClick={() => {
              setState((s) => ({ ...s, discreet: false, sensitiveHidden: false }));
              notifyInfo('Privacy controls updated.');
            }}
            leftIcon={<BadgeCheck className="h-4 w-4" />}
          >
            Reveal details
          </Btn>
        </div>
      </div>
    );
  }

  /* ---------------------------------
     Overview Tile
  ----------------------------------*/
  function Tile({
    title,
    desc,
    icon,
    statusPill,
    actions,
    onOpen,
    privateByDefault,
  }: {
    title: string;
    desc: string;
    icon: React.ReactNode;
    statusPill: React.ReactNode;
    actions: React.ReactNode;
    onOpen: () => void;
    privateByDefault?: boolean;
  }) {
    return (
      <Card
        title={
          <div className="flex items-center gap-2">
            {title}
            {privateByDefault ? (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600">
                <Lock className="h-3 w-3" />
                Private
              </span>
            ) : null}
          </div>
        }
        icon={<span className="text-slate-700">{icon}</span>}
        right={
          <div className="flex items-center gap-2">
            {statusPill}
            <Btn
              variant="ghost"
              onClick={onOpen}
              rightIcon={<ChevronRight className="h-4 w-4" />}
              title="Open section"
            >
              Open
            </Btn>
          </div>
        }
        className="h-full"
      >
        <div className="text-xs text-slate-600">{desc}</div>
        <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
      </Card>
    );
  }

  /* ---------------------------------
     Content visibility rules
     - Global discreet + hide-values drive what shows on screen.
     - Private tabs are labeled "Private" and encouraged to remain discreet,
       but user can still reveal via Privacy controls.
  ----------------------------------*/
  const showSensitiveContent = !state.discreet && !state.sensitiveHidden;

  /* ---------------------------------
     Page shell (LIGHT)
  ----------------------------------*/
  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50 px-4 py-6 text-slate-900">
      <div className="mx-auto w-full max-w-6xl">
        {/* Header */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="h-5 w-5 text-slate-700" />
              <h1 className="text-xl font-semibold text-slate-900">Gentlemen’s Health</h1>
              <Pill tone="neutral">Action-first • Private by default</Pill>
              <Pill tone="neutral">Informational (not diagnosis)</Pill>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              A practical hub: quick “today status”, calm guidance, and a clear next step (track • test • book • chat).
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:min-w-[320px]">
            <div className="grid grid-cols-2 gap-2">
              <Btn
                variant="outline"
                onClick={() => setTriageOpen(true)}
                leftIcon={<Timer className="h-4 w-4" />}
                size="md"
              >
                30-sec triage
              </Btn>
              <Btn
                variant="outline"
                onClick={() => setPrivacyOpen(true)}
                leftIcon={<Lock className="h-4 w-4" />}
                size="md"
              >
                Privacy
              </Btn>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs active={tab} onChange={setTab} items={tabs} />

        {/* Privacy note */}
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 text-slate-600" />
              <div>
                <div className="text-slate-900">
                  Discreet mode hides sensitive details (especially Private Health, Prostate, Stress/Sleep).
                </div>
                <div className="mt-0.5 text-slate-600">
                  Tip: You can keep it on and still track. If you’re under 18, it’s okay to involve a trusted adult/clinician for anything worrying.
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill tone="neutral">Discreet: {state.discreet ? 'On' : 'Off'}</Pill>
              <Pill tone="neutral">Hide values: {state.sensitiveHidden ? 'On' : 'Off'}</Pill>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="mt-4 grid gap-4">
          {tab === 'overview' ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Tile
                title="Heart + Metabolic Risk"
                desc="BP trends, resting HR, weight/waist, activity — plus a simple risk score and next steps."
                icon={<HeartPulse className="h-5 w-5" />}
                statusPill={
                  <Pill tone={riskTone(heartRisk.level)}>
                    {heartRisk.level} • {latestBp ? `BP ${formatBp(latestBp, state.sensitiveHidden)}` : 'No BP yet'}
                  </Pill>
                }
                actions={
                  <>
                    <Btn
                      variant="solid"
                      onClick={() => notifyInfo('Wire booking to your /appointments flow when ready.')}
                      leftIcon={<Calendar className="h-4 w-4" />}
                    >
                      Book check-up
                    </Btn>
                    <Btn variant="outline" onClick={() => setLabOpen(true)} leftIcon={<FileText className="h-4 w-4" />}>
                      Order lab panel
                    </Btn>
                    <Btn variant="outline" onClick={startBpPlan} leftIcon={<Target className="h-4 w-4" />}>
                      Start 14-day BP plan
                    </Btn>
                  </>
                }
                onOpen={() => setTab('heart')}
              />

              <Tile
                title="Private Health (Sexual + Fertility)"
                desc="Non-judgy, medical screeners + confidential next steps. Discreet by default."
                icon={<Lock className="h-5 w-5" />}
                privateByDefault
                statusPill={<Pill tone="neutral">Private</Pill>}
                actions={
                  <>
                    <Btn variant="solid" onClick={() => setTab('sexual')} leftIcon={<Lock className="h-4 w-4" />}>
                      Open private checks
                    </Btn>
                    <Btn
                      variant="outline"
                      onClick={() => notifyInfo('When ready: route to confidential consult booking.')}
                      leftIcon={<Stethoscope className="h-4 w-4" />}
                    >
                      Book confidential consult
                    </Btn>
                  </>
                }
                onOpen={() => setTab('sexual')}
              />

              <Tile
                title="Prostate + Urinary Health"
                desc="Quick symptom tracker, PSA education prompts by age/risk, and calm red flags."
                icon={<ShieldCheck className="h-5 w-5" />}
                privateByDefault
                statusPill={<Pill tone={todayUrinary ? 'good' : 'warn'}>{todayUrinary ? 'Checked in today' : 'No check-in today'}</Pill>}
                actions={
                  <>
                    <Btn variant="solid" onClick={() => setTab('prostate')} leftIcon={<ShieldCheck className="h-4 w-4" />}>
                      Log today
                    </Btn>
                    <Btn
                      variant="outline"
                      onClick={() => notifyInfo('Wire to PSA/lab booking when ready.')}
                      leftIcon={<FileText className="h-4 w-4" />}
                    >
                      PSA info + booking
                    </Btn>
                  </>
                }
                onOpen={() => setTab('prostate')}
              />

              <Tile
                title="Mental Health (Stress, Sleep, Burnout)"
                desc="Short check-in, journaling, and micro-habits. Discreet by default."
                icon={<Brain className="h-5 w-5" />}
                privateByDefault
                statusPill={<Pill tone={todayMental ? 'good' : 'warn'}>{todayMental ? 'Checked in' : 'No check-in'}</Pill>}
                actions={
                  <>
                    <Btn variant="solid" onClick={() => setTab('mental')} leftIcon={<Brain className="h-4 w-4" />}>
                      Check in
                    </Btn>
                    <Btn
                      variant="outline"
                      onClick={() => notifyInfo('When ready: route to clinician/coach booking.')}
                      leftIcon={<Stethoscope className="h-4 w-4" />}
                    >
                      Talk to someone
                    </Btn>
                    <Btn
                      variant="outline"
                      onClick={() => notifyInfo('If you have a stress report page, link it here.')}
                      leftIcon={<BarChart3 className="h-4 w-4" />}
                    >
                      Stress report
                    </Btn>
                  </>
                }
                onOpen={() => setTab('mental')}
              />

              <Tile
                title="Fitness, Recovery + Injury"
                desc="Training load, readiness, workout log, and injury notes with a physio path."
                icon={<Dumbbell className="h-5 w-5" />}
                statusPill={<Pill tone={todayWorkout ? 'good' : 'warn'}>{todayWorkout ? 'Workout logged' : 'No workout logged'}</Pill>}
                actions={
                  <>
                    <Btn variant="solid" onClick={() => setTab('fitness')} leftIcon={<Dumbbell className="h-4 w-4" />}>
                      Log workout
                    </Btn>
                    <Btn
                      variant="outline"
                      onClick={() => notifyInfo('When ready: route to physio referral/booking.')}
                      leftIcon={<Stethoscope className="h-4 w-4" />}
                    >
                      Physio path
                    </Btn>
                  </>
                }
                onOpen={() => setTab('fitness')}
              />

              <Tile
                title="Lifestyle Risks"
                desc="Blunt and useful: weekly small wins, streaks, and optional “health age” summary."
                icon={<Leaf className="h-5 w-5" />}
                statusPill={<Pill tone="neutral">Weekly plan</Pill>}
                actions={
                  <>
                    <Btn variant="solid" onClick={() => setTab('lifestyle')} leftIcon={<Target className="h-4 w-4" />}>
                      View weekly plan
                    </Btn>
                    <Btn
                      variant="outline"
                      onClick={() => notifyInfo('Hook this to your existing reminders/scheduler when ready.')}
                      leftIcon={<Calendar className="h-4 w-4" />}
                    >
                      Add reminders
                    </Btn>
                  </>
                }
                onOpen={() => setTab('lifestyle')}
              />

              <Tile
                title="Fatherhood + Family"
                desc="Preconception support, dad mental health check, vaccines/reminders, and Family linking."
                icon={<Users className="h-5 w-5" />}
                statusPill={<Pill tone="neutral">Family</Pill>}
                actions={
                  <>
                    <Btn variant="solid" href="/family" leftIcon={<Users className="h-4 w-4" />}>
                      Go to Family
                    </Btn>
                    <Btn variant="outline" onClick={() => setTab('fatherhood')} leftIcon={<Sparkles className="h-4 w-4" />}>
                      Open hub
                    </Btn>
                  </>
                }
                onOpen={() => setTab('fatherhood')}
              />
            </div>
          ) : null}

          {/* Heart + Metabolic */}
          {tab === 'heart' ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <SectionLead
                  title="Heart + Metabolic Risk"
                  subtitle="Track BP and activity, see a simple risk score, and take clear next steps."
                  right={
                    <div className="flex flex-wrap gap-2">
                      <Btn variant="solid" onClick={() => notifyInfo('Wire booking to /appointments when ready.')} leftIcon={<Calendar className="h-4 w-4" />}>
                        Book check-up
                      </Btn>
                      <Btn variant="outline" onClick={() => setLabOpen(true)} leftIcon={<FileText className="h-4 w-4" />}>
                        Order lab panel
                      </Btn>
                      {!state.bpPlan.active ? (
                        <Btn variant="outline" onClick={startBpPlan} leftIcon={<Target className="h-4 w-4" />}>
                          Start 14-day BP plan
                        </Btn>
                      ) : (
                        <Btn variant="outline" onClick={stopBpPlan} leftIcon={<MinusCircle className="h-4 w-4" />}>
                          Stop BP plan
                        </Btn>
                      )}
                    </div>
                  }
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Card
                    title="Today status"
                    icon={<HeartPulse className="h-4 w-4 text-slate-600" />}
                    right={<Pill tone={riskTone(heartRisk.level)}>{heartRisk.level}</Pill>}
                  >
                    <div className="text-xs text-slate-600">{heartRisk.reason}</div>
                    <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div>
                        <div className="text-[11px] text-slate-600">Latest BP</div>
                        <div className="mt-0.5 text-sm font-semibold text-slate-900">
                          {latestBp ? formatBp(latestBp, state.sensitiveHidden) : '—'}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-600">
                          {latestBp ? `Logged: ${latestBp.dateISO}` : 'Log your first reading to begin'}
                        </div>
                      </div>
                      <div>{bpTrendSys.length >= 2 ? <MiniSparkline values={bpTrendSys} /> : null}</div>
                    </div>
                    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
                      <div className="flex items-start gap-2">
                        <Info className="mt-0.5 h-4 w-4 text-slate-600" />
                        <div>
                          <div className="text-slate-900">What this means</div>
                          <div className="mt-1 text-slate-600">
                            This is a simple guide based on tracked readings — not a diagnosis. If readings are high or you feel unwell, book a check.
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>

                  <BpLogger hidden={state.sensitiveHidden} onSave={(sys, dia, pulse, note) => addBpReading(sys, dia, pulse, note)} />
                </div>

                <Card
                  title="14-day BP plan"
                  icon={<Target className="h-4 w-4 text-slate-600" />}
                  right={state.bpPlan.active ? <Pill tone="good">Active</Pill> : <Pill tone="neutral">Not active</Pill>}
                >
                  {!state.bpPlan.active ? (
                    <div className="flex flex-col gap-2">
                      <div className="text-xs text-slate-600">
                        A simple plan to reduce “one-off” readings. Log once daily for 14 days.
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Btn variant="solid" onClick={startBpPlan} leftIcon={<Target className="h-4 w-4" />}>
                          Start plan
                        </Btn>
                        <Btn
                          variant="outline"
                          onClick={() => notifyInfo('Later: connect to your reminders/scheduler (BP plan → daily reminder).')}
                          leftIcon={<Calendar className="h-4 w-4" />}
                        >
                          Add reminders (later)
                        </Btn>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {state.bpPlan.days.map((d) => {
                        const reading = d.readingId ? state.bpReadings.find((r) => r.id === d.readingId) || null : null;
                        const isToday = d.dateISO === today;
                        return (
                          <div
                            key={d.dateISO}
                            className={cn(
                              'flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-xs',
                              isToday ? 'border-slate-300 bg-slate-50' : '',
                            )}
                          >
                            <div>
                              <div className="text-slate-900">{d.dateISO}</div>
                              <div className="mt-0.5 text-slate-600">{isToday ? 'Today' : 'Plan day'}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-slate-900">
                                {reading ? formatBp(reading, state.sensitiveHidden) : state.sensitiveHidden ? 'Hidden' : 'Not logged'}
                              </div>
                              <div className="mt-0.5">
                                {reading ? (
                                  <Pill tone={riskTone(bpCategory(reading.sys, reading.dia))}>
                                    {bpCategory(reading.sys, reading.dia)}
                                  </Pill>
                                ) : (
                                  <Pill tone="neutral">—</Pill>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </div>

              <div className="lg:col-span-1">
                <Card title="Next best actions" icon={<ChevronRight className="h-4 w-4 text-slate-600" />}>
                  <div className="space-y-3 text-xs text-slate-700">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-slate-900">If risk is High</div>
                      <div className="mt-1 text-slate-600">Book a check. Keep logging to confirm patterns rather than single readings.</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-slate-900">If risk is Watch</div>
                      <div className="mt-1 text-slate-600">Start the 14-day plan. Add basic habits: walk, hydration, consistent sleep.</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-slate-900">If risk is Low</div>
                      <div className="mt-1 text-slate-600">Keep tracking weekly. Focus on consistency rather than perfection.</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Btn variant="solid" onClick={() => setLabOpen(true)} leftIcon={<FileText className="h-4 w-4" />}>
                        Lab panel
                      </Btn>
                      <Btn variant="outline" onClick={() => notifyInfo('Wire to chat/televisit entry when ready.')} leftIcon={<Stethoscope className="h-4 w-4" />}>
                        Chat clinician
                      </Btn>
                    </div>
                  </div>
                </Card>

                <Card title="Quick links" icon={<ChevronRight className="h-4 w-4 text-slate-600" />}>
                  <div className="flex flex-wrap gap-2">
                    <Btn variant="outline" href="/vitals" leftIcon={<Activity className="h-4 w-4" />}>
                      Vitals
                    </Btn>
                    <Btn variant="outline" href="/myCare/devices" leftIcon={<Activity className="h-4 w-4" />}>
                      Devices
                    </Btn>
                    <Btn variant="outline" onClick={() => setTriageOpen(true)} leftIcon={<Timer className="h-4 w-4" />}>
                      30-sec triage
                    </Btn>
                  </div>
                </Card>
              </div>
            </div>
          ) : null}

          {/* Private Health (Sexual + Fertility) */}
          {tab === 'sexual' ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <SectionLead
                  title="Private Health"
                  subtitle="Non-graphic, medical screeners + confidential next steps. Discreet by default."
                  privateDefault
                  right={
                    <div className="flex flex-wrap gap-2">
                      <Btn variant="solid" onClick={() => notifyInfo('Wire confidential consult booking when ready.')} leftIcon={<Stethoscope className="h-4 w-4" />}>
                        Book confidential consult
                      </Btn>
                      <Btn variant="outline" onClick={() => setPrivacyOpen(true)} leftIcon={<Lock className="h-4 w-4" />}>
                        Privacy
                      </Btn>
                    </div>
                  }
                />

                <HiddenWrap show={showSensitiveContent} isPrivate>
                  <Card title="Private Health screeners" icon={<Lock className="h-4 w-4 text-slate-600" />}>
                    <SexualScreeners
                      today={today}
                      initial={state.sexualScreener || null}
                      onSave={(next) => setState((s) => ({ ...s, sexualScreener: next }))}
                    />
                  </Card>

                  <Card title="Fertility planning basics" icon={<Users className="h-4 w-4 text-slate-600" />}>
                    <div className="text-xs text-slate-600">
                      Basics that help most people: consistent sleep, balanced nutrition, avoiding nicotine, reducing binge drinking, and managing stress.
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Btn variant="solid" onClick={() => notifyInfo('Wire to fertility consult route when ready.')} leftIcon={<Calendar className="h-4 w-4" />}>
                        Book fertility consult
                      </Btn>
                      <Btn variant="outline" onClick={() => notifyInfo('Later: add sperm test referral flow + lab logistics.')} leftIcon={<FileText className="h-4 w-4" />}>
                        Sperm test referral (later)
                      </Btn>
                    </div>
                  </Card>
                </HiddenWrap>
              </div>

              <div className="lg:col-span-1">
                <Card title="Private by design" icon={<Lock className="h-4 w-4 text-slate-600" />}>
                  <div className="space-y-3 text-xs text-slate-700">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-slate-900">Discreet mode</div>
                      <div className="mt-1 text-slate-600">
                        This section defaults to private labels and hides details until you choose to reveal them.
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-slate-900">Next step</div>
                      <div className="mt-1 text-slate-600">
                        If anything concerns you, a confidential consult is often the fastest way to get clarity.
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Btn variant="solid" onClick={() => notifyInfo('Wire confidential booking when ready.')} leftIcon={<Stethoscope className="h-4 w-4" />}>
                        Consult
                      </Btn>
                      <Btn variant="outline" onClick={() => setTriageOpen(true)} leftIcon={<Timer className="h-4 w-4" />}>
                        30-sec triage
                      </Btn>
                    </div>
                  </div>
                </Card>

                <Card title="Helpful links" icon={<ChevronRight className="h-4 w-4 text-slate-600" />}>
                  <div className="flex flex-wrap gap-2">
                    <Btn variant="outline" href="/myCare/devices" leftIcon={<Activity className="h-4 w-4" />}>
                      Devices
                    </Btn>
                    <Btn variant="outline" onClick={() => notifyInfo('Later: route to STI testing/lab logistics.')} leftIcon={<FileText className="h-4 w-4" />}>
                      STI testing (later)
                    </Btn>
                  </div>
                </Card>
              </div>
            </div>
          ) : null}

          {/* Prostate + Urinary */}
          {tab === 'prostate' ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <SectionLead
                  title="Prostate + Urinary Health"
                  subtitle="Quick check-in, calm red flags, and prompts based on age and risk."
                  privateDefault
                  right={
                    <div className="flex flex-wrap gap-2">
                      <Btn variant="solid" onClick={() => notifyInfo('Wire booking to clinician/urology path when ready.')} leftIcon={<Calendar className="h-4 w-4" />}>
                        Book a check
                      </Btn>
                      <Btn variant="outline" onClick={() => notifyInfo('Wire PSA/lab booking when ready.')} leftIcon={<FileText className="h-4 w-4" />}>
                        PSA booking (later)
                      </Btn>
                      <Btn variant="outline" onClick={() => setPrivacyOpen(true)} leftIcon={<Lock className="h-4 w-4" />}>
                        Privacy
                      </Btn>
                    </div>
                  }
                />

                <HiddenWrap show={showSensitiveContent} isPrivate>
                  <Card title="Profile (personalizes prompts)" icon={<ShieldCheck className="h-4 w-4 text-slate-600" />}>
                    <ProstateProfile
                      profile={state.prostateProfile || { ageBand: 'under40', familyHistory: false }}
                      onChange={(p) => setState((s) => ({ ...s, prostateProfile: p }))}
                    />
                  </Card>

                  <Card
                    title="Today’s urinary check-in"
                    icon={<ShieldCheck className="h-4 w-4 text-slate-600" />}
                    right={todayUrinary ? <Pill tone="good">Saved today</Pill> : <Pill tone="warn">Not saved</Pill>}
                  >
                    <UrinaryCheckin existing={todayUrinary} onSave={(log) => addUrinaryLog(log)} />
                  </Card>

                  <Card title="Red flags (simple, non-scary)" icon={<AlertTriangle className="h-4 w-4 text-slate-600" />}>
                    <ul className="list-disc space-y-1 pl-5 text-xs text-slate-700">
                      <li>Symptoms getting worse quickly</li>
                      <li>Difficulty passing urine</li>
                      <li>Fever with urinary symptoms</li>
                      <li>Anything that feels severe or sudden</li>
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Btn variant="solid" onClick={() => notifyInfo('Wire urgent booking / guidance when ready.')} leftIcon={<Stethoscope className="h-4 w-4" />}>
                        Talk to clinician
                      </Btn>
                      <Btn variant="outline" onClick={() => setTriageOpen(true)} leftIcon={<Timer className="h-4 w-4" />}>
                        30-sec triage
                      </Btn>
                    </div>
                  </Card>
                </HiddenWrap>
              </div>

              <div className="lg:col-span-1">
                <Card title="PSA prompts (education)" icon={<Info className="h-4 w-4 text-slate-600" />}>
                  <div className="space-y-3 text-xs text-slate-700">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-slate-900">How to use PSA info</div>
                      <div className="mt-1 text-slate-600">
                        PSA is one piece of a bigger picture (age, symptoms, family history). A clinician can guide whether testing is useful.
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-slate-900">Suggested next step</div>
                      <div className="mt-1 text-slate-600">
                        If you’re 50+ or have family history and symptoms, consider a check-up.
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Btn variant="solid" onClick={() => notifyInfo('Wire PSA booking when ready.')} leftIcon={<FileText className="h-4 w-4" />}>
                        PSA (later)
                      </Btn>
                      <Btn variant="outline" onClick={() => notifyInfo('Wire booking to clinician/urology path when ready.')} leftIcon={<Calendar className="h-4 w-4" />}>
                        Book check
                      </Btn>
                    </div>
                  </div>
                </Card>

                <Card title="History (local)" icon={<BarChart3 className="h-4 w-4 text-slate-600" />}>
                  <div className="text-xs text-slate-600">Last 7 check-ins</div>
                  <div className="mt-2 grid gap-2">
                    {[...state.urinaryLogs].slice(0, 7).map((x) => (
                      <div key={x.id} className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="text-slate-900">{x.dateISO}</div>
                          <Pill tone="neutral">Saved</Pill>
                        </div>
                        <div className="mt-2 text-slate-700">
                          {`Frequency: ${x.frequency.replaceAll('_', ' ')}, Urgency: ${x.urgency}, Weak stream: ${x.weakStream}, Night: ${x.nightUrination}`}
                        </div>
                      </div>
                    ))}
                    {state.urinaryLogs.length === 0 ? (
                      <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                        No check-ins yet.
                      </div>
                    ) : null}
                  </div>
                </Card>
              </div>
            </div>
          ) : null}

          {/* Mental Health */}
          {tab === 'mental' ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <SectionLead
                  title="Stress + Sleep (Burnout)"
                  subtitle="Quick check-in, journaling, and micro-habits — practical, non-judgy, and private by default."
                  privateDefault
                  right={
                    <div className="flex flex-wrap gap-2">
                      <Btn variant="solid" onClick={() => notifyInfo('Wire to mental-health clinician/coach booking when ready.')} leftIcon={<Stethoscope className="h-4 w-4" />}>
                        Talk to someone
                      </Btn>
                      <Btn variant="outline" onClick={() => setPrivacyOpen(true)} leftIcon={<Lock className="h-4 w-4" />}>
                        Privacy
                      </Btn>
                      <Btn variant="outline" onClick={() => notifyInfo('If you have a sleep report page, link it here.')} leftIcon={<BarChart3 className="h-4 w-4" />}>
                        Sleep report
                      </Btn>
                    </div>
                  }
                />

                <HiddenWrap show={showSensitiveContent} isPrivate>
                  <Card
                    title="Today check-in (2–4 questions)"
                    icon={<Brain className="h-4 w-4 text-slate-600" />}
                    right={todayMental ? <Pill tone="good">Saved today</Pill> : <Pill tone="warn">Not saved</Pill>}
                  >
                    <MentalCheckin existing={todayMental} onSave={addMentalCheck} />
                  </Card>

                  <Card title="Micro-habits (small wins)" icon={<Target className="h-4 w-4 text-slate-600" />}>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <HabitRow title="1-minute breathing" desc="Inhale 4 • hold 2 • exhale 6, repeat." />
                      <HabitRow title="10-minute walk" desc="Light movement can help reset stress loops." />
                      <HabitRow title="Screen break" desc="60 seconds away from the screen." />
                      <HabitRow title="Sleep anchor" desc="Same wake time 3 days in a row." />
                    </div>
                  </Card>

                  <Card title="Journal (private, local)" icon={<FileText className="h-4 w-4 text-slate-600" />}>
                    <Journal onSave={addJournal} entries={state.journal} />
                  </Card>
                </HiddenWrap>
              </div>

              <div className="lg:col-span-1">
                <Card title="Today snapshot" icon={<BarChart3 className="h-4 w-4 text-slate-600" />}>
                  <div className="space-y-3 text-xs text-slate-700">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-slate-900">If you feel “off”</div>
                      <div className="mt-1 text-slate-600">
                        Stress can show up as irritability, low drive, sleep issues, or constant fatigue. Tracking helps you spot patterns early.
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-slate-900">Next best action</div>
                      <div className="mt-1 text-slate-600">
                        Do the check-in today. If it’s impacting school/work or relationships, talk to a clinician.
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Btn variant="solid" onClick={() => setTriageOpen(true)} leftIcon={<Timer className="h-4 w-4" />}>
                        30-sec triage
                      </Btn>
                      <Btn variant="outline" onClick={() => notifyInfo('Wire to chat/televisit when ready.')} leftIcon={<Stethoscope className="h-4 w-4" />}>
                        Chat
                      </Btn>
                    </div>
                  </div>
                </Card>

                <Card title="History (local)" icon={<BarChart3 className="h-4 w-4 text-slate-600" />}>
                  <div className="text-xs text-slate-600">Last 7 check-ins</div>
                  <div className="mt-2 grid gap-2">
                    {[...state.mentalChecks].slice(0, 7).map((x) => (
                      <div key={x.id} className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="text-slate-900">{x.dateISO}</div>
                          <Pill tone="neutral">Saved</Pill>
                        </div>
                        <div className="mt-2 text-slate-700">
                          Sleep: {x.sleepQuality}/5 • Stress: {x.stressLevel}/5 • Irritability: {x.irritability}/3 • Low drive: {x.lowDrive}/3
                        </div>
                      </div>
                    ))}
                    {state.mentalChecks.length === 0 ? (
                      <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                        No check-ins yet.
                      </div>
                    ) : null}
                  </div>
                </Card>
              </div>
            </div>
          ) : null}

          {/* Fitness */}
          {tab === 'fitness' ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <SectionLead
                  title="Fitness + Recovery + Injury"
                  subtitle="Log workouts, track readiness, and capture pain/injury early — with clear next steps."
                  right={
                    <div className="flex flex-wrap gap-2">
                      <Btn variant="solid" onClick={() => notifyInfo('Wire to physio/clinician booking when ready.')} leftIcon={<Stethoscope className="h-4 w-4" />}>
                        Physio path
                      </Btn>
                      <Btn variant="outline" href="/myCare/devices" leftIcon={<Activity className="h-4 w-4" />}>
                        Devices
                      </Btn>
                    </div>
                  }
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Card
                    title="Workout log"
                    icon={<Dumbbell className="h-4 w-4 text-slate-600" />}
                    right={todayWorkout ? <Pill tone="good">Logged today</Pill> : <Pill tone="warn">Not logged</Pill>}
                  >
                    <WorkoutLogger onSave={addWorkout} />
                  </Card>

                  <Card title="Recovery readiness (demo-ready)" icon={<Activity className="h-4 w-4 text-slate-600" />}>
                    <div className="text-xs text-slate-600">
                      For now this uses a simple local model. When your NexRing/Health Monitor stream is wired, map readiness to HRV/resting HR/sleep.
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <ReadinessChip label="Readiness" value={mockReadiness(state)} />
                      <ReadinessChip label="Sleep" value={mockSleep(state)} />
                      <ReadinessChip label="Load" value={mockLoad(state)} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Btn variant="solid" onClick={() => notifyInfo('Later: wire to InsightCore readiness.')} leftIcon={<Sparkles className="h-4 w-4" />}>
                        Use InsightCore (later)
                      </Btn>
                      <Btn variant="outline" onClick={() => notifyInfo('Later: add training plan templates per goal.')} leftIcon={<Target className="h-4 w-4" />}>
                        Training templates (later)
                      </Btn>
                    </div>
                  </Card>
                </div>

                <Card title="Injury / pain log" icon={<AlertTriangle className="h-4 w-4 text-slate-600" />}>
                  <InjuryLogger onSave={addInjury} />
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {[...state.injuries].slice(0, 6).map((x) => (
                      <div key={x.id} className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="text-slate-900">{x.area.toUpperCase()}</div>
                          <Pill tone={x.severity >= 4 ? 'warn' : 'neutral'}>Severity {x.severity}/5</Pill>
                        </div>
                        <div className="mt-1 text-slate-700">{x.note || '—'}</div>
                        <div className="mt-1 text-slate-600">Logged: {x.dateISO}</div>
                      </div>
                    ))}
                    {state.injuries.length === 0 ? (
                      <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                        No injury notes yet.
                      </div>
                    ) : null}
                  </div>
                </Card>
              </div>

              <div className="lg:col-span-1">
                <Card title="Back-to-training guide" icon={<Info className="h-4 w-4 text-slate-600" />}>
                  <div className="space-y-3 text-xs text-slate-700">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-slate-900">Rule of thumb</div>
                      <div className="mt-1 text-slate-600">
                        Reduce intensity for a few days after pain flares. If pain is severe or not improving, book a physio/clinician check.
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-slate-900">Next best action</div>
                      <div className="mt-1 text-slate-600">
                        Log today’s workout and any pain. Patterns matter more than single days.
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Btn variant="solid" onClick={() => notifyInfo('Wire to physio booking when ready.')} leftIcon={<Stethoscope className="h-4 w-4" />}>
                        Book physio
                      </Btn>
                      <Btn variant="outline" onClick={() => setTriageOpen(true)} leftIcon={<Timer className="h-4 w-4" />}>
                        30-sec triage
                      </Btn>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          ) : null}

          {/* Lifestyle */}
          {tab === 'lifestyle' ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <SectionLead
                  title="Lifestyle Risks"
                  subtitle="Blunt and useful: weekly small wins + streaks. Consistency beats intensity."
                  right={
                    <div className="flex flex-wrap gap-2">
                      <Btn variant="outline" onClick={() => notifyInfo('Later: connect to coaching / lifestyle consults.')} leftIcon={<Users className="h-4 w-4" />}>
                        Coaching (later)
                      </Btn>
                      <Btn variant="outline" onClick={() => notifyInfo('Later: compute “Health age” using real vitals + habits.')} leftIcon={<Sparkles className="h-4 w-4" />}>
                        Health age (later)
                      </Btn>
                    </div>
                  }
                />

                <Card
                  title="Weekly small wins plan"
                  icon={<Target className="h-4 w-4 text-slate-600" />}
                  right={<Pill tone="neutral">Week of {state.weeklyHabits?.weekOfISO ?? weekOfMondayISO(today)}</Pill>}
                >
                  <WeeklyHabitsPlanner
                    today={today}
                    weekly={state.weeklyHabits || null}
                    onChange={(wh) => setState((s) => ({ ...s, weeklyHabits: wh }))}
                    onToggleDone={toggleHabitDone}
                  />
                </Card>

                <Card title="Why this works" icon={<Info className="h-4 w-4 text-slate-600" />}>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <InfoBox title="Small wins compound" desc="3 habits done most days beats 10 habits done once." />
                    <InfoBox title="Track honestly" desc="This isn’t about perfection — it’s about noticing patterns." />
                    <InfoBox title="Link to BP plan" desc="If BP is Watch/High, small wins plus tracking often helps." />
                    <InfoBox title="Ask for help early" desc="If habits feel impossible, a clinician/coach can help you simplify." />
                  </div>
                </Card>
              </div>

              <div className="lg:col-span-1">
                <Card title="Shortcuts" icon={<ChevronRight className="h-4 w-4 text-slate-600" />}>
                  <div className="flex flex-wrap gap-2">
                    <Btn variant="solid" onClick={() => setTab('heart')} leftIcon={<HeartPulse className="h-4 w-4" />}>
                      Heart risk
                    </Btn>
                    <Btn variant="outline" onClick={() => setTab('mental')} leftIcon={<Brain className="h-4 w-4" />}>
                      Stress + sleep
                    </Btn>
                    <Btn variant="outline" href="/vitals" leftIcon={<Activity className="h-4 w-4" />}>
                      Vitals
                    </Btn>
                  </div>
                </Card>

                <Card title="Optional: “Health age” (placeholder)" icon={<Sparkles className="h-4 w-4 text-slate-600" />}>
                  <div className="text-xs text-slate-600">
                    When you’re ready, compute a stable “health age” from real vitals + habits + sleep trends.
                  </div>
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                    <div className="flex items-center justify-between">
                      <div>Health age</div>
                      <Pill tone="neutral">Later</Pill>
                    </div>
                    <div className="mt-2 text-slate-600">
                      Wire inputs: BP trend, resting HR, activity minutes, sleep quality, and habit consistency.
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          ) : null}

          {/* Fatherhood */}
          {tab === 'fatherhood' ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <SectionLead
                  title="Fatherhood + Family"
                  subtitle="Preconception support, dad mental health check, reminders, and Family linking — without stereotypes."
                  right={
                    <div className="flex flex-wrap gap-2">
                      <Btn variant="solid" href="/family" leftIcon={<Users className="h-4 w-4" />}>
                        Go to Family
                      </Btn>
                      <Btn variant="outline" onClick={() => notifyInfo('Later: connect reminders via your existing scheduler/reminders.')} leftIcon={<Calendar className="h-4 w-4" />}>
                        Reminders (later)
                      </Btn>
                    </div>
                  }
                />

                <Card title="Your focus" icon={<Target className="h-4 w-4 text-slate-600" />}>
                  <FatherhoodGoal
                    value={state.fatherhood?.goal || 'not_now'}
                    onChange={(goal) =>
                      setState((s) => ({ ...s, fatherhood: { ...(s.fatherhood || { remindersEnabled: false }), goal } }))
                    }
                  />
                </Card>

                <Card title="Support partner tips (works even if single)" icon={<Info className="h-4 w-4 text-slate-600" />}>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <InfoBox title="Be the calm node" desc="Ask: “What would help most today?” and pick one practical task." />
                    <InfoBox title="Share the load" desc="Take one repeating responsibility (appointments, groceries, school run)." />
                    <InfoBox title="Check your own stress" desc="Use Stress + Sleep check-in; burnout affects relationships." />
                    <InfoBox title="Plan the basics" desc="Sleep, movement, and simple meals matter more than big gestures." />
                  </div>
                </Card>

                <Card title="Dad mental health check (private)" icon={<Brain className="h-4 w-4 text-slate-600" />}>
                  <div className="text-xs text-slate-600">
                    Parenting can raise stress. Use Stress + Sleep check-in to track patterns over time.
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Btn variant="solid" onClick={() => setTab('mental')} leftIcon={<Brain className="h-4 w-4" />}>
                      Go to Stress + Sleep
                    </Btn>
                    <Btn variant="outline" onClick={() => notifyInfo('Later: add parenting stress screener + resources.')} leftIcon={<FileText className="h-4 w-4" />}>
                      Parenting stress (later)
                    </Btn>
                  </div>
                </Card>
              </div>

              <div className="lg:col-span-1">
                <Card title="Quick links" icon={<ChevronRight className="h-4 w-4 text-slate-600" />}>
                  <div className="flex flex-wrap gap-2">
                    <Btn variant="outline" href="/family" leftIcon={<Users className="h-4 w-4" />}>
                      Family
                    </Btn>
                    <Btn variant="outline" onClick={() => setTab('sexual')} leftIcon={<Lock className="h-4 w-4" />}>
                      Private health
                    </Btn>
                    <Btn variant="outline" onClick={() => setTab('heart')} leftIcon={<HeartPulse className="h-4 w-4" />}>
                      Heart risk
                    </Btn>
                  </div>
                </Card>

                <Card title="Reminders (placeholder)" icon={<Calendar className="h-4 w-4 text-slate-600" />}>
                  <div className="text-xs text-slate-600">
                    When you’re ready, connect reminders to your Notifications + Calendar flows.
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 items-center">
                    <Btn
                      variant="solid"
                      onClick={() => {
                        setState((s) => ({
                          ...s,
                          fatherhood: { ...(s.fatherhood || { goal: 'not_now' }), remindersEnabled: !s.fatherhood?.remindersEnabled },
                        }));
                        notifyOk('Saved preference locally.');
                      }}
                      leftIcon={<BadgeCheck className="h-4 w-4" />}
                    >
                      Toggle reminders
                    </Btn>
                    <Pill tone="neutral">{state.fatherhood?.remindersEnabled ? 'Enabled' : 'Disabled'}</Pill>
                  </div>
                </Card>
              </div>
            </div>
          ) : null}

          {/* Private tab helper note (light, small) */}
          {isPrivateTab ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
              <div className="flex items-start gap-2">
                <Lock className="mt-0.5 h-4 w-4 text-slate-600" />
                <div>
                  <div className="text-slate-900">Private section</div>
                  <div className="mt-0.5 text-slate-600">
                    This lane defaults to discreet labels. If you want to reveal details, use <span className="font-semibold">Privacy</span>.
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Modals */}
        <Modal
          open={triageOpen}
          title={
            <span className="inline-flex items-center gap-2">
              <Timer className="h-4 w-4" /> 30-second triage (informational)
            </span>
          }
          onClose={() => setTriageOpen(false)}
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Btn variant="outline" onClick={() => setTriageOpen(false)}>
                Close
              </Btn>
              <Btn
                variant="solid"
                onClick={() => {
                  triageResult.go();
                  setTriageOpen(false);
                }}
                leftIcon={<ChevronRight className="h-4 w-4" />}
              >
                {triageResult.action}
              </Btn>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              Answer quickly. If something feels severe, sudden, or unsafe, it’s always okay to get help right away.
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <SelectRow
                label="Main concern"
                value={triage.symptom}
                options={[
                  { value: 'none', label: 'Just checking' },
                  { value: 'chest', label: 'Chest discomfort' },
                  { value: 'breath', label: 'Breathing / fatigue' },
                  { value: 'urine', label: 'Urinary symptoms' },
                  { value: 'sexual', label: 'Private health concern' },
                  { value: 'stress', label: 'Stress / sleep' },
                  { value: 'injury', label: 'Training injury' },
                ]}
                onChange={(v) => setTriage((t) => ({ ...t, symptom: v as any }))}
              />
              <SelectRow
                label="How long has it lasted?"
                value={String(triage.lastingDays)}
                options={[
                  { value: '0', label: 'Today / just now' },
                  { value: '1', label: '1 day' },
                  { value: '2', label: '2–3 days' },
                  { value: '7', label: '1+ week' },
                ]}
                onChange={(v) => setTriage((t) => ({ ...t, lastingDays: Number(v) }))}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle
                label="Sudden onset?"
                checked={triage.sudden}
                onChange={(v) => setTriage((t) => ({ ...t, sudden: v }))}
                hint="Did it start abruptly (not gradual)?"
                icon={<AlertTriangle className="h-4 w-4 text-slate-600" />}
              />
              <Toggle
                label="Severe / limiting?"
                checked={triage.severe}
                onChange={(v) => setTriage((t) => ({ ...t, severe: v }))}
                hint="Does it feel severe or limit normal activities?"
                icon={<AlertTriangle className="h-4 w-4 text-slate-600" />}
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-slate-900">{triageResult.label}</div>
                <Pill tone="neutral">Next step</Pill>
              </div>
              <div className="mt-2 text-xs text-slate-700">{triageResult.detail}</div>
            </div>
          </div>
        </Modal>

        <Modal
          open={labOpen}
          title={
            <span className="inline-flex items-center gap-2">
              <FileText className="h-4 w-4" /> Order lab panel (demo-ready)
            </span>
          }
          onClose={() => setLabOpen(false)}
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Btn variant="outline" onClick={() => setLabOpen(false)}>
                Close
              </Btn>
              <Btn
                variant="solid"
                onClick={() => {
                  notifyOk('Saved lab interest locally. Wire to MedReach + lab ordering later.');
                  setLabOpen(false);
                }}
                leftIcon={<BadgeCheck className="h-4 w-4" />}
              >
                Save
              </Btn>
            </div>
          }
        >
          <div className="space-y-3 text-xs text-slate-700">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              Demo placeholder: capture what you want to order. Later wire it to MedReach + partner labs.
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <CheckItem label="Lipids (cholesterol)" />
              <CheckItem label="Glucose / HbA1c" />
              <CheckItem label="Kidney function" />
              <CheckItem label="Liver function" />
              <CheckItem label="Full blood count" />
              <CheckItem label="Thyroid (TSH)" />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-slate-900">Next step</div>
              <div className="mt-1 text-slate-600">
                In Admin: convert this to a lab order ticket + logistics pickup using your existing dispatch patterns.
              </div>
            </div>
          </div>
        </Modal>

        <Modal
          open={privacyOpen}
          title={
            <span className="inline-flex items-center gap-2">
              <Lock className="h-4 w-4" /> Privacy controls
            </span>
          }
          onClose={() => setPrivacyOpen(false)}
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Btn variant="outline" onClick={() => setPrivacyOpen(false)}>
                Close
              </Btn>
              <Btn
                variant="solid"
                onClick={() => {
                  notifyOk('Privacy settings saved.');
                  setPrivacyOpen(false);
                }}
                leftIcon={<BadgeCheck className="h-4 w-4" />}
              >
                Done
              </Btn>
            </div>
          }
        >
          <div className="space-y-3">
            <Toggle
              label="Discreet mode"
              checked={state.discreet}
              onChange={(v) => setState((s) => ({ ...s, discreet: v }))}
              hint="Use neutral labels and hide sensitive sections by default."
              icon={<Lock className="h-4 w-4 text-slate-600" />}
            />
            <Toggle
              label="Hide sensitive values"
              checked={state.sensitiveHidden}
              onChange={(v) => setState((s) => ({ ...s, sensitiveHidden: v }))}
              hint="Hide numbers/details on-screen (useful in public)."
              icon={<ShieldCheck className="h-4 w-4 text-slate-600" />}
            />
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 text-slate-600" />
                <div>
                  Private lanes (Private Health, Prostate, Stress/Sleep) are labeled as Private by default. You can still reveal details any time.
                </div>
              </div>
            </div>

            {/* API thinking (lightweight hints) */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
              <div className="text-slate-900 font-semibold">API wiring (next)</div>
              <div className="mt-1 text-slate-600">
                When you paste your existing scheduler/reminders + reports endpoints, we can replace local-only parts with real calls.
                Suggested minimal endpoints:
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li><span className="font-semibold">GET</span> /api/reports/stress?range=7d (mental tile)</li>
                  <li><span className="font-semibold">GET</span> /api/reports/sleep?range=7d (sleep snapshot)</li>
                  <li><span className="font-semibold">GET</span> /api/reports/cardio?range=30d (heart lane)</li>
                  <li><span className="font-semibold">POST</span> /api/reminders/presets (bp-plan / walk / hydration / sleep anchor)</li>
                  <li><span className="font-semibold">POST</span> /api/labs/orders (capture panel → MedReach workflow)</li>
                </ul>
              </div>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}

/* ---------------------------------
   Subcomponents
----------------------------------*/
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] text-slate-600">{label}</div>
      {children}
    </label>
  );
}

function BpLogger({
  hidden,
  onSave,
}: {
  hidden: boolean;
  onSave: (sys: number, dia: number, pulse?: number | null, note?: string) => void;
}) {
  const [sys, setSys] = useState('120');
  const [dia, setDia] = useState('80');
  const [pulse, setPulse] = useState('');
  const [note, setNote] = useState('');

  const sysN = clamp(Number(sys || 0), 60, 260);
  const diaN = clamp(Number(dia || 0), 40, 160);
  const lvl = Number.isFinite(sysN) && Number.isFinite(diaN) ? bpCategory(sysN, diaN) : 'Watch';

  return (
    <Card
      title="Log BP (today)"
      icon={<HeartPulse className="h-4 w-4 text-slate-600" />}
      right={<Pill tone={riskTone(lvl)}>{lvl}</Pill>}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Systolic (SYS)">
          <input
            value={sys}
            onChange={(e) => setSys(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            placeholder="120"
            inputMode="numeric"
          />
        </Field>
        <Field label="Diastolic (DIA)">
          <input
            value={dia}
            onChange={(e) => setDia(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            placeholder="80"
            inputMode="numeric"
          />
        </Field>
        <Field label="Pulse (optional)">
          <input
            value={pulse}
            onChange={(e) => setPulse(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            placeholder="72"
            inputMode="numeric"
          />
        </Field>
        <Field label="Note (optional)">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            placeholder="After walk, morning, etc."
          />
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Btn
          variant="solid"
          onClick={() => {
            onSave(sysN, diaN, pulse ? Number(pulse) : null, note);
            setNote('');
          }}
          leftIcon={<BadgeCheck className="h-4 w-4" />}
        >
          Save
        </Btn>
        <div className="text-[11px] text-slate-600">
          You can log even when values are hidden — privacy is about display, not tracking.
        </div>
      </div>
    </Card>
  );
}

function SelectRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-[11px] text-slate-600">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckItem({ label }: { label: string }) {
  const [on, setOn] = useState(true);
  return (
    <button
      type="button"
      onClick={() => setOn(!on)}
      className={cn(
        'flex items-center justify-between rounded-xl border p-3 text-left text-xs transition',
        on ? 'border-slate-300 bg-slate-50' : 'border-slate-200 bg-white text-slate-600',
      )}
    >
      <span>{label}</span>
      {on ? <CheckCircle2 className="h-4 w-4 text-slate-700" /> : <X className="h-4 w-4 text-slate-400" />}
    </button>
  );
}

function ProstateProfile({
  profile,
  onChange,
}: {
  profile: ProstateProfile;
  onChange: (p: ProstateProfile) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <SelectRow
        label="Age band"
        value={profile.ageBand}
        options={[
          { value: 'under40', label: 'Under 40' },
          { value: '40_49', label: '40–49' },
          { value: '50plus', label: '50+' },
        ]}
        onChange={(v) => onChange({ ...profile, ageBand: v as any })}
      />
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="text-[11px] text-slate-600">Family history</div>
        <div className="mt-2">
          <button
            type="button"
            onClick={() => onChange({ ...profile, familyHistory: !profile.familyHistory })}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition',
              profile.familyHistory ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
            )}
          >
            {profile.familyHistory ? <CheckCircle2 className="h-4 w-4" /> : <MinusCircle className="h-4 w-4" />}
            {profile.familyHistory ? 'Yes' : 'No'}
          </button>
        </div>
        <div className="mt-2 text-[11px] text-slate-600">Used only to personalize prompts (local).</div>
      </div>
    </div>
  );
}

function UrinaryCheckin({
  existing,
  onSave,
}: {
  existing: UrinaryLog | null;
  onSave: (log: UrinaryLogInput) => void;
}) {
  const [frequency, setFrequency] = useState<UrinaryLog['frequency']>(existing?.frequency || 'normal');
  const [urgency, setUrgency] = useState<UrinaryLog['urgency']>(existing?.urgency || 'none');
  const [weakStream, setWeakStream] = useState<UrinaryLog['weakStream']>(existing?.weakStream || 'no');
  const [nightUrination, setNightUrination] = useState<UrinaryLog['nightUrination']>(existing?.nightUrination || '0-1');
  const [note, setNote] = useState(existing?.note || '');

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <SelectRow
          label="Frequency"
          value={frequency}
          options={[
            { value: 'normal', label: 'Normal' },
            { value: 'more_than_usual', label: 'More than usual' },
          ]}
          onChange={(v) => setFrequency(v as any)}
        />
        <SelectRow
          label="Urgency"
          value={urgency}
          options={[
            { value: 'none', label: 'None' },
            { value: 'some', label: 'Some' },
            { value: 'often', label: 'Often' },
          ]}
          onChange={(v) => setUrgency(v as any)}
        />
        <SelectRow
          label="Weak stream"
          value={weakStream}
          options={[
            { value: 'no', label: 'No' },
            { value: 'sometimes', label: 'Sometimes' },
            { value: 'often', label: 'Often' },
          ]}
          onChange={(v) => setWeakStream(v as any)}
        />
        <SelectRow
          label="Night urination"
          value={nightUrination}
          options={[
            { value: '0-1', label: '0–1 times' },
            { value: '2-3', label: '2–3 times' },
            { value: '4+', label: '4+ times' },
          ]}
          onChange={(v) => setNightUrination(v as any)}
        />
      </div>

      <Field label="Note (optional)">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
          placeholder="Anything you noticed today..."
        />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <Btn
          variant="solid"
          onClick={() =>
            onSave({
              frequency,
              urgency,
              weakStream,
              nightUrination,
              note: note.trim() || null,
            })
          }
          leftIcon={<BadgeCheck className="h-4 w-4" />}
        >
          Save today
        </Btn>
        <span className="text-[11px] text-slate-600">Tracking helps you notice patterns earlier.</span>
      </div>
    </div>
  );
}

function MentalCheckin({
  existing,
  onSave,
}: {
  existing: MentalCheck | null;
  onSave: (e: MentalCheckInput) => void;
}) {
  const [sleepQuality, setSleepQuality] = useState<number>(existing?.sleepQuality || 3);
  const [stressLevel, setStressLevel] = useState<number>(existing?.stressLevel || 3);
  const [irritability, setIrritability] = useState<number>(existing?.irritability || 1);
  const [lowDrive, setLowDrive] = useState<number>(existing?.lowDrive || 1);
  const [note, setNote] = useState(existing?.note || '');

  return (
    <div className="space-y-3">
      <SliderRow label="Sleep quality" value={sleepQuality} min={1} max={5} onChange={setSleepQuality} />
      <SliderRow label="Stress level" value={stressLevel} min={1} max={5} onChange={setStressLevel} />
      <SliderRow label="Irritability" value={irritability} min={0} max={3} onChange={setIrritability} />
      <SliderRow label="Low drive / motivation" value={lowDrive} min={0} max={3} onChange={setLowDrive} />
      <Field label="Note (optional)">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
          placeholder="What affected you today?"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Btn
          variant="solid"
          onClick={() =>
            onSave({
              sleepQuality: clamp(sleepQuality, 1, 5) as any,
              stressLevel: clamp(stressLevel, 1, 5) as any,
              irritability: clamp(irritability, 0, 3) as any,
              lowDrive: clamp(lowDrive, 0, 3) as any,
              note: note.trim() || null,
            })
          }
          leftIcon={<BadgeCheck className="h-4 w-4" />}
        >
          Save check-in
        </Btn>
        <span className="text-[11px] text-slate-600">Short and honest beats perfect.</span>
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-900">{label}</div>
        <Pill tone="neutral">
          {value}/{max}
        </Pill>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full"
      />
    </div>
  );
}

function HabitRow({ title, desc }: { title: string; desc: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setDone(!done)}
      className={cn(
        'flex items-start justify-between gap-3 rounded-xl border p-3 text-left text-xs transition',
        done ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50',
      )}
    >
      <div>
        <div className="text-slate-900">{title}</div>
        <div className="mt-0.5 text-slate-600">{desc}</div>
      </div>
      {done ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <CircleDot />}
    </button>
  );
}

function Journal({ onSave, entries }: { onSave: (t: string) => void; entries: JournalEntry[] }) {
  const [text, setText] = useState('');
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="text-[11px] text-slate-600">Write one thing on your mind (private, stored locally)</div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="mt-2 min-h-[90px] w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-slate-400"
          placeholder="Today I felt..."
        />
        <div className="mt-2 flex justify-end">
          <Btn
            variant="solid"
            onClick={() => {
              onSave(text);
              setText('');
            }}
            leftIcon={<BadgeCheck className="h-4 w-4" />}
          >
            Save
          </Btn>
        </div>
      </div>

      <div className="grid gap-2">
        {entries.slice(0, 6).map((e) => (
          <div key={e.id} className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="text-slate-700">{e.dateISO}</div>
              <Pill tone="neutral">Local</Pill>
            </div>
            <div className="mt-2 whitespace-pre-wrap text-slate-900">{e.text}</div>
          </div>
        ))}
        {entries.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">No entries yet.</div>
        ) : null}
      </div>
    </div>
  );
}

function WorkoutLogger({ onSave }: { onSave: (w: WorkoutLogInput) => void }) {
  const [type, setType] = useState<WorkoutLog['type']>('strength');
  const [durationMin, setDurationMin] = useState('30');
  const [intensity, setIntensity] = useState(3);
  const [note, setNote] = useState('');

  return (
    <div className="space-y-3">
      <SelectRow
        label="Workout type"
        value={type}
        options={[
          { value: 'strength', label: 'Strength' },
          { value: 'cardio', label: 'Cardio' },
          { value: 'mobility', label: 'Mobility' },
          { value: 'sport', label: 'Sport' },
          { value: 'other', label: 'Other' },
        ]}
        onChange={(v) => setType(v as any)}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Duration (minutes)">
          <input
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            inputMode="numeric"
            placeholder="30"
          />
        </Field>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-[11px] text-slate-600">Intensity</div>
          <div className="mt-2 flex items-center justify-between">
            <Pill tone="neutral">{intensity}/5</Pill>
          </div>
          <input type="range" min={1} max={5} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} className="mt-2 w-full" />
        </div>
      </div>
      <Field label="Note (optional)">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
          placeholder="How did it feel?"
        />
      </Field>
      <div className="flex justify-end">
        <Btn
          variant="solid"
          onClick={() => {
            onSave({
              type,
              durationMin: clamp(Number(durationMin || 0), 0, 500),
              intensity: clamp(intensity, 1, 5) as any,
              note: note.trim() || null,
            });
            setNote('');
          }}
          leftIcon={<BadgeCheck className="h-4 w-4" />}
        >
          Save
        </Btn>
      </div>
    </div>
  );
}

function InjuryLogger({ onSave }: { onSave: (i: InjuryLogInput) => void }) {
  const [area, setArea] = useState<InjuryLog['area']>('knee');
  const [severity, setSeverity] = useState(2);
  const [note, setNote] = useState('');

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <SelectRow
          label="Area"
          value={area}
          options={[
            { value: 'neck', label: 'Neck' },
            { value: 'shoulder', label: 'Shoulder' },
            { value: 'elbow', label: 'Elbow' },
            { value: 'wrist', label: 'Wrist' },
            { value: 'back', label: 'Back' },
            { value: 'hip', label: 'Hip' },
            { value: 'knee', label: 'Knee' },
            { value: 'ankle', label: 'Ankle' },
            { value: 'other', label: 'Other' },
          ]}
          onChange={(v) => setArea(v as any)}
        />
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-[11px] text-slate-600">Severity</div>
          <div className="mt-2 flex items-center justify-between">
            <Pill tone={severity >= 4 ? 'warn' : 'neutral'}>{severity}/5</Pill>
          </div>
          <input type="range" min={1} max={5} value={severity} onChange={(e) => setSeverity(Number(e.target.value))} className="mt-2 w-full" />
        </div>
      </div>

      <Field label="Note (optional)">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
          placeholder="When it hurts, what triggers it..."
        />
      </Field>

      <div className="flex justify-end">
        <Btn
          variant="solid"
          onClick={() => {
            onSave({
              area,
              severity: clamp(severity, 1, 5) as any,
              startedISO: null,
              note: note.trim() || null,
            });
            setNote('');
          }}
          leftIcon={<BadgeCheck className="h-4 w-4" />}
        >
          Save
        </Btn>
      </div>
    </div>
  );
}

function ReadinessChip({
  label,
  value,
}: {
  label: string;
  value: { score: number; note: string; tone: 'good' | 'warn' | 'bad' };
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
      <div className="flex items-center justify-between">
        <div className="text-slate-700">{label}</div>
        <Pill tone={value.tone}>{value.score}</Pill>
      </div>
      <div className="mt-2 text-slate-600">{value.note}</div>
    </div>
  );
}

// Demo-ready placeholders (wire to real InsightCore later)
function mockReadiness(state: GentlemenHealthState) {
  const base = 72;
  const stressPenalty = (state.mentalChecks?.[0]?.stressLevel || 3) * 3;
  const score = clamp(Math.round(base - stressPenalty + Math.random() * 6), 10, 95);
  return {
    score,
    note: score >= 70 ? 'Good to train' : score >= 50 ? 'Moderate — ease in' : 'Low — prioritize recovery',
    tone: score >= 70 ? 'good' : score >= 50 ? 'warn' : 'bad',
  } as const;
}
function mockSleep(state: GentlemenHealthState) {
  const q = state.mentalChecks?.[0]?.sleepQuality || 3;
  const score = clamp(q * 18 + Math.round(Math.random() * 6), 10, 95);
  return {
    score,
    note: q >= 4 ? 'Solid sleep' : q === 3 ? 'Average' : 'Needs attention',
    tone: q >= 4 ? 'good' : q === 3 ? 'warn' : 'bad',
  } as const;
}
function mockLoad(state: GentlemenHealthState) {
  const w = state.workouts?.[0];
  const score = clamp((w?.durationMin || 0) + (w?.intensity || 3) * 10, 5, 95);
  return {
    score,
    note: score >= 70 ? 'High load' : score >= 40 ? 'Moderate load' : 'Low load',
    tone: score >= 70 ? 'warn' : 'good',
  } as const;
}

function WeeklyHabitsPlanner({
  today,
  weekly,
  onChange,
  onToggleDone,
}: {
  today: string;
  weekly: WeeklyHabits | null;
  onChange: (wh: WeeklyHabits) => void;
  onToggleDone: (dateISO: string, habit: HabitKey) => void;
}) {
  const wh = weekly || { weekOfISO: weekOfMondayISO(today), selected: ['walk10', 'sleep7', 'water'], doneByDate: {} };

  const habitDefs: Array<{ key: HabitKey; label: string; desc: string }> = [
    { key: 'walk10', label: '10-min walk', desc: 'Light movement daily' },
    { key: 'sleep7', label: 'Sleep anchor', desc: '7+ hours target' },
    { key: 'bpCheck', label: 'BP check', desc: 'Log BP (if needed)' },
    { key: 'water', label: 'Hydration', desc: 'Water with meals' },
    { key: 'veg', label: 'Veg/fruit', desc: 'Add 1 serving' },
    { key: 'screenBreak', label: 'Screen break', desc: '60s away' },
    { key: 'noNicotine', label: 'No nicotine', desc: 'Avoid nicotine today' },
    { key: 'noBingeAlcohol', label: 'No binge alcohol', desc: 'Keep it moderate' },
  ];

  const selectedSet = new Set(wh.selected);
  const days = Array.from({ length: 7 }).map((_, i) => addDaysISO(wh.weekOfISO, i));

  function toggleSelect(h: HabitKey) {
    const next = new Set(wh.selected);
    if (next.has(h)) next.delete(h);
    else {
      if (next.size >= 5) return; // keep it small
      next.add(h);
    }
    onChange({ ...wh, selected: Array.from(next) });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        Pick 3–5 habits for this week. Track daily. Small wins compound.
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {habitDefs.map((h) => (
          <button
            key={h.key}
            type="button"
            onClick={() => toggleSelect(h.key)}
            className={cn(
              'rounded-xl border p-3 text-left text-xs transition',
              selectedSet.has(h.key) ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50',
            )}
          >
            <div className="flex items-center justify-between">
              <div className="text-slate-900">{h.label}</div>
              {selectedSet.has(h.key) ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <CircleDot />}
            </div>
            <div className="mt-1 text-slate-600">{h.desc}</div>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-900">This week</div>
          <Pill tone="neutral">{wh.selected.length} habits</Pill>
        </div>

        <div className="mt-3 grid gap-2">
          {days.map((d) => {
            const done = new Set(wh.doneByDate[d] || []);
            const isToday = d === today;

            return (
              <div key={d} className={cn('rounded-xl border border-slate-200 bg-white p-3', isToday ? 'border-slate-300 bg-slate-50' : '')}>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-800">
                    {d}
                    {isToday ? ' • Today' : ''}
                  </div>
                  <Pill tone={done.size >= Math.max(1, Math.floor(wh.selected.length * 0.7)) ? 'good' : 'neutral'}>
                    {done.size}/{wh.selected.length}
                  </Pill>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {wh.selected.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => onToggleDone(d, h)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-[11px] transition',
                        done.has(h) ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                      )}
                    >
                      {habitDefs.find((x) => x.key === h)?.label ?? h}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function InfoBox({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
      <div className="text-slate-900">{title}</div>
      <div className="mt-1 text-slate-600">{desc}</div>
    </div>
  );
}

function FatherhoodGoal({
  value,
  onChange,
}: {
  value: Fatherhood['goal'];
  onChange: (v: Fatherhood['goal']) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <GoalBtn label="Not now" active={value === 'not_now'} onClick={() => onChange('not_now')} />
      <GoalBtn label="Planning" active={value === 'planning'} onClick={() => onChange('planning')} />
      <GoalBtn label="Parenting" active={value === 'parenting'} onClick={() => onChange('parenting')} />
      <GoalBtn label="Support partner" active={value === 'support_partner'} onClick={() => onChange('support_partner')} />
    </div>
  );
}

function GoalBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-xl border p-3 text-left text-xs transition',
        active ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="text-slate-900">{label}</div>
        {active ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <CircleDot />}
      </div>
      <div className="mt-1 text-slate-600">Personalizes this section.</div>
    </button>
  );
}

function SexualScreeners({
  today,
  initial,
  onSave,
}: {
  today: string;
  initial: SexualScreener | null;
  onSave: (next: SexualScreener) => void;
}) {
  // ED screener (very short, non-graphic)
  const [edA, setEdA] = useState<number>(() => (initial?.edScore != null ? clamp(Math.floor((initial.edScore ?? 6) / 3), 0, 3) : 2));
  const [edB, setEdB] = useState<number>(() => 2);
  const [edC, setEdC] = useState<number>(() => 2);

  // STI risk (very general)
  const [stiA, setStiA] = useState(false); // new partner
  const [stiB, setStiB] = useState(false); // symptoms
  const [stiC, setStiC] = useState(false); // unprotected
  const [stiD, setStiD] = useState(false); // exposure concern

  const [fertilityGoal, setFertilityGoal] = useState<'not_now' | 'planning' | 'trying'>(
    (initial?.fertilityGoal as any) || 'not_now',
  );

  const edScore = useMemo(() => clamp(edA + edB + edC, 0, 9), [edA, edB, edC]);

  const stiRisk = useMemo(() => {
    const score = Number(stiA) + Number(stiB) + Number(stiC) + Number(stiD);
    if (score >= 3) return 'high';
    if (score === 2) return 'medium';
    return 'low';
  }, [stiA, stiB, stiC, stiD]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        Screeners are private and saved locally (not sent anywhere yet). If you’re worried, a confidential clinician consult is the fastest next step.
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-900">Function check (3 questions)</div>
            <Pill tone="neutral">Score {edScore}/9</Pill>
          </div>
          <div className="mt-2 space-y-2">
            <SliderRow label="Confidence" value={edA} min={0} max={3} onChange={(v) => setEdA(v)} />
            <SliderRow label="Consistency" value={edB} min={0} max={3} onChange={(v) => setEdB(v)} />
            <SliderRow label="Satisfaction" value={edC} min={0} max={3} onChange={(v) => setEdC(v)} />
          </div>
          <div className="mt-2 text-[11px] text-slate-600">
            Lower scores can be linked to stress, sleep, fitness, or medical issues — a clinician can help clarify.
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-900">STI risk check</div>
            <Pill tone={stiRisk === 'high' ? 'warn' : stiRisk === 'medium' ? 'neutral' : 'good'}>{stiRisk}</Pill>
          </div>
          <div className="mt-2 grid gap-2">
            <CheckToggle label="New partner recently" checked={stiA} onChange={setStiA} />
            <CheckToggle label="Any concerning symptoms" checked={stiB} onChange={setStiB} />
            <CheckToggle label="Unprotected activity recently" checked={stiC} onChange={setStiC} />
            <CheckToggle label="Worried about exposure" checked={stiD} onChange={setStiD} />
          </div>
          <div className="mt-2 text-[11px] text-slate-600">
            If risk is medium/high, consider confidential testing or a clinician consult.
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-900">Fertility goal</div>
          <Pill tone="neutral">{fertilityGoal}</Pill>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <MiniChoice label="Not now" active={fertilityGoal === 'not_now'} onClick={() => setFertilityGoal('not_now')} />
          <MiniChoice label="Planning" active={fertilityGoal === 'planning'} onClick={() => setFertilityGoal('planning')} />
          <MiniChoice label="Trying" active={fertilityGoal === 'trying'} onClick={() => setFertilityGoal('trying')} />
        </div>
        <div className="mt-2 text-[11px] text-slate-600">Used later to tailor content and referrals.</div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Btn
          variant="solid"
          onClick={() =>
            onSave({
              lastRunISO: today,
              edScore,
              stiRisk,
              fertilityGoal,
            })
          }
          leftIcon={<BadgeCheck className="h-4 w-4" />}
        >
          Save private results
        </Btn>
      </div>

      {initial ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <div className="flex items-center justify-between">
            <div className="text-slate-900">Last saved</div>
            <Pill tone="neutral">{initial.lastRunISO || '—'}</Pill>
          </div>
          <div className="mt-2 text-slate-600">
            Saved results are local-only for now. When you wire backend, store them as encrypted private records.
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CheckToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'flex items-center justify-between rounded-xl border px-3 py-2 text-xs transition',
        checked ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
      )}
    >
      <span>{label}</span>
      {checked ? <CheckCircle2 className="h-4 w-4" /> : <CircleDot />}
    </button>
  );
}

function MiniChoice({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-xl border px-3 py-2 text-xs transition',
        active ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
      )}
    >
      {label}
    </button>
  );
}

function CircleDot() {
  return <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-300" />;
}
