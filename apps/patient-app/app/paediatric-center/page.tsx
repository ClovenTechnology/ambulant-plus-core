// apps/patient-app/app/paediatric-center/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  Baby,
  BadgeCheck,
  BarChart3,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  HeartPulse,
  Info,
  Leaf,
  Lock,
  MinusCircle,
  Plus,
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
  | 'growth'
  | 'vaccines'
  | 'sick'
  | 'development'
  | 'nutrition'
  | 'chronic'
  | 'safety';

type ChildSex = 'female' | 'male' | 'other' | 'prefer_not';

type RiskLevel = 'Low' | 'Watch' | 'High';

type ChildProfile = {
  id: string;
  name: string;
  dobISO: string; // YYYY-MM-DD
  sex?: ChildSex | null;
  notes?: string | null;
};

type GrowthReading = {
  id: string;
  childId: string;
  dateISO: string;
  heightCm?: number | null;
  weightKg?: number | null;
  headCm?: number | null;
  note?: string | null;
};

type VaccineItem = {
  id: string;
  childId: string;
  label: string;
  dueISO?: string | null; // YYYY-MM-DD
  doneISO?: string | null; // YYYY-MM-DD
  note?: string | null;
  source?: 'template' | 'custom';
};

type SickSymptom =
  | 'fever'
  | 'cough_cold'
  | 'breathing'
  | 'vomiting'
  | 'diarrhea'
  | 'rash'
  | 'ear_pain'
  | 'injury'
  | 'other';

type SickLog = {
  id: string;
  childId: string;
  dateISO: string;
  symptom: SickSymptom;
  severity: 1 | 2 | 3 | 4 | 5;
  feverC?: number | null;
  fluidsOk?: 'yes' | 'some' | 'no' | null;
  breathingOk?: 'yes' | 'some' | 'no' | null;
  note?: string | null;
};

type DevAgeBand =
  | '0_6m'
  | '6_12m'
  | '1_2y'
  | '2_3y'
  | '4_5y'
  | '6_12y'
  | 'teen';

type DevCheck = {
  id: string;
  childId: string;
  weekOfISO: string; // Monday ISO
  ageBand: DevAgeBand;
  observed: string[]; // milestone keys
  notes?: string | null;
};

type NutritionDay = {
  id: string;
  childId: string;
  dateISO: string;
  mealsOk: 0 | 1 | 2 | 3;
  fruitVegServings: number; // 0..10
  waterCups: number; // 0..12
  activityMin: number; // 0..240
  sleepHours: number; // 0..16
  screenHours: number; // 0..12
  note?: string | null;
};

type ChronicLog = {
  id: string;
  childId: string;
  dateISO: string;
  tags: Array<'asthma' | 'allergy' | 'eczema' | 'other'>;
  breathingWheeze?: 'no' | 'some' | 'yes' | null;
  coughAtNight?: 'no' | 'some' | 'yes' | null;
  triggers?: Array<'dust' | 'pollen' | 'smoke' | 'pets' | 'exercise' | 'cold_air' | 'unknown'> | null;
  rashItch?: 'no' | 'some' | 'yes' | null;
  usedRescueRelief?: boolean | null; // tracking only (no dosing)
  note?: string | null;
};

type SafetyProfile = {
  childId: string;
  items: Record<
    | 'car_seat'
    | 'helmet'
    | 'meds_locked'
    | 'water_safety'
    | 'smoke_alarm'
    | 'window_guards'
    | 'poison_hotline'
    | 'school_contacts',
    boolean
  >;
  updatedISO: string;
};

type PaediatricState = {
  // privacy
  discreet: boolean;
  sensitiveHidden: boolean;

  // children
  children: ChildProfile[];
  activeChildId?: string | null;

  // tracking
  growth: GrowthReading[];
  vaccines: VaccineItem[];
  sick: SickLog[];
  development: DevCheck[];
  nutrition: NutritionDay[];
  chronic: ChronicLog[];
  safety: SafetyProfile[];
};

/* ---------------------------------
   Storage helpers
----------------------------------*/
const LS_KEY = 'ambulant.paediatricCenter.v1';

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

function isoToDate(iso: string) {
  const [y, m, d] = iso.split('-').map((x) => Number(x));
  return new Date(y, m - 1, d);
}

function isOnOrBefore(aISO: string, bISO: string) {
  return isoToDate(aISO).getTime() <= isoToDate(bISO).getTime();
}

function weekOfMondayISO(iso: string) {
  const [y, m, d] = iso.split('-').map((x) => Number(x));
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay(); // Sun=0 ... Sat=6
  const diffToMon = (day + 6) % 7; // Mon=0 ... Sun=6
  dt.setDate(dt.getDate() - diffToMon);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function ageInMonths(dobISO: string, asOfISO: string) {
  const dob = isoToDate(dobISO);
  const asOf = isoToDate(asOfISO);
  let months = (asOf.getFullYear() - dob.getFullYear()) * 12 + (asOf.getMonth() - dob.getMonth());
  if (asOf.getDate() < dob.getDate()) months -= 1;
  return Math.max(0, months);
}

function ageBandFromMonths(months: number): DevAgeBand {
  if (months < 6) return '0_6m';
  if (months < 12) return '6_12m';
  if (months < 24) return '1_2y';
  if (months < 36) return '2_3y';
  if (months < 60) return '4_5y';
  if (months < 156) return '6_12y';
  return 'teen';
}

function riskTone(r: RiskLevel): 'good' | 'warn' | 'bad' {
  if (r === 'Low') return 'good';
  if (r === 'Watch') return 'warn';
  return 'bad';
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
    <section className={cn('rounded-2xl border border-slate-200 bg-white p-4 shadow-sm', className)}>
      {(title || right) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {icon}
            {title ? <h2 className="text-sm font-semibold text-slate-900">{title}</h2> : null}
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
  items: Array<{ key: TabKey; label: string; icon?: React.ReactNode }>;
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
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] text-slate-600">{label}</div>
      {children}
    </label>
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
export default function PaediatricCenterPage() {
  const today = useMemo(() => todayISO(), []);
  const [tab, setTab] = useState<TabKey>('overview');

  // Modals
  const [triageOpen, setTriageOpen] = useState(false);
  const [addChildOpen, setAddChildOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [vaccinesOpen, setVaccinesOpen] = useState(false);

  // State
  const [state, setState] = useState<PaediatricState>(() => {
    const saved = safeJsonParse<PaediatricState>(
      typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null,
    );

    const demoChildId = uid('child');
    const base: PaediatricState = {
      discreet: true,
      sensitiveHidden: true,

      children: [
        {
          id: demoChildId,
          name: 'Child',
          dobISO: addDaysISO(todayISO(), -365 * 2), // demo-ish
          sex: 'prefer_not',
          notes: null,
        },
      ],
      activeChildId: demoChildId,

      growth: [],
      vaccines: [],
      sick: [],
      development: [],
      nutrition: [],
      chronic: [],
      safety: [],
    };

    const merged = { ...base, ...(saved || {}) };

    // Ensure at least one child exists
    if (!merged.children?.length) {
      merged.children = base.children;
      merged.activeChildId = base.activeChildId;
    }
    if (!merged.activeChildId || !merged.children.some((c) => c.id === merged.activeChildId)) {
      merged.activeChildId = merged.children[0]?.id || null;
    }
    return merged;
  });

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  // Helpers
  function notifyOk(msg: string) {
    toast(msg, { type: 'success' });
  }
  function notifyInfo(msg: string) {
    toast(msg, { type: 'info' });
  }

  const activeChild = useMemo(() => {
    return state.children.find((c) => c.id === state.activeChildId) || state.children[0] || null;
  }, [state.children, state.activeChildId]);

  // ✅ Keep page usable even in discreet / hide-values mode.
  // We rely on per-field masking (name/DOB/values), not on blocking whole sections.
  const showSensitiveContent = true;

  function displayChildName(c: ChildProfile | null) {
    if (!c) return 'Child';
    if (state.discreet) return 'Child';
    return c.name || 'Child';
  }

  function activeChildAgeMonths() {
    if (!activeChild) return 0;
    return ageInMonths(activeChild.dobISO, today);
  }

  // Derived: Growth snapshot
  const growthForChild = useMemo(() => {
    const cid = activeChild?.id;
    if (!cid) return [];
    return state.growth.filter((g) => g.childId === cid).sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
  }, [state.growth, activeChild?.id]);

  const latestGrowth = useMemo(() => growthForChild[0] || null, [growthForChild]);

  const growthTrendWeight = useMemo(() => {
    const items = [...growthForChild].reverse().slice(-10);
    return items.map((x) => Number(x.weightKg || NaN)).filter((n) => Number.isFinite(n));
  }, [growthForChild]);

  // Derived: Vaccines snapshot
  const vaccinesForChild = useMemo(() => {
    const cid = activeChild?.id;
    if (!cid) return [];
    return state.vaccines
      .filter((v) => v.childId === cid)
      .sort((a, b) => ((a.dueISO || '') < (b.dueISO || '') ? -1 : 1));
  }, [state.vaccines, activeChild?.id]);

  const vaccinesStats = useMemo(() => {
    const total = vaccinesForChild.length;
    const done = vaccinesForChild.filter((v) => !!v.doneISO).length;

    const due = vaccinesForChild.filter((v) => !v.doneISO && v.dueISO && isOnOrBefore(v.dueISO, today));
    const upcoming = vaccinesForChild.filter((v) => !v.doneISO && v.dueISO && !isOnOrBefore(v.dueISO, today));

    const risk: RiskLevel = due.length >= 2 ? 'High' : due.length === 1 ? 'Watch' : total > 0 ? 'Low' : 'Watch';

    return { total, done, dueCount: due.length, upcomingCount: upcoming.length, risk };
  }, [vaccinesForChild, today]);

  // Derived: Sick today?
  const sickToday = useMemo(() => {
    const cid = activeChild?.id;
    if (!cid) return null;
    return state.sick.find((s) => s.childId === cid && s.dateISO === today) || null;
  }, [state.sick, activeChild?.id, today]);

  // Derived: Dev check this week
  const devWeekOf = useMemo(() => weekOfMondayISO(today), [today]);
  const devForChild = useMemo(() => {
    const cid = activeChild?.id;
    if (!cid) return [];
    return state.development
      .filter((d) => d.childId === cid)
      .sort((a, b) => (a.weekOfISO < b.weekOfISO ? 1 : -1));
  }, [state.development, activeChild?.id]);

  const devThisWeek = useMemo(() => {
    const cid = activeChild?.id;
    if (!cid) return null;
    return devForChild.find((d) => d.weekOfISO === devWeekOf) || null;
  }, [devForChild, devWeekOf, activeChild?.id]);

  // Derived: Nutrition today
  const nutritionToday = useMemo(() => {
    const cid = activeChild?.id;
    if (!cid) return null;
    return state.nutrition.find((n) => n.childId === cid && n.dateISO === today) || null;
  }, [state.nutrition, activeChild?.id, today]);

  // Derived: Safety profile
  const safetyProfile = useMemo(() => {
    const cid = activeChild?.id;
    if (!cid) return null;
    return state.safety.find((x) => x.childId === cid) || null;
  }, [state.safety, activeChild?.id]);

  // Tabs
  const tabs = useMemo(
    () =>
      [
        { key: 'overview', label: 'Overview', icon: <BarChart3 className="h-4 w-4 text-slate-600" /> },
        { key: 'growth', label: 'Growth', icon: <Activity className="h-4 w-4 text-slate-600" /> },
        { key: 'vaccines', label: 'Vaccines', icon: <ShieldCheck className="h-4 w-4 text-slate-600" /> },
        { key: 'sick', label: 'Sick-day', icon: <AlertTriangle className="h-4 w-4 text-slate-600" /> },
        { key: 'development', label: 'Development', icon: <Brain className="h-4 w-4 text-slate-600" /> },
        { key: 'nutrition', label: 'Nutrition + Sleep', icon: <Leaf className="h-4 w-4 text-slate-600" /> },
        { key: 'chronic', label: 'Chronic Care', icon: <HeartPulse className="h-4 w-4 text-slate-600" /> },
        { key: 'safety', label: 'Safety', icon: <ShieldCheck className="h-4 w-4 text-slate-600" /> },
      ] as Array<{ key: TabKey; label: string; icon: React.ReactNode }>,
    [],
  );

  // Triage (informational only)
  const [triage, setTriage] = useState({
    main: 'fever' as SickSymptom,
    severe: false,
    breathingHard: false,
    verySleepy: false,
    dehydration: false,
    lastingDays: 0,
  });

  const triageResult = useMemo(() => {
    const base = {
      label: 'Track and reassess',
      detail: 'Log symptoms today. If it worsens, persists, or you feel unsure, a clinician check is a good next step.',
      action: 'Open Sick-day',
      go: () => setTab('sick'),
      tone: 'neutral' as const,
    };

    const urgent = triage.severe || triage.breathingHard || triage.verySleepy || triage.dehydration;

    if (urgent) {
      return {
        label: 'Get urgent medical help',
        detail:
          'If symptoms feel severe or there is breathing difficulty, unusual drowsiness, or signs of dehydration, it’s safest to seek urgent medical care now (nearest clinic / emergency services / trusted clinician).',
        action: 'Open safety note',
        go: () => setTab('safety'),
        tone: 'warn' as const,
      };
    }

    if (triage.lastingDays >= 2) {
      return {
        label: 'Consider a clinician check',
        detail: 'If symptoms persist beyond ~48 hours, a clinician check can help you get clarity and the right next steps.',
        action: 'Book check-up',
        go: () => notifyInfo('Wire this button to your /appointments flow when ready.'),
        tone: 'neutral' as const,
      };
    }

    return base;
  }, [triage]);

  /* ---------------------------------
     Mutations
  ----------------------------------*/
  function setActiveChild(childId: string) {
    setState((s) => ({ ...s, activeChildId: childId }));
  }

  function addChild(profile: Omit<ChildProfile, 'id'>) {
    const c: ChildProfile = { ...profile, id: uid('child') };
    setState((s) => ({
      ...s,
      children: [c, ...s.children],
      activeChildId: c.id,
    }));
    notifyOk('Child profile added (stored locally).');
  }

  function addGrowth(reading: Omit<GrowthReading, 'id' | 'childId' | 'dateISO'>) {
    if (!activeChild) return;
    const g: GrowthReading = {
      id: uid('g'),
      childId: activeChild.id,
      dateISO: today,
      heightCm: reading.heightCm ?? null,
      weightKg: reading.weightKg ?? null,
      headCm: reading.headCm ?? null,
      note: reading.note?.trim() || null,
    };

    setState((s) => {
      const rest = s.growth.filter((x) => !(x.childId === activeChild.id && x.dateISO === today));
      return { ...s, growth: [g, ...rest] };
    });
    notifyOk('Saved today’s growth entry.');
  }

  function ensureVaccineTemplate() {
    if (!activeChild) return;

    setState((s) => {
      const existing = s.vaccines.some((v) => v.childId === activeChild.id && v.source === 'template');
      if (existing) return s;

      // NOTE: This is intentionally a *generic checklist* (not an official schedule).
      // Users can edit/extend based on their clinic’s guidance.
      const tmpl: Array<Omit<VaccineItem, 'id' | 'childId'>> = [
        { label: 'Birth vaccines (as advised)', dueISO: null, doneISO: null, note: 'Confirm at clinic', source: 'template' },
        { label: '6-week visit vaccines (as advised)', dueISO: null, doneISO: null, note: 'Confirm at clinic', source: 'template' },
        { label: '10-week visit vaccines (as advised)', dueISO: null, doneISO: null, note: null, source: 'template' },
        { label: '14-week visit vaccines (as advised)', dueISO: null, doneISO: null, note: null, source: 'template' },
        { label: '9-month visit vaccines (as advised)', dueISO: null, doneISO: null, note: null, source: 'template' },
        { label: '18-month visit vaccines (as advised)', dueISO: null, doneISO: null, note: null, source: 'template' },
        { label: 'School-age boosters (as advised)', dueISO: null, doneISO: null, note: null, source: 'template' },
        { label: 'Flu (seasonal, if recommended)', dueISO: null, doneISO: null, note: 'Optional', source: 'template' },
      ];

      return {
        ...s,
        vaccines: [
          ...tmpl.map((t) => ({
            id: uid('vx'),
            childId: activeChild.id,
            label: t.label,
            dueISO: t.dueISO ?? null,
            doneISO: t.doneISO ?? null,
            note: t.note ?? null,
            source: t.source ?? 'template',
          })),
          ...s.vaccines,
        ],
      };
    });
  }

  function addVaccineCustom(label: string, dueISO?: string | null) {
    if (!activeChild) return;
    const v: VaccineItem = {
      id: uid('vx'),
      childId: activeChild.id,
      label: label.trim(),
      dueISO: dueISO || null,
      doneISO: null,
      note: null,
      source: 'custom',
    };
    setState((s) => ({ ...s, vaccines: [v, ...s.vaccines] }));
    notifyOk('Vaccine item added (local checklist).');
  }

  function toggleVaccineDone(id: string) {
    setState((s) => ({
      ...s,
      vaccines: s.vaccines.map((v) => (v.id === id ? { ...v, doneISO: v.doneISO ? null : today } : v)),
    }));
  }

  function addSickLog(entry: Omit<SickLog, 'id' | 'childId' | 'dateISO'>) {
    if (!activeChild) return;
    const e: SickLog = {
      id: uid('sick'),
      childId: activeChild.id,
      dateISO: today,
      symptom: entry.symptom,
      severity: entry.severity,
      feverC: entry.feverC ?? null,
      fluidsOk: entry.fluidsOk ?? null,
      breathingOk: entry.breathingOk ?? null,
      note: entry.note?.trim() || null,
    };

    setState((s) => {
      const rest = s.sick.filter((x) => !(x.childId === activeChild.id && x.dateISO === today));
      return { ...s, sick: [e, ...rest] };
    });
    notifyOk('Saved today’s sick-day log.');
  }

  function upsertDevThisWeek(observed: string[], notes?: string) {
    if (!activeChild) return;
    const months = activeChildAgeMonths();
    const band = ageBandFromMonths(months);
    const entry: DevCheck = {
      id: devThisWeek?.id || uid('dev'),
      childId: activeChild.id,
      weekOfISO: devWeekOf,
      ageBand: band,
      observed,
      notes: notes?.trim() || null,
    };

    setState((s) => {
      const rest = s.development.filter((d) => !(d.childId === activeChild.id && d.weekOfISO === devWeekOf));
      return { ...s, development: [entry, ...rest] };
    });
    notifyOk('Saved development check (this week).');
  }

  function upsertNutritionToday(entry: Omit<NutritionDay, 'id' | 'childId' | 'dateISO'>) {
    if (!activeChild) return;
    const n: NutritionDay = {
      id: nutritionToday?.id || uid('nut'),
      childId: activeChild.id,
      dateISO: today,
      mealsOk: entry.mealsOk,
      fruitVegServings: clamp(entry.fruitVegServings, 0, 10),
      waterCups: clamp(entry.waterCups, 0, 12),
      activityMin: clamp(entry.activityMin, 0, 240),
      sleepHours: clamp(entry.sleepHours, 0, 16),
      screenHours: clamp(entry.screenHours, 0, 12),
      note: entry.note?.trim() || null,
    };

    setState((s) => {
      const rest = s.nutrition.filter((x) => !(x.childId === activeChild.id && x.dateISO === today));
      return { ...s, nutrition: [n, ...rest] };
    });
    notifyOk('Saved today’s nutrition + sleep snapshot.');
  }

  function addChronicToday(entry: Omit<ChronicLog, 'id' | 'childId' | 'dateISO'>) {
    if (!activeChild) return;
    const c: ChronicLog = {
      id: uid('chr'),
      childId: activeChild.id,
      dateISO: today,
      tags: entry.tags,
      breathingWheeze: entry.breathingWheeze ?? null,
      coughAtNight: entry.coughAtNight ?? null,
      triggers: entry.triggers ?? null,
      rashItch: entry.rashItch ?? null,
      usedRescueRelief: entry.usedRescueRelief ?? null,
      note: entry.note?.trim() || null,
    };
    setState((s) => ({ ...s, chronic: [c, ...s.chronic] }));
    notifyOk('Saved chronic-care note (today).');
  }

  function ensureSafetyProfile() {
    if (!activeChild) return;

    setState((s) => {
      const exists = s.safety.some((x) => x.childId === activeChild.id);
      if (exists) return s;

      const p: SafetyProfile = {
        childId: activeChild.id,
        updatedISO: today,
        items: {
          car_seat: false,
          helmet: false,
          meds_locked: false,
          water_safety: false,
          smoke_alarm: false,
          window_guards: false,
          poison_hotline: false,
          school_contacts: false,
        },
      };
      return { ...s, safety: [p, ...s.safety] };
    });
  }

  function toggleSafety(item: keyof SafetyProfile['items']) {
    if (!activeChild) return;
    setState((s) => {
      const next = [...s.safety];
      const idx = next.findIndex((x) => x.childId === activeChild.id);
      if (idx === -1) return s;
      const cur = next[idx];
      next[idx] = {
        ...cur,
        updatedISO: today,
        items: { ...cur.items, [item]: !cur.items[item] },
      };
      return { ...s, safety: next };
    });
  }

  useEffect(() => {
    // Make sure vaccine template and safety profile exist for current child
    ensureVaccineTemplate();
    ensureSafetyProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChild?.id]);

  /* ---------------------------------
     Render helpers
  ----------------------------------*/
  function SectionLead({
    title,
    subtitle,
    right,
  }: {
    title: string;
    subtitle: string;
    right?: React.ReactNode;
  }) {
    return (
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          </div>
          <p className="mt-1 text-xs text-slate-600">{subtitle}</p>
        </div>
        {right}
      </div>
    );
  }

  function HiddenWrap({ children, show }: { children: React.ReactNode; show: boolean }) {
    // Kept for future, but we no longer block the whole section when privacy toggles are on.
    if (show) return <>{children}</>;
    return <>{children}</>;
  }

  function Tile({
    title,
    desc,
    icon,
    statusPill,
    actions,
    onOpen,
  }: {
    title: string;
    desc: string;
    icon: React.ReactNode;
    statusPill: React.ReactNode;
    actions: React.ReactNode;
    onOpen: () => void;
  }) {
    return (
      <Card
        title={<div className="flex items-center gap-2">{title}</div>}
        icon={<span className="text-slate-700">{icon}</span>}
        right={
          <div className="flex items-center gap-2">
            {statusPill}
            <Btn variant="ghost" onClick={onOpen} rightIcon={<ChevronRight className="h-4 w-4" />} title="Open section">
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
     Page shell (LIGHT)
  ----------------------------------*/
  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50 px-4 py-6 text-slate-900">
      <div className="mx-auto w-full max-w-6xl">
        {/* Header */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Baby className="h-5 w-5 text-slate-700" />
              <h1 className="text-xl font-semibold text-slate-900">Paediatric Center</h1>
              <Pill tone="neutral">Parent-friendly • Checklist + tracking</Pill>
              <Pill tone="neutral">Informational (not diagnosis)</Pill>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Growth, vaccines, development, sick-day guidance, nutrition, safety — with clear “next steps” and discreet mode by default.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:min-w-[360px]">
            <div className="grid grid-cols-2 gap-2">
              <Btn variant="outline" onClick={() => setTriageOpen(true)} leftIcon={<Timer className="h-4 w-4" />} size="md">
                30-sec triage
              </Btn>
              <Btn variant="outline" onClick={() => setPrivacyOpen(true)} leftIcon={<Lock className="h-4 w-4" />} size="md">
                Privacy
              </Btn>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Btn variant="outline" onClick={() => setAddChildOpen(true)} leftIcon={<Plus className="h-4 w-4" />} size="md">
                Add child
              </Btn>
              <Btn variant="outline" href="/family" leftIcon={<Users className="h-4 w-4" />} size="md" title="Link family members / guardians">
                Family
              </Btn>
            </div>
          </div>
        </div>

        {/* Child selector */}
        <Card
          title="Active child"
          icon={<Users className="h-4 w-4 text-slate-600" />}
          right={
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="neutral">Age: {activeChild ? `${activeChildAgeMonths()} mo` : '—'}</Pill>
              <Pill tone="neutral">Discreet: {state.discreet ? 'On' : 'Off'}</Pill>
            </div>
          }
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">{displayChildName(activeChild)}</div>
              <div className="mt-0.5 text-xs text-slate-600">
                {activeChild ? `DOB: ${state.discreet ? 'Hidden' : activeChild.dobISO}` : 'No child selected'}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={activeChild?.id || ''}
                onChange={(e) => setActiveChild(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
              >
                {state.children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {state.discreet ? 'Child' : c.name || 'Child'} • {ageInMonths(c.dobISO, today)} mo
                  </option>
                ))}
              </select>
              <Btn variant="outline" onClick={() => setVaccinesOpen(true)} leftIcon={<ShieldCheck className="h-4 w-4" />}>
                Vaccines
              </Btn>
              <Btn variant="outline" href="/myCare/devices" leftIcon={<Activity className="h-4 w-4" />}>
                Devices
              </Btn>
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <div className="mt-4">
          <Tabs active={tab} onChange={setTab} items={tabs} />
        </div>

        {/* Privacy note */}
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 text-slate-600" />
              <div>
                <div className="text-slate-900">Discreet mode hides child identifiers and numbers.</div>
                <div className="mt-0.5 text-slate-600">
                  Great for public spaces. Tracking still saves locally — this only changes what is shown on screen.
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
                title="Growth"
                desc="Height/weight/head (optional), trends, and quick notes — designed for calm tracking."
                icon={<Activity className="h-5 w-5" />}
                statusPill={
                  <Pill tone={latestGrowth ? 'good' : 'warn'}>
                    {latestGrowth ? `Last: ${state.sensitiveHidden ? 'Hidden' : latestGrowth.dateISO}` : 'No entry yet'}
                  </Pill>
                }
                actions={
                  <>
                    <Btn variant="solid" onClick={() => setTab('growth')} leftIcon={<Activity className="h-4 w-4" />}>
                      Log today
                    </Btn>
                    <Btn
                      variant="outline"
                      onClick={() => notifyInfo('Later: wire to Growth chart + percentiles from clinic data.')}
                      leftIcon={<BarChart3 className="h-4 w-4" />}
                    >
                      Percentiles (later)
                    </Btn>
                  </>
                }
                onOpen={() => setTab('growth')}
              />

              <Tile
                title="Vaccines"
                desc="A practical checklist you can adapt to your clinic schedule. Track due vs done."
                icon={<ShieldCheck className="h-5 w-5" />}
                statusPill={
                  <Pill tone={riskTone(vaccinesStats.risk)}>
                    {vaccinesStats.total ? `${vaccinesStats.done}/${vaccinesStats.total} done` : 'Set up checklist'}
                  </Pill>
                }
                actions={
                  <>
                    <Btn variant="solid" onClick={() => setTab('vaccines')} leftIcon={<ShieldCheck className="h-4 w-4" />}>
                      Open vaccines
                    </Btn>
                    <Btn variant="outline" onClick={() => setVaccinesOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
                      Add item
                    </Btn>
                  </>
                }
                onOpen={() => setTab('vaccines')}
              />

              <Tile
                title="Sick-day"
                desc="Quick symptom log + clear red flags. Not a diagnosis — just structure."
                icon={<AlertTriangle className="h-5 w-5" />}
                statusPill={<Pill tone={sickToday ? 'good' : 'warn'}>{sickToday ? 'Logged today' : 'No log today'}</Pill>}
                actions={
                  <>
                    <Btn variant="solid" onClick={() => setTab('sick')} leftIcon={<AlertTriangle className="h-4 w-4" />}>
                      Log today
                    </Btn>
                    <Btn variant="outline" onClick={() => setTriageOpen(true)} leftIcon={<Timer className="h-4 w-4" />}>
                      30-sec triage
                    </Btn>
                    <Btn variant="outline" onClick={() => notifyInfo('Wire this to your /appointments flow when ready.')} leftIcon={<Calendar className="h-4 w-4" />}>
                      Book check
                    </Btn>
                  </>
                }
                onOpen={() => setTab('sick')}
              />

              <Tile
                title="Development"
                desc="Weekly milestone prompts by age band. Track calmly, follow up if you’re worried."
                icon={<Brain className="h-5 w-5" />}
                statusPill={<Pill tone={devThisWeek ? 'good' : 'warn'}>{devThisWeek ? 'Checked this week' : 'Not checked'}</Pill>}
                actions={
                  <>
                    <Btn variant="solid" onClick={() => setTab('development')} leftIcon={<Brain className="h-4 w-4" />}>
                      Check this week
                    </Btn>
                    <Btn variant="outline" onClick={() => notifyInfo('Later: route to developmental screening consult.')} leftIcon={<Stethoscope className="h-4 w-4" />}>
                      Ask clinician (later)
                    </Btn>
                  </>
                }
                onOpen={() => setTab('development')}
              />

              <Tile
                title="Nutrition + Sleep"
                desc="Simple daily snapshot: meals, fruit/veg, water, activity, sleep, screens."
                icon={<Leaf className="h-5 w-5" />}
                statusPill={<Pill tone={nutritionToday ? 'good' : 'warn'}>{nutritionToday ? 'Saved today' : 'Not saved'}</Pill>}
                actions={
                  <>
                    <Btn variant="solid" onClick={() => setTab('nutrition')} leftIcon={<Leaf className="h-4 w-4" />}>
                      Log today
                    </Btn>
                    <Btn variant="outline" onClick={() => notifyInfo('Later: connect to your existing reminders/scheduler.')} leftIcon={<Calendar className="h-4 w-4" />}>
                      Add reminders (later)
                    </Btn>
                  </>
                }
                onOpen={() => setTab('nutrition')}
              />

              <Tile
                title="Safety"
                desc="Home + travel essentials: car seat, meds locked, water safety, alarms, contacts."
                icon={<ShieldCheck className="h-5 w-5" />}
                statusPill={<Pill tone="neutral">{safetyProfile ? 'Checklist' : 'Set up'}</Pill>}
                actions={
                  <>
                    <Btn variant="solid" onClick={() => setTab('safety')} leftIcon={<ShieldCheck className="h-4 w-4" />}>
                      Open checklist
                    </Btn>
                    <Btn variant="outline" onClick={() => notifyInfo('Later: add school emergency card export.')} leftIcon={<FileText className="h-4 w-4" />}>
                      Emergency card (later)
                    </Btn>
                  </>
                }
                onOpen={() => setTab('safety')}
              />
            </div>
          ) : null}

          {/* Growth */}
          {tab === 'growth' ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <SectionLead
                  title="Growth"
                  subtitle="Track the basics. If anything concerns you, a clinician check is the best next step."
                  right={
                    <div className="flex flex-wrap gap-2">
                      <Btn variant="solid" onClick={() => notifyInfo('Wire to /appointments when ready.')} leftIcon={<Calendar className="h-4 w-4" />}>
                        Book check-up
                      </Btn>
                      <Btn variant="outline" onClick={() => setPrivacyOpen(true)} leftIcon={<Lock className="h-4 w-4" />}>
                        Privacy
                      </Btn>
                    </div>
                  }
                />

                <HiddenWrap show={showSensitiveContent}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Card
                      title="Latest snapshot"
                      icon={<Activity className="h-4 w-4 text-slate-600" />}
                      right={<Pill tone={latestGrowth ? 'good' : 'warn'}>{latestGrowth ? 'Saved' : 'No entry'}</Pill>}
                    >
                      <div className="text-xs text-slate-600">Most recent entry for {displayChildName(activeChild)}.</div>

                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="text-slate-900">Date</div>
                          <Pill tone="neutral">{state.sensitiveHidden ? 'Hidden' : latestGrowth?.dateISO || '—'}</Pill>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <ValueChip label="Height" value={latestGrowth?.heightCm ?? null} unit="cm" hidden={state.sensitiveHidden} />
                          <ValueChip label="Weight" value={latestGrowth?.weightKg ?? null} unit="kg" hidden={state.sensitiveHidden} />
                          <ValueChip label="Head" value={latestGrowth?.headCm ?? null} unit="cm" hidden={state.sensitiveHidden} />
                        </div>
                        <div className="mt-2 text-slate-600">{latestGrowth?.note || 'Tip: add a short note (e.g., “after clinic visit”).'}</div>
                      </div>

                      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
                        <div className="flex items-start gap-2">
                          <Info className="mt-0.5 h-4 w-4 text-slate-600" />
                          <div>
                            <div className="text-slate-900">Good tracking rule</div>
                            <div className="mt-1 text-slate-600">Compare over time, not single numbers. If you notice a sudden change, book a check.</div>
                          </div>
                        </div>
                      </div>
                    </Card>

                    <Card title="Weight trend (last 10)" icon={<BarChart3 className="h-4 w-4 text-slate-600" />}>
                      <div className="text-xs text-slate-600">A lightweight trend line (demo-ready).</div>
                      <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div>
                          <div className="text-[11px] text-slate-600">Trend</div>
                          <div className="mt-0.5 text-sm font-semibold text-slate-900">{growthTrendWeight.length >= 2 ? 'Active' : 'Add more entries'}</div>
                          <div className="mt-0.5 text-[11px] text-slate-600">{growthTrendWeight.length ? `${growthTrendWeight.length} points` : 'No data yet'}</div>
                        </div>
                        <div>{growthTrendWeight.length >= 2 && !state.sensitiveHidden ? <MiniSparkline values={growthTrendWeight} /> : null}</div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Btn variant="outline" onClick={() => notifyInfo('Later: show percentiles + clinician notes from reports.')} leftIcon={<Sparkles className="h-4 w-4" />}>
                          InsightCore (later)
                        </Btn>
                        <Btn variant="outline" href="/vitals" leftIcon={<Activity className="h-4 w-4" />}>
                          Vitals
                        </Btn>
                      </div>
                    </Card>
                  </div>

                  <Card title="Log today" icon={<BadgeCheck className="h-4 w-4 text-slate-600" />}>
                    <GrowthLogger onSave={addGrowth} />
                  </Card>

                  <Card title="History (local)" icon={<ClipboardList className="h-4 w-4 text-slate-600" />}>
                    <div className="text-xs text-slate-600">Last 8 entries</div>
                    <div className="mt-2 grid gap-2">
                      {growthForChild.slice(0, 8).map((g) => (
                        <div key={g.id} className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
                          <div className="flex items-center justify-between">
                            <div className="text-slate-900">{state.sensitiveHidden ? 'Hidden' : g.dateISO}</div>
                            <Pill tone="neutral">Local</Pill>
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            <ValueChip label="Ht" value={g.heightCm ?? null} unit="cm" hidden={state.sensitiveHidden} compact />
                            <ValueChip label="Wt" value={g.weightKg ?? null} unit="kg" hidden={state.sensitiveHidden} compact />
                            <ValueChip label="Head" value={g.headCm ?? null} unit="cm" hidden={state.sensitiveHidden} compact />
                          </div>
                          <div className="mt-2 text-slate-600">{g.note || '—'}</div>
                        </div>
                      ))}
                      {growthForChild.length === 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">No growth entries yet.</div>
                      ) : null}
                    </div>
                  </Card>
                </HiddenWrap>
              </div>

              <div className="lg:col-span-1">
                <Card title="Next best actions" icon={<ChevronRight className="h-4 w-4 text-slate-600" />}>
                  <div className="space-y-3 text-xs text-slate-700">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-slate-900">If you’re unsure</div>
                      <div className="mt-1 text-slate-600">A clinician check is the fastest way to confirm growth is on track and address concerns.</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-slate-900">Tracking cadence</div>
                      <div className="mt-1 text-slate-600">Monthly is often enough unless advised otherwise.</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Btn variant="solid" onClick={() => notifyInfo('Wire to /appointments when ready.')} leftIcon={<Calendar className="h-4 w-4" />}>
                        Book
                      </Btn>
                      <Btn variant="outline" onClick={() => setPrivacyOpen(true)} leftIcon={<Lock className="h-4 w-4" />}>
                        Privacy
                      </Btn>
                    </div>
                  </div>
                </Card>

                <Card title="Quick links" icon={<ChevronRight className="h-4 w-4 text-slate-600" />}>
                  <div className="flex flex-wrap gap-2">
                    <Btn variant="outline" href="/family" leftIcon={<Users className="h-4 w-4" />}>
                      Family
                    </Btn>
                    <Btn variant="outline" onClick={() => setTriageOpen(true)} leftIcon={<Timer className="h-4 w-4" />}>
                      30-sec triage
                    </Btn>
                    <Btn variant="outline" onClick={() => setTab('vaccines')} leftIcon={<ShieldCheck className="h-4 w-4" />}>
                      Vaccines
                    </Btn>
                  </div>
                </Card>
              </div>
            </div>
          ) : null}

          {/* Vaccines */}
          {tab === 'vaccines' ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <SectionLead
                  title="Vaccines"
                  subtitle="A practical checklist you can adapt to your clinic schedule. Confirm details with your clinician."
                  right={
                    <div className="flex flex-wrap gap-2">
                      <Btn variant="solid" onClick={() => setVaccinesOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
                        Add item
                      </Btn>
                      <Btn
                        variant="outline"
                        onClick={() => notifyInfo('Later: wire to MedReach / lab + clinic bookings if needed.')}
                        leftIcon={<Calendar className="h-4 w-4" />}
                      >
                        Clinic booking (later)
                      </Btn>
                      <Btn variant="outline" onClick={() => setPrivacyOpen(true)} leftIcon={<Lock className="h-4 w-4" />}>
                        Privacy
                      </Btn>
                    </div>
                  }
                />

                <HiddenWrap show={showSensitiveContent}>
                  <Card
                    title="Progress"
                    icon={<ShieldCheck className="h-4 w-4 text-slate-600" />}
                    right={
                      <Pill tone={riskTone(vaccinesStats.risk)}>
                        {vaccinesStats.done}/{vaccinesStats.total || 0} done
                      </Pill>
                    }
                  >
                    <div className="grid gap-2 sm:grid-cols-3">
                      <InfoBox title="Due now" desc={`${vaccinesStats.dueCount} item(s)`} tone={vaccinesStats.dueCount ? 'warn' : 'good'} />
                      <InfoBox title="Upcoming" desc={`${vaccinesStats.upcomingCount} item(s)`} tone="neutral" />
                      <InfoBox title="Checklist" desc={`${vaccinesStats.total || 0} total`} tone="neutral" />
                    </div>

                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                      <div className="flex items-start gap-2">
                        <Info className="mt-0.5 h-4 w-4 text-slate-600" />
                        <div>
                          <div className="text-slate-900">Important</div>
                          <div className="mt-1 text-slate-600">
                            This is a checklist, not a country-specific immunization schedule. Keep your clinic card as the source of truth.
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card title="Checklist" icon={<ClipboardList className="h-4 w-4 text-slate-600" />}>
                    <VaccineList
                      items={vaccinesForChild}
                      hidden={state.sensitiveHidden}
                      onToggleDone={toggleVaccineDone}
                      onRemove={(id) => setState((s) => ({ ...s, vaccines: s.vaccines.filter((v) => v.id !== id) }))}
                    />
                  </Card>
                </HiddenWrap>
              </div>

              <div className="lg:col-span-1">
                <Card title="Next best actions" icon={<ChevronRight className="h-4 w-4 text-slate-600" />}>
                  <div className="space-y-3 text-xs text-slate-700">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-slate-900">If anything is due</div>
                      <div className="mt-1 text-slate-600">Book your clinic visit and bring your vaccine record. This list helps you ask the right questions.</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Btn variant="solid" onClick={() => notifyInfo('Wire to /appointments when ready.')} leftIcon={<Calendar className="h-4 w-4" />}>
                        Book
                      </Btn>
                      <Btn variant="outline" onClick={() => setVaccinesOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
                        Add
                      </Btn>
                    </div>
                  </div>
                </Card>

                <Card title="Quick links" icon={<ChevronRight className="h-4 w-4 text-slate-600" />}>
                  <div className="flex flex-wrap gap-2">
                    <Btn variant="outline" onClick={() => setTab('sick')} leftIcon={<AlertTriangle className="h-4 w-4" />}>
                      Sick-day
                    </Btn>
                    <Btn variant="outline" onClick={() => setTab('growth')} leftIcon={<Activity className="h-4 w-4" />}>
                      Growth
                    </Btn>
                    <Btn variant="outline" href="/family" leftIcon={<Users className="h-4 w-4" />}>
                      Family
                    </Btn>
                  </div>
                </Card>
              </div>
            </div>
          ) : null}

          {/* Sick-day */}
          {tab === 'sick' ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <SectionLead
                  title="Sick-day"
                  subtitle="Log symptoms and watch for red flags. If severe or you feel unsure, seek urgent medical help."
                  right={
                    <div className="flex flex-wrap gap-2">
                      <Btn variant="solid" onClick={() => setTriageOpen(true)} leftIcon={<Timer className="h-4 w-4" />}>
                        30-sec triage
                      </Btn>
                      <Btn variant="outline" onClick={() => notifyInfo('Wire to /appointments when ready.')} leftIcon={<Calendar className="h-4 w-4" />}>
                        Book check
                      </Btn>
                      <Btn variant="outline" onClick={() => setPrivacyOpen(true)} leftIcon={<Lock className="h-4 w-4" />}>
                        Privacy
                      </Btn>
                    </div>
                  }
                />

                <HiddenWrap show={showSensitiveContent}>
                  <Card title="Today’s log" icon={<AlertTriangle className="h-4 w-4 text-slate-600" />} right={<Pill tone={sickToday ? 'good' : 'warn'}>{sickToday ? 'Saved today' : 'Not saved'}</Pill>}>
                    <SickLogger existing={sickToday} onSave={addSickLog} />
                  </Card>

                  <Card title="Simple red flags (non-scary)" icon={<AlertTriangle className="h-4 w-4 text-slate-600" />}>
                    <ul className="list-disc space-y-1 pl-5 text-xs text-slate-700">
                      <li>Breathing difficulty (working hard to breathe)</li>
                      <li>Unusual drowsiness or hard to wake</li>
                      <li>Signs of dehydration (very dry mouth, very little urine)</li>
                      <li>Symptoms that feel severe or suddenly worsen</li>
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Btn variant="solid" onClick={() => notifyInfo('Wire to urgent guidance / booking when ready.')} leftIcon={<Stethoscope className="h-4 w-4" />}>
                        Talk to clinician
                      </Btn>
                      <Btn variant="outline" onClick={() => setTab('safety')} leftIcon={<ShieldCheck className="h-4 w-4" />}>
                        Safety checklist
                      </Btn>
                    </div>
                  </Card>

                  <Card title="History (local)" icon={<ClipboardList className="h-4 w-4 text-slate-600" />}>
                    <div className="text-xs text-slate-600">Last 7 logs</div>
                    <div className="mt-2 grid gap-2">
                      {state.sick
                        .filter((x) => x.childId === activeChild?.id)
                        .slice(0, 7)
                        .map((x) => (
                          <div key={x.id} className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
                            <div className="flex items-center justify-between">
                              <div className="text-slate-900">{state.sensitiveHidden ? 'Hidden' : x.dateISO}</div>
                              <Pill tone="neutral">{x.symptom.replaceAll('_', ' ')}</Pill>
                            </div>
                            <div className="mt-2 text-slate-700">
                              Severity {state.sensitiveHidden ? 'Hidden' : `${x.severity}/5`} • Fever{' '}
                              {state.sensitiveHidden ? 'Hidden' : x.feverC != null ? `${x.feverC}°C` : '—'}
                            </div>
                            <div className="mt-1 text-slate-600">{x.note || '—'}</div>
                          </div>
                        ))}
                      {state.sick.filter((x) => x.childId === activeChild?.id).length === 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">No sick-day logs yet.</div>
                      ) : null}
                    </div>
                  </Card>
                </HiddenWrap>
              </div>

              <div className="lg:col-span-1">
                <Card title="Next best actions" icon={<ChevronRight className="h-4 w-4 text-slate-600" />}>
                  <div className="space-y-3 text-xs text-slate-700">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-slate-900">Most useful habit</div>
                      <div className="mt-1 text-slate-600">Log symptoms once per day. Patterns beat panic.</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-slate-900">When to escalate</div>
                      <div className="mt-1 text-slate-600">If severe, sudden, or you’re worried — trust that signal and seek help.</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Btn variant="solid" onClick={() => notifyInfo('Wire to /appointments when ready.')} leftIcon={<Calendar className="h-4 w-4" />}>
                        Book
                      </Btn>
                      <Btn variant="outline" onClick={() => setTriageOpen(true)} leftIcon={<Timer className="h-4 w-4" />}>
                        Triage
                      </Btn>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          ) : null}

          {/* Development */}
          {tab === 'development' ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <SectionLead
                  title="Development"
                  subtitle="Weekly prompts by age band. If you’re concerned, a clinician check is the best next step."
                  right={
                    <div className="flex flex-wrap gap-2">
                      <Btn variant="solid" onClick={() => notifyInfo('Later: route to developmental screening consult.')} leftIcon={<Stethoscope className="h-4 w-4" />}>
                        Ask clinician (later)
                      </Btn>
                      <Btn variant="outline" onClick={() => setPrivacyOpen(true)} leftIcon={<Lock className="h-4 w-4" />}>
                        Privacy
                      </Btn>
                    </div>
                  }
                />

                <HiddenWrap show={showSensitiveContent}>
                  <Card title="This week’s check" icon={<Brain className="h-4 w-4 text-slate-600" />} right={<Pill tone={devThisWeek ? 'good' : 'warn'}>{devThisWeek ? 'Saved' : 'Not saved'}</Pill>}>
                    <DevChecklist
                      ageBand={ageBandFromMonths(activeChildAgeMonths())}
                      initialObserved={devThisWeek?.observed || []}
                      initialNotes={devThisWeek?.notes || ''}
                      onSave={(obs, notes) => upsertDevThisWeek(obs, notes)}
                    />
                  </Card>

                  <Card title="Why this helps" icon={<Info className="h-4 w-4 text-slate-600" />}>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <InfoBox title="Calm tracking" desc="Noticing patterns early helps you ask better questions at clinic." tone="neutral" />
                      <InfoBox title="No shame" desc="Kids develop at different rates. If worried, book a check." tone="neutral" />
                      <InfoBox title="Small notes" desc="Add context (new school, sleep changes, illness)." tone="neutral" />
                      <InfoBox title="Next step" desc="If a skill is missing and you’re concerned, talk to a clinician." tone="neutral" />
                    </div>
                  </Card>
                </HiddenWrap>
              </div>

              <div className="lg:col-span-1">
                <Card title="History (local)" icon={<ClipboardList className="h-4 w-4 text-slate-600" />}>
                  <div className="text-xs text-slate-600">Last 6 weeks</div>
                  <div className="mt-2 grid gap-2">
                    {devForChild.slice(0, 6).map((d) => (
                      <div key={d.id} className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="text-slate-900">{state.sensitiveHidden ? 'Hidden' : d.weekOfISO}</div>
                          <Pill tone="neutral">{d.ageBand.replaceAll('_', '')}</Pill>
                        </div>
                        <div className="mt-2 text-slate-700">{d.observed.length} ticked</div>
                        <div className="mt-1 text-slate-600">{d.notes || '—'}</div>
                      </div>
                    ))}
                    {devForChild.length === 0 ? (
                      <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">No development checks yet.</div>
                    ) : null}
                  </div>
                </Card>

                <Card title="Quick links" icon={<ChevronRight className="h-4 w-4 text-slate-600" />}>
                  <div className="flex flex-wrap gap-2">
                    <Btn variant="outline" onClick={() => setTab('nutrition')} leftIcon={<Leaf className="h-4 w-4" />}>
                      Nutrition
                    </Btn>
                    <Btn variant="outline" onClick={() => setTab('sick')} leftIcon={<AlertTriangle className="h-4 w-4" />}>
                      Sick-day
                    </Btn>
                    <Btn variant="outline" href="/family" leftIcon={<Users className="h-4 w-4" />}>
                      Family
                    </Btn>
                  </div>
                </Card>
              </div>
            </div>
          ) : null}

          {/* Nutrition */}
          {tab === 'nutrition' ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <SectionLead
                  title="Nutrition + Sleep"
                  subtitle="A simple daily snapshot. Small wins compound."
                  right={
                    <div className="flex flex-wrap gap-2">
                      <Btn
                        variant="outline"
                        onClick={() => notifyInfo('Later: hook this to your existing reminders/scheduler (sleep, hydration, meals).')}
                        leftIcon={<Calendar className="h-4 w-4" />}
                      >
                        Reminders (later)
                      </Btn>
                      <Btn variant="outline" onClick={() => setPrivacyOpen(true)} leftIcon={<Lock className="h-4 w-4" />}>
                        Privacy
                      </Btn>
                    </div>
                  }
                />

                <HiddenWrap show={showSensitiveContent}>
                  <Card title="Today snapshot" icon={<Leaf className="h-4 w-4 text-slate-600" />} right={<Pill tone={nutritionToday ? 'good' : 'warn'}>{nutritionToday ? 'Saved today' : 'Not saved'}</Pill>}>
                    <NutritionCheckin existing={nutritionToday} onSave={upsertNutritionToday} />
                  </Card>

                  <Card title="Micro-habits (easy wins)" icon={<Target className="h-4 w-4 text-slate-600" />}>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <HabitChip title="Water with meals" desc="Simple hydration anchor." />
                      <HabitChip title="One fruit/veg" desc="Add one serving today." />
                      <HabitChip title="10 minutes outside" desc="Light activity counts." />
                      <HabitChip title="Screens off early" desc="Better sleep wind-down." />
                    </div>
                  </Card>

                  <Card title="History (local)" icon={<ClipboardList className="h-4 w-4 text-slate-600" />}>
                    <div className="text-xs text-slate-600">Last 7 days</div>
                    <div className="mt-2 grid gap-2">
                      {state.nutrition
                        .filter((x) => x.childId === activeChild?.id)
                        .slice(0, 7)
                        .map((n) => (
                          <div key={n.id} className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
                            <div className="flex items-center justify-between">
                              <div className="text-slate-900">{state.sensitiveHidden ? 'Hidden' : n.dateISO}</div>
                              <Pill tone="neutral">Local</Pill>
                            </div>
                            <div className="mt-2 text-slate-700">
                              Meals: {state.sensitiveHidden ? 'Hidden' : `${n.mealsOk}/3`} • Sleep:{' '}
                              {state.sensitiveHidden ? 'Hidden' : `${n.sleepHours}h`} • Activity:{' '}
                              {state.sensitiveHidden ? 'Hidden' : `${n.activityMin}m`}
                            </div>
                            <div className="mt-1 text-slate-600">{n.note || '—'}</div>
                          </div>
                        ))}
                      {state.nutrition.filter((x) => x.childId === activeChild?.id).length === 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">No nutrition snapshots yet.</div>
                      ) : null}
                    </div>
                  </Card>
                </HiddenWrap>
              </div>

              <div className="lg:col-span-1">
                <Card title="Shortcuts" icon={<ChevronRight className="h-4 w-4 text-slate-600" />}>
                  <div className="flex flex-wrap gap-2">
                    <Btn variant="solid" onClick={() => setTab('growth')} leftIcon={<Activity className="h-4 w-4" />}>
                      Growth
                    </Btn>
                    <Btn variant="outline" onClick={() => setTab('development')} leftIcon={<Brain className="h-4 w-4" />}>
                      Development
                    </Btn>
                    <Btn variant="outline" onClick={() => setTab('safety')} leftIcon={<ShieldCheck className="h-4 w-4" />}>
                      Safety
                    </Btn>
                  </div>
                </Card>

                <Card title="Notes" icon={<Info className="h-4 w-4 text-slate-600" />}>
                  <div className="space-y-3 text-xs text-slate-700">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-slate-900">Keep it simple</div>
                      <div className="mt-1 text-slate-600">Consistent meals, sleep, and movement matter more than perfect plans.</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-slate-900">If appetite changes</div>
                      <div className="mt-1 text-slate-600">Track for a few days and consider a clinician check if it persists or is worrying.</div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          ) : null}

          {/* Chronic care */}
          {tab === 'chronic' ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <SectionLead
                  title="Chronic Care (asthma / allergy / eczema)"
                  subtitle="A lightweight diary for patterns and triggers. Tracking only — no dosing or treatment advice."
                  right={
                    <div className="flex flex-wrap gap-2">
                      <Btn variant="solid" onClick={() => notifyInfo('Wire to clinician care plan + reports when ready.')} leftIcon={<FileText className="h-4 w-4" />}>
                        Care plan (later)
                      </Btn>
                      <Btn variant="outline" onClick={() => setPrivacyOpen(true)} leftIcon={<Lock className="h-4 w-4" />}>
                        Privacy
                      </Btn>
                    </div>
                  }
                />

                <HiddenWrap show={showSensitiveContent}>
                  <Card title="Today diary" icon={<HeartPulse className="h-4 w-4 text-slate-600" />}>
                    <ChronicDiary onSave={addChronicToday} />
                  </Card>

                  <Card title="History (local)" icon={<ClipboardList className="h-4 w-4 text-slate-600" />}>
                    <div className="text-xs text-slate-600">Last 10 entries</div>
                    <div className="mt-2 grid gap-2">
                      {state.chronic
                        .filter((x) => x.childId === activeChild?.id)
                        .slice(0, 10)
                        .map((x) => (
                          <div key={x.id} className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
                            <div className="flex items-center justify-between">
                              <div className="text-slate-900">{state.sensitiveHidden ? 'Hidden' : x.dateISO}</div>
                              <Pill tone="neutral">{x.tags.join(', ') || '—'}</Pill>
                            </div>
                            <div className="mt-2 text-slate-700">
                              Wheeze: {x.breathingWheeze || '—'} • Night cough: {x.coughAtNight || '—'} • Itch/rash: {x.rashItch || '—'}
                            </div>
                            <div className="mt-1 text-slate-600">{x.note || '—'}</div>
                          </div>
                        ))}
                      {state.chronic.filter((x) => x.childId === activeChild?.id).length === 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">No chronic diary entries yet.</div>
                      ) : null}
                    </div>
                  </Card>
                </HiddenWrap>
              </div>

              <div className="lg:col-span-1">
                <Card title="Why this helps" icon={<Info className="h-4 w-4 text-slate-600" />}>
                  <div className="space-y-3 text-xs text-slate-700">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-slate-900">Patterns</div>
                      <div className="mt-1 text-slate-600">Triggers and symptoms become obvious when written down.</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-slate-900">Clinician visits</div>
                      <div className="mt-1 text-slate-600">Bring this log to appointments — it helps clinicians decide next steps faster.</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Btn variant="solid" onClick={() => notifyInfo('Wire to /appointments when ready.')} leftIcon={<Calendar className="h-4 w-4" />}>
                        Book
                      </Btn>
                      <Btn variant="outline" onClick={() => setTab('sick')} leftIcon={<AlertTriangle className="h-4 w-4" />}>
                        Sick-day
                      </Btn>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          ) : null}

          {/* Safety */}
          {tab === 'safety' ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <SectionLead
                  title="Safety"
                  subtitle="A practical checklist. If triage indicates urgent care, this is your ‘go-to’ list."
                  right={
                    <div className="flex flex-wrap gap-2">
                      <Btn variant="solid" onClick={() => notifyInfo('Later: export emergency contacts + medical summary PDF.')} leftIcon={<FileText className="h-4 w-4" />}>
                        Export card (later)
                      </Btn>
                      <Btn variant="outline" onClick={() => setPrivacyOpen(true)} leftIcon={<Lock className="h-4 w-4" />}>
                        Privacy
                      </Btn>
                    </div>
                  }
                />

                <HiddenWrap show={showSensitiveContent}>
                  <Card title="Checklist" icon={<ShieldCheck className="h-4 w-4 text-slate-600" />}>
                    <SafetyChecklist items={safetyProfile?.items || null} onToggle={toggleSafety} updatedISO={safetyProfile?.updatedISO || today} />
                  </Card>

                  <Card title="If urgent" icon={<AlertTriangle className="h-4 w-4 text-slate-600" />}>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                      If symptoms are severe (especially breathing issues or unusual drowsiness), seek urgent medical care now. This app can help you track and communicate — it does not replace emergency care.
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Btn variant="solid" onClick={() => notifyInfo('Wire to emergency guidance / local numbers as per region policy.')} leftIcon={<AlertTriangle className="h-4 w-4" />}>
                        Emergency guidance (later)
                      </Btn>
                      <Btn variant="outline" onClick={() => setTriageOpen(true)} leftIcon={<Timer className="h-4 w-4" />}>
                        Triage
                      </Btn>
                    </div>
                  </Card>
                </HiddenWrap>
              </div>

              <div className="lg:col-span-1">
                <Card title="Quick links" icon={<ChevronRight className="h-4 w-4 text-slate-600" />}>
                  <div className="flex flex-wrap gap-2">
                    <Btn variant="outline" onClick={() => setTab('sick')} leftIcon={<AlertTriangle className="h-4 w-4" />}>
                      Sick-day
                    </Btn>
                    <Btn variant="outline" onClick={() => setTab('vaccines')} leftIcon={<ShieldCheck className="h-4 w-4" />}>
                      Vaccines
                    </Btn>
                    <Btn variant="outline" href="/family" leftIcon={<Users className="h-4 w-4" />}>
                      Family
                    </Btn>
                  </div>
                </Card>

                <Card title="What to store (later)" icon={<Info className="h-4 w-4 text-slate-600" />}>
                  <div className="space-y-2 text-xs text-slate-700">
                    <InfoBox title="Allergies" desc="Add to child profile + emergency card export." tone="neutral" />
                    <InfoBox title="Emergency contacts" desc="Guardian, school, clinic." tone="neutral" />
                    <InfoBox title="Care plan" desc="Asthma/allergy plan from clinician." tone="neutral" />
                  </div>
                </Card>
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
              Answer quickly. If anything feels severe or unsafe, it’s okay to seek urgent help right away.
            </div>

            <SelectRow
              label="Main concern"
              value={triage.main}
              options={[
                { value: 'fever', label: 'Fever' },
                { value: 'cough_cold', label: 'Cough / cold' },
                { value: 'breathing', label: 'Breathing concerns' },
                { value: 'vomiting', label: 'Vomiting' },
                { value: 'diarrhea', label: 'Diarrhea' },
                { value: 'rash', label: 'Rash' },
                { value: 'ear_pain', label: 'Ear pain' },
                { value: 'injury', label: 'Injury' },
                { value: 'other', label: 'Other' },
              ]}
              onChange={(v) => setTriage((t) => ({ ...t, main: v as SickSymptom }))}
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

            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle
                label="Severe / very worrying?"
                checked={triage.severe}
                onChange={(v) => setTriage((t) => ({ ...t, severe: v }))}
                hint="Does it feel severe, escalating, or frightening?"
                icon={<AlertTriangle className="h-4 w-4 text-slate-600" />}
              />
              <Toggle
                label="Breathing difficulty?"
                checked={triage.breathingHard}
                onChange={(v) => setTriage((t) => ({ ...t, breathingHard: v }))}
                hint="Working hard to breathe or struggling."
                icon={<AlertTriangle className="h-4 w-4 text-slate-600" />}
              />
              <Toggle
                label="Unusually sleepy?"
                checked={triage.verySleepy}
                onChange={(v) => setTriage((t) => ({ ...t, verySleepy: v }))}
                hint="Hard to wake or unusually drowsy."
                icon={<AlertTriangle className="h-4 w-4 text-slate-600" />}
              />
              <Toggle
                label="Possible dehydration?"
                checked={triage.dehydration}
                onChange={(v) => setTriage((t) => ({ ...t, dehydration: v }))}
                hint="Very dry mouth / very little urine."
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
          open={addChildOpen}
          title={
            <span className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add child profile (local)
            </span>
          }
          onClose={() => setAddChildOpen(false)}
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Btn variant="outline" onClick={() => setAddChildOpen(false)}>
                Close
              </Btn>
            </div>
          }
        >
          <AddChildForm
            onSave={(p) => {
              addChild(p);
              setAddChildOpen(false);
            }}
          />
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            Tip: later you can hydrate this from <span className="font-semibold">/family</span> and store centrally.
          </div>
        </Modal>

        <Modal
          open={vaccinesOpen}
          title={
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Add vaccine item
            </span>
          }
          onClose={() => setVaccinesOpen(false)}
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Btn variant="outline" onClick={() => setVaccinesOpen(false)}>
                Close
              </Btn>
            </div>
          }
        >
          <AddVaccineForm
            onSave={(label, due) => {
              addVaccineCustom(label, due);
              setVaccinesOpen(false);
            }}
          />
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
              hint="Hide child identifiers by default."
              icon={<Lock className="h-4 w-4 text-slate-600" />}
            />
            <Toggle
              label="Hide values"
              checked={state.sensitiveHidden}
              onChange={(v) => setState((s) => ({ ...s, sensitiveHidden: v }))}
              hint="Hide numbers (height/weight/sleep/etc.) on-screen."
              icon={<ShieldCheck className="h-4 w-4 text-slate-600" />}
            />
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 text-slate-600" />
                <div>This is display-only privacy. When you wire backend storage, treat child records as sensitive and encrypt at rest.</div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
              <div className="text-slate-900 font-semibold">API wiring (next)</div>
              <div className="mt-1 text-slate-600">
                When you share your existing scheduler/reminders + reports endpoints, we can replace local-only parts.
                Suggested endpoints:
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>
                    <span className="font-semibold">GET</span> /api/children (from /family)
                  </li>
                  <li>
                    <span className="font-semibold">GET</span> /api/children/:id/growth?range=12m
                  </li>
                  <li>
                    <span className="font-semibold">GET</span> /api/children/:id/vaccines
                  </li>
                  <li>
                    <span className="font-semibold">POST</span> /api/children/:id/sick-logs
                  </li>
                  <li>
                    <span className="font-semibold">POST</span> /api/reminders/presets (vaccines, sleep, hydration)
                  </li>
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
function ValueChip({
  label,
  value,
  unit,
  hidden,
  compact,
}: {
  label: string;
  value: number | null;
  unit: string;
  hidden: boolean;
  compact?: boolean;
}) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-3 text-xs', compact ? 'p-2' : '')}>
      <div className="flex items-center justify-between">
        <div className="text-slate-700">{label}</div>
        <Pill tone="neutral">{hidden ? 'Hidden' : value == null ? '—' : `${value} ${unit}`}</Pill>
      </div>
    </div>
  );
}

function InfoBox({
  title,
  desc,
  tone = 'neutral',
}: {
  title: string;
  desc: string;
  tone?: 'neutral' | 'good' | 'warn';
}) {
  const bg =
    tone === 'good'
      ? 'bg-emerald-50 border-emerald-200'
      : tone === 'warn'
        ? 'bg-amber-50 border-amber-200'
        : 'bg-white border-slate-200';
  return (
    <div className={cn('rounded-xl border p-3 text-xs', bg)}>
      <div className="text-slate-900">{title}</div>
      <div className="mt-1 text-slate-600">{desc}</div>
    </div>
  );
}

function GrowthLogger({
  onSave,
}: {
  onSave: (r: { heightCm?: number | null; weightKg?: number | null; headCm?: number | null; note?: string }) => void;
}) {
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [head, setHead] = useState('');
  const [note, setNote] = useState('');

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Height (cm)">
          <input
            value={height}
            onChange={(e) => setHeight(e.target.value.replace(/[^\d.]/g, '').slice(0, 5))}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            placeholder="e.g. 95"
            inputMode="decimal"
          />
        </Field>
        <Field label="Weight (kg)">
          <input
            value={weight}
            onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, '').slice(0, 5))}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            placeholder="e.g. 14.2"
            inputMode="decimal"
          />
        </Field>
        <Field label="Head (cm) (optional)">
          <input
            value={head}
            onChange={(e) => setHead(e.target.value.replace(/[^\d.]/g, '').slice(0, 5))}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            placeholder="e.g. 48"
            inputMode="decimal"
          />
        </Field>
      </div>

      <Field label="Note (optional)">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
          placeholder="After clinic visit, morning, etc."
        />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            onSave({
              heightCm: height ? Number(height) : null,
              weightKg: weight ? Number(weight) : null,
              headCm: head ? Number(head) : null,
              note,
            });
            setNote('');
          }}
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3 py-1.5 text-xs text-white transition hover:bg-slate-800"
        >
          <span className="inline-flex items-center gap-2">
            <BadgeCheck className="h-4 w-4" /> Save
          </span>
        </button>
        <span className="text-[11px] text-slate-600">Optional fields are fine — consistency matters most.</span>
      </div>
    </div>
  );
}

function VaccineList({
  items,
  hidden,
  onToggleDone,
  onRemove,
}: {
  items: VaccineItem[];
  hidden: boolean;
  onToggleDone: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((v) => (
        <div key={v.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-slate-900">{v.label}</div>
              <div className="mt-0.5 text-slate-600">
                Due: {hidden ? 'Hidden' : v.dueISO || '—'} • Source: {v.source || 'custom'}
              </div>
              {v.note ? <div className="mt-1 text-slate-600">{v.note}</div> : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onToggleDone(v.id)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition',
                  v.doneISO
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                )}
              >
                {v.doneISO ? <CheckCircle2 className="h-4 w-4" /> : <MinusCircle className="h-4 w-4" />}
                {v.doneISO ? 'Done' : 'Mark done'}
              </button>

              {v.source === 'custom' ? (
                <button
                  type="button"
                  onClick={() => onRemove(v.id)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                  title="Remove custom item"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>

          {v.doneISO ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-800">
              Done date: {hidden ? 'Hidden' : v.doneISO}
            </div>
          ) : null}
        </div>
      ))}

      {items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">No vaccine items yet.</div>
      ) : null}
    </div>
  );
}

function SickLogger({
  existing,
  onSave,
}: {
  existing: SickLog | null;
  onSave: (e: Omit<SickLog, 'id' | 'childId' | 'dateISO'>) => void;
}) {
  const [symptom, setSymptom] = useState<SickSymptom>(existing?.symptom || 'fever');
  const [severity, setSeverity] = useState<number>(existing?.severity || 2);
  const [fever, setFever] = useState<string>(existing?.feverC != null ? String(existing.feverC) : '');
  const [fluidsOk, setFluidsOk] = useState<SickLog['fluidsOk']>(existing?.fluidsOk || 'yes');
  const [breathingOk, setBreathingOk] = useState<SickLog['breathingOk']>(existing?.breathingOk || 'yes');
  const [note, setNote] = useState(existing?.note || '');

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <SelectRow
          label="Symptom"
          value={symptom}
          options={[
            { value: 'fever', label: 'Fever' },
            { value: 'cough_cold', label: 'Cough / cold' },
            { value: 'breathing', label: 'Breathing concerns' },
            { value: 'vomiting', label: 'Vomiting' },
            { value: 'diarrhea', label: 'Diarrhea' },
            { value: 'rash', label: 'Rash' },
            { value: 'ear_pain', label: 'Ear pain' },
            { value: 'injury', label: 'Injury' },
            { value: 'other', label: 'Other' },
          ]}
          onChange={(v) => setSymptom(v as SickSymptom)}
        />

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] text-slate-600">Severity</div>
            <Pill tone={severity >= 4 ? 'warn' : 'neutral'}>{clamp(severity, 1, 5)}/5</Pill>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            value={severity}
            onChange={(e) => setSeverity(Number(e.target.value))}
            className="mt-2 w-full"
          />
          <div className="mt-1 text-[11px] text-slate-600">Higher = more concerning.</div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Fever (°C) (optional)">
          <input
            value={fever}
            onChange={(e) => setFever(e.target.value.replace(/[^\d.]/g, '').slice(0, 4))}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            placeholder="e.g. 38.2"
            inputMode="decimal"
          />
        </Field>
        <SelectRow
          label="Fluids / hydration"
          value={fluidsOk || 'yes'}
          options={[
            { value: 'yes', label: 'OK' },
            { value: 'some', label: 'Some' },
            { value: 'no', label: 'Not OK' },
          ]}
          onChange={(v) => setFluidsOk(v as any)}
        />
        <SelectRow
          label="Breathing"
          value={breathingOk || 'yes'}
          options={[
            { value: 'yes', label: 'OK' },
            { value: 'some', label: 'Some concern' },
            { value: 'no', label: 'Not OK' },
          ]}
          onChange={(v) => setBreathingOk(v as any)}
        />
      </div>

      <Field label="Note (optional)">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
          placeholder="What changed today?"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            onSave({
              symptom,
              severity: clamp(severity, 1, 5) as any,
              feverC: fever ? Number(fever) : null,
              fluidsOk,
              breathingOk,
              note: note.trim() || null,
            })
          }
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3 py-1.5 text-xs text-white transition hover:bg-slate-800"
        >
          <span className="inline-flex items-center gap-2">
            <BadgeCheck className="h-4 w-4" /> Save today
          </span>
        </button>
        <span className="text-[11px] text-slate-600">If severe or breathing is “Not OK”, seek urgent care.</span>
      </div>
    </div>
  );
}

function DevChecklist({
  ageBand,
  initialObserved,
  initialNotes,
  onSave,
}: {
  ageBand: DevAgeBand;
  initialObserved: string[];
  initialNotes: string;
  onSave: (observed: string[], notes: string) => void;
}) {
  const defs: Record<DevAgeBand, Array<{ key: string; label: string; desc: string }>> = {
    '0_6m': [
      { key: 'tracks_faces', label: 'Tracks faces', desc: 'Looks at faces or follows with eyes.' },
      { key: 'smiles', label: 'Smiles', desc: 'Smiles responsively.' },
      { key: 'head_control', label: 'Head control', desc: 'Holds head up briefly.' },
      { key: 'coos', label: 'Coos / sounds', desc: 'Makes soft sounds.' },
    ],
    '6_12m': [
      { key: 'sits', label: 'Sits (with/without support)', desc: 'Sitting stability improves.' },
      { key: 'babble', label: 'Babbles', desc: 'Repeats sounds.' },
      { key: 'responds_name', label: 'Responds to name', desc: 'Turns or reacts.' },
      { key: 'pincer', label: 'Pincer grasp emerging', desc: 'Picks small objects.' },
    ],
    '1_2y': [
      { key: 'walks', label: 'Walking / moving', desc: 'Walking or steady movement.' },
      { key: 'words', label: 'Words increasing', desc: 'Uses words/phrases over time.' },
      { key: 'points', label: 'Points / shows', desc: 'Shares interest.' },
      { key: 'plays', label: 'Simple play', desc: 'Imitates or uses toys.' },
    ],
    '2_3y': [
      { key: 'sentences', label: 'Short sentences', desc: 'Puts words together.' },
      { key: 'runs', label: 'Runs / climbs', desc: 'Motor skills progress.' },
      { key: 'follows_2step', label: 'Follows 2-step request', desc: 'Simple instructions.' },
      { key: 'pretend', label: 'Pretend play', desc: 'Imaginative play.' },
    ],
    '4_5y': [
      { key: 'stories', label: 'Tells stories', desc: 'Talks about events.' },
      { key: 'friends', label: 'Plays with others', desc: 'Social play.' },
      { key: 'fine_motor', label: 'Fine motor improving', desc: 'Draws/shapes.' },
      { key: 'self_care', label: 'Self-care growing', desc: 'Dressing/toilet skills (varies).' },
    ],
    '6_12y': [
      { key: 'school_routine', label: 'School routine', desc: 'Manages routines with support.' },
      { key: 'friendships', label: 'Friendships', desc: 'Maintains peer relationships.' },
      { key: 'focus', label: 'Focus', desc: 'Can focus for reasonable periods.' },
      { key: 'physical_play', label: 'Physical play', desc: 'Active play most days.' },
    ],
    teen: [
      { key: 'sleep_regular', label: 'Sleep routine', desc: 'Works toward consistent sleep.' },
      { key: 'stress_coping', label: 'Coping skills', desc: 'Has ways to manage stress.' },
      { key: 'school_balance', label: 'School balance', desc: 'Balances workload and rest.' },
      { key: 'activity', label: 'Physical activity', desc: 'Moves most days.' },
    ],
  };

  const [observed, setObserved] = useState<string[]>(initialObserved);
  const [notes, setNotes] = useState(initialNotes || '');

  const list = defs[ageBand];

  function toggle(k: string) {
    setObserved((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        Age band: <span className="font-semibold">{ageBand.replaceAll('_', '')}</span> • Tick what you notice this week.
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {list.map((m) => {
          const on = observed.includes(m.key);
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => toggle(m.key)}
              className={cn(
                'rounded-xl border p-3 text-left text-xs transition',
                on ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-slate-900">{m.label}</div>
                  <div className="mt-0.5 text-slate-600">{m.desc}</div>
                </div>
                {on ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />}
              </div>
            </button>
          );
        })}
      </div>

      <Field label="Notes (optional)">
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
          placeholder="Anything you noticed (sleep, school, illness, stress, etc.)"
        />
      </Field>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onSave(observed, notes)}
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3 py-1.5 text-xs text-white transition hover:bg-slate-800"
        >
          <span className="inline-flex items-center gap-2">
            <BadgeCheck className="h-4 w-4" /> Save this week
          </span>
        </button>
      </div>
    </div>
  );
}

function NutritionCheckin({
  existing,
  onSave,
}: {
  existing: NutritionDay | null;
  onSave: (e: Omit<NutritionDay, 'id' | 'childId' | 'dateISO'>) => void;
}) {
  const [mealsOk, setMealsOk] = useState<number>(existing?.mealsOk ?? 2);
  const [fruitVegServings, setFruitVegServings] = useState<number>(existing?.fruitVegServings ?? 2);
  const [waterCups, setWaterCups] = useState<number>(existing?.waterCups ?? 3);
  const [activityMin, setActivityMin] = useState<number>(existing?.activityMin ?? 30);
  const [sleepHours, setSleepHours] = useState<number>(existing?.sleepHours ?? 9);
  const [screenHours, setScreenHours] = useState<number>(existing?.screenHours ?? 2);
  const [note, setNote] = useState(existing?.note || '');

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <SliderRow label="Meals OK" value={mealsOk} min={0} max={3} onChange={setMealsOk} suffix="/3" />
        <SliderRow label="Fruit/veg servings" value={fruitVegServings} min={0} max={10} onChange={setFruitVegServings} />
        <SliderRow label="Water cups" value={waterCups} min={0} max={12} onChange={setWaterCups} />
        <SliderRow label="Activity (minutes)" value={activityMin} min={0} max={240} onChange={setActivityMin} />
        <SliderRow label="Sleep (hours)" value={sleepHours} min={0} max={16} onChange={setSleepHours} />
        <SliderRow label="Screen time (hours)" value={screenHours} min={0} max={12} onChange={setScreenHours} />
      </div>

      <Field label="Note (optional)">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
          placeholder="Anything notable today?"
        />
      </Field>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() =>
            onSave({
              mealsOk: clamp(mealsOk, 0, 3) as any,
              fruitVegServings,
              waterCups,
              activityMin,
              sleepHours,
              screenHours,
              note: note.trim() || null,
            })
          }
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3 py-1.5 text-xs text-white transition hover:bg-slate-800"
        >
          <span className="inline-flex items-center gap-2">
            <BadgeCheck className="h-4 w-4" /> Save today
          </span>
        </button>
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
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-900">{label}</div>
        <Pill tone="neutral">
          {value}
          {suffix || ''}
        </Pill>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full" />
    </div>
  );
}

function HabitChip({ title, desc }: { title: string; desc: string }) {
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
      {done ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />}
    </button>
  );
}

function ChronicDiary({
  onSave,
}: {
  onSave: (e: Omit<ChronicLog, 'id' | 'childId' | 'dateISO'>) => void;
}) {
  const [tags, setTags] = useState<Array<ChronicLog['tags'][number]>>(['asthma']);
  const [breathingWheeze, setBreathingWheeze] = useState<ChronicLog['breathingWheeze']>('no');
  const [coughAtNight, setCoughAtNight] = useState<ChronicLog['coughAtNight']>('no');
  const [rashItch, setRashItch] = useState<ChronicLog['rashItch']>('no');
  const [usedRescueRelief, setUsedRescueRelief] = useState(false);
  const [triggers, setTriggers] = useState<Array<NonNullable<ChronicLog['triggers']>[number]>>(['unknown']);
  const [note, setNote] = useState('');

  function toggleTag(t: ChronicLog['tags'][number]) {
    setTags((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));
  }
  function toggleTrigger(t: NonNullable<ChronicLog['triggers']>[number]) {
    setTriggers((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        This diary is for tracking patterns. It does not provide treatment instructions. If symptoms are severe, seek urgent care.
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
          <div className="text-[11px] text-slate-600">Tags</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['asthma', 'allergy', 'eczema', 'other'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                className={cn(
                  'rounded-full border px-3 py-1 text-[11px] transition',
                  tags.includes(t) ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
          <div className="text-[11px] text-slate-600">Possible triggers</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['dust', 'pollen', 'smoke', 'pets', 'exercise', 'cold_air', 'unknown'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleTrigger(t)}
                className={cn(
                  'rounded-full border px-3 py-1 text-[11px] transition',
                  triggers.includes(t) ? 'border-slate-300 bg-slate-100 text-slate-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                )}
              >
                {t.replaceAll('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <SelectRow
          label="Wheeze"
          value={breathingWheeze || 'no'}
          options={[
            { value: 'no', label: 'No' },
            { value: 'some', label: 'Some' },
            { value: 'yes', label: 'Yes' },
          ]}
          onChange={(v) => setBreathingWheeze(v as any)}
        />
        <SelectRow
          label="Night cough"
          value={coughAtNight || 'no'}
          options={[
            { value: 'no', label: 'No' },
            { value: 'some', label: 'Some' },
            { value: 'yes', label: 'Yes' },
          ]}
          onChange={(v) => setCoughAtNight(v as any)}
        />
        <SelectRow
          label="Itch / rash"
          value={rashItch || 'no'}
          options={[
            { value: 'no', label: 'No' },
            { value: 'some', label: 'Some' },
            { value: 'yes', label: 'Yes' },
          ]}
          onChange={(v) => setRashItch(v as any)}
        />
      </div>

      <button
        type="button"
        onClick={() => setUsedRescueRelief((x) => !x)}
        className={cn(
          'flex items-center justify-between rounded-xl border px-3 py-2 text-xs transition',
          usedRescueRelief ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
        )}
      >
        <span>Used rescue/relief (tracking only)</span>
        {usedRescueRelief ? <CheckCircle2 className="h-4 w-4" /> : <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />}
      </button>

      <Field label="Note (optional)">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
          placeholder="What changed, what helped, environment notes..."
        />
      </Field>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() =>
            onSave({
              tags,
              breathingWheeze,
              coughAtNight,
              triggers,
              rashItch,
              usedRescueRelief,
              note: note.trim() || null,
            })
          }
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3 py-1.5 text-xs text-white transition hover:bg-slate-800"
        >
          <span className="inline-flex items-center gap-2">
            <BadgeCheck className="h-4 w-4" /> Save today
          </span>
        </button>
      </div>
    </div>
  );
}

function SafetyChecklist({
  items,
  onToggle,
  updatedISO,
}: {
  items: SafetyProfile['items'] | null;
  onToggle: (k: keyof SafetyProfile['items']) => void;
  updatedISO: string;
}) {
  const list: Array<{ key: keyof SafetyProfile['items']; label: string; desc: string }> = [
    { key: 'car_seat', label: 'Car seat / seat belt', desc: 'Correct setup for age/size.' },
    { key: 'helmet', label: 'Helmet for bikes/scooters', desc: 'Fits well and is worn consistently.' },
    { key: 'meds_locked', label: 'Medicines locked away', desc: 'Out of reach, child-safe storage.' },
    { key: 'water_safety', label: 'Water safety', desc: 'Supervision around pools/baths.' },
    { key: 'smoke_alarm', label: 'Smoke alarm working', desc: 'Tested periodically.' },
    { key: 'window_guards', label: 'Window safety', desc: 'Guards/locks where needed.' },
    { key: 'poison_hotline', label: 'Poison help info', desc: 'Know what to do in emergencies (region policy later).' },
    { key: 'school_contacts', label: 'School contacts updated', desc: 'Guardian + clinic contacts on file.' },
  ];

  const doneCount = items ? Object.values(items).filter(Boolean).length : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
        <div className="text-slate-700">Progress</div>
        <Pill tone="neutral">
          {doneCount}/{list.length} • Updated {updatedISO}
        </Pill>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {list.map((x) => {
          const on = items ? items[x.key] : false;
          return (
            <button
              key={x.key}
              type="button"
              onClick={() => onToggle(x.key)}
              className={cn(
                'rounded-xl border p-3 text-left text-xs transition',
                on ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-slate-900">{x.label}</div>
                  <div className="mt-0.5 text-slate-600">{x.desc}</div>
                </div>
                {on ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AddChildForm({
  onSave,
}: {
  onSave: (p: Omit<ChildProfile, 'id'>) => void;
}) {
  const [name, setName] = useState('');
  const [dobISO, setDobISO] = useState(todayISO());
  const [sex, setSex] = useState<ChildSex>('prefer_not');
  const [notes, setNotes] = useState('');

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Name (display)">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            placeholder="e.g. Ayo"
          />
        </Field>
        <Field label="Date of birth">
          <input
            type="date"
            value={dobISO}
            onChange={(e) => setDobISO(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
          />
        </Field>
      </div>

      <SelectRow
        label="Sex (optional)"
        value={sex}
        options={[
          { value: 'prefer_not', label: 'Prefer not to say' },
          { value: 'female', label: 'Female' },
          { value: 'male', label: 'Male' },
          { value: 'other', label: 'Other' },
        ]}
        onChange={(v) => setSex(v as ChildSex)}
      />

      <Field label="Notes (optional)">
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
          placeholder="Allergies, clinic, anything you want to remember (local)."
        />
      </Field>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            const nm = name.trim() || 'Child';
            onSave({
              name: nm,
              dobISO,
              sex,
              notes: notes.trim() || null,
            });
          }}
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3 py-1.5 text-xs text-white transition hover:bg-slate-800"
        >
          <span className="inline-flex items-center gap-2">
            <BadgeCheck className="h-4 w-4" /> Save child
          </span>
        </button>
      </div>
    </div>
  );
}

function AddVaccineForm({
  onSave,
}: {
  onSave: (label: string, dueISO: string | null) => void;
}) {
  const [label, setLabel] = useState('');
  const [due, setDue] = useState<string>('');

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        Add any vaccine/booster your clinic advises. You can leave due date blank and just use it as a checklist item.
      </div>

      <Field label="Label">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
          placeholder="e.g. Booster (clinic advised)"
        />
      </Field>

      <Field label="Due date (optional)">
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
        />
      </Field>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            const t = label.trim();
            if (!t) return;
            onSave(t, due ? due : null);
            setLabel('');
            setDue('');
          }}
          className={cn(
            'inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-xs transition',
            label.trim() ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-200 text-slate-500 cursor-not-allowed',
          )}
          disabled={!label.trim()}
        >
          <span className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add
          </span>
        </button>
      </div>
    </div>
  );
}
