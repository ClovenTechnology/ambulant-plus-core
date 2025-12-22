// apps/patient-app/app/medications/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { formatDate } from '../../src/lib/date';
import { toast } from '../../components/toast';

// Reuse the same “homepage-style” visuals (donut + sparkline)
import MeterDonut from '../../components/charts/AnimatedMeterDonut';
import Sparkline from '../../components/charts/Sparkline';

/* =========================================================
   Types
========================================================= */
type MedicationStatus = 'Active' | 'Completed' | 'On Hold';

type Medication = {
  id: string;
  name: string;
  dose: string;
  frequency: string;
  route: string;
  started: string;
  lastFilled: string;
  status: MedicationStatus;
  durationDays?: number | null;
  orderId?: string | null;
  source?: string | null; // 'manual' | 'erx' | ...
  meta?: any;
};

type EncounterSession = {
  id: string;
  caseId: string;
  caseTitle?: string | null;
  caseStatus?: string | null;
  start: string;
  stop?: string;
  clinician?: { id: string; name: string; specialty?: string | null };
};

type ErxMed = {
  id: string;
  encounterId?: string;
  name: string;
  dose: string;
  frequency: string;
  route: string;
  durationDays?: number;
  orderId?: string;
};

type ErxMedSelectable = ErxMed & { selected: boolean };

type NewMedForm = {
  name: string;
  dose: string;
  frequency: string;
  route: string;
  started: string;
  lastFilled: string;
  status: MedicationStatus;
  duration: string;
  orderId: string;
};

type ReminderStatus = 'Pending' | 'Taken' | 'Missed';

type Reminder = {
  id: string;
  medicationId?: string | null;
  status: ReminderStatus;
  // optional fields (backend may include these; we won’t assume)
  createdAt?: string;
  scheduledFor?: string;
  dueAt?: string;
  time?: string;
  meta?: any;
};

type ReminderAgg = {
  pending: number;
  taken: number;
  missed: number;
  total: number;
};

type ReminderSchedule = { id: string; time: string; enabled: boolean };

/* =========================================================
   Styles + mocks
========================================================= */
const STATUS_STYLES: Record<MedicationStatus, { chip: string; dot: string }> = {
  Active: {
    chip: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  Completed: {
    chip: 'bg-slate-50 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
  },
  'On Hold': {
    chip: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
  },
};

const MOCK_MEDS: Medication[] = [
  {
    id: 'mock-1',
    name: 'Paracetamol',
    dose: '500 mg',
    frequency: '1 tablet every 6 hours',
    route: 'Oral',
    started: new Date().toISOString(),
    lastFilled: new Date().toISOString(),
    status: 'Active',
    durationDays: 5,
    source: 'manual',
  },
];

const MOCK_ENCOUNTERS: EncounterSession[] = [
  {
    id: 'ENC-24001-1',
    caseId: 'CASE-24001',
    caseTitle: 'Hypertension follow-up',
    caseStatus: 'Open',
    start: new Date().toISOString(),
    clinician: { id: 'CLN-001', name: 'Dr. A. Moyo', specialty: 'Cardiology' },
  },
  {
    id: 'ENC-23987-1',
    caseId: 'CASE-23987',
    caseTitle: 'Post-viral cough',
    caseStatus: 'Closed',
    start: new Date().toISOString(),
    clinician: { id: 'CLN-014', name: 'Dr. N. Jacobs', specialty: 'Internal Medicine' },
  },
];

const emptyForm: NewMedForm = {
  name: '',
  dose: '',
  frequency: '',
  route: '',
  started: '',
  lastFilled: '',
  status: 'Active',
  duration: '',
  orderId: '',
};

/* =========================================================
   Helpers
========================================================= */

// derive default times for X doses/day
function defaultTimesForFrequencyPerDay(freq: number | undefined): string[] {
  if (!freq || freq <= 0) return ['08:00'];
  switch (freq) {
    case 1:
      return ['08:00'];
    case 2:
      return ['08:00', '20:00'];
    case 3:
      return ['08:00', '14:00', '20:00'];
    case 4:
      return ['06:00', '12:00', '18:00', '22:00'];
    default:
      return ['08:00'];
  }
}

// naive parser: guess times/day from SIG text
function guessFrequencyPerDay(freq: string | undefined | null): number | undefined {
  if (!freq) return undefined;
  const s = freq.toLowerCase();

  if (s.includes('q6h') || s.includes('every 6 hours')) return 4;
  if (s.includes('q8h') || s.includes('every 8 hours')) return 3;
  if (s.includes('q12h') || s.includes('every 12 hours')) return 2;

  if (s.includes('four times') || s.includes('4 times') || s.includes('qid')) return 4;
  if (s.includes('three times') || s.includes('3 times') || s.includes('tid') || s.includes('t.i.d')) return 3;
  if (s.includes('twice') || s.includes('2 times') || s.includes('bid')) return 2;

  if (s.includes('once daily') || s.includes('once a day') || s.includes('od') || s.includes('daily')) return 1;

  return undefined;
}

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

// tiny stable pseudo “trend” series from a base percent (real-ready placeholder)
function buildTrendSeries(basePct: number, seed: number) {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const jitter = (i: number) => {
    const x = Math.sin((seed + 17) * (i + 1)) * 8 + Math.cos((seed + 3) * (i + 2)) * 6;
    return Math.round(x);
  };
  const out: number[] = [];
  // 7-day series (older → newer)
  for (let i = 0; i < 7; i++) out.push(clamp(basePct + jitter(i) - 4));
  // bias last point to base
  out[out.length - 1] = clamp(basePct);
  return out;
}

/* =========================================================
   Tiny local UI primitives (no external kit)
========================================================= */
function Card(props: { className?: string; children: any }) {
  return (
    <div
      className={cx(
        'rounded-2xl border bg-white shadow-sm shadow-black/[0.03]',
        'border-slate-200/70',
        props.className
      )}
    >
      {props.children}
    </div>
  );
}

function CardHeader(props: { title: string; subtitle?: string; right?: any }) {
  return (
    <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900">{props.title}</div>
        {props.subtitle ? <div className="mt-1 text-xs text-slate-500">{props.subtitle}</div> : null}
      </div>
      {props.right ? <div className="shrink-0">{props.right}</div> : null}
    </div>
  );
}

function CardBody(props: { className?: string; children: any }) {
  return <div className={cx('px-5 pb-5', props.className)}>{props.children}</div>;
}

function Chip(props: { className?: string; children: any }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[12px] font-medium',
        props.className
      )}
    >
      {props.children}
    </span>
  );
}

function Dot(props: { className?: string }) {
  return <span className={cx('inline-block h-2 w-2 rounded-full', props.className)} />;
}

function Button(props: {
  children: any;
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type={props.type ?? 'button'}
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold',
        'transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed',
        props.className
      )}
    >
      {props.children}
    </button>
  );
}

function GhostButton(props: {
  children: any;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      className={cx(
        'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium',
        'border border-slate-200 bg-white hover:bg-slate-50',
        'transition disabled:opacity-50 disabled:cursor-not-allowed',
        props.className
      )}
    >
      {props.children}
    </button>
  );
}

function Icon(props: {
  name: 'plus' | 'sync' | 'printer' | 'x' | 'search' | 'bolt' | 'clock' | 'pill' | 'check' | 'warn';
  className?: string;
}) {
  const common = cx('h-4 w-4', props.className);
  switch (props.name) {
    case 'plus':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'sync':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 12a9 9 0 0 1 15.3-6.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M18 4v4h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 12a9 9 0 0 1-15.3 6.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M6 20v-4h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'printer':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7 8V4h10v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M7 17h10v3H7v-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path
            d="M6 17H5a3 3 0 0 1-3-3v-3a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3h-1"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path d="M17 12h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case 'x':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'search':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" strokeWidth="2" />
          <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'bolt':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M13 2 3 14h8l-1 8 10-12h-8l1-8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    case 'clock':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z" stroke="currentColor" strokeWidth="2" />
          <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'pill':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M10 14 7 17a4 4 0 0 0 0 5 4 4 0 0 0 5 0l3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M14 10 17 7a4 4 0 0 0 0-5 4 4 0 0 0-5 0l-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M9 15 15 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'check':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'warn':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 9v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M12 17h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path
            d="M10.3 3.7 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

function SegmentedTabs<T extends string>(props: {
  value: T;
  onChange: (v: T) => void;
  items: Array<{ id: T; label: string }>;
  className?: string;
}) {
  return (
    <div className={cx('inline-flex rounded-2xl border bg-white p-1', 'border-slate-200', props.className)}>
      {props.items.map((it) => {
        const active = it.id === props.value;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => props.onChange(it.id)}
            className={cx(
              'px-4 py-2 text-sm font-semibold rounded-xl transition',
              active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function SkeletonLine(props: { className?: string }) {
  return <div className={cx('h-4 rounded bg-slate-100 animate-pulse', props.className)} />;
}

function Modal(props: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: any;
  maxW?: 'md' | '2xl';
}) {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    window.addEventListener('keydown', onKey);
    setTimeout(() => closeBtnRef.current?.focus(), 0);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div
        className={cx(
          'w-full rounded-2xl bg-white shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto',
          props.maxW === '2xl' ? 'max-w-2xl' : 'max-w-md'
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-lg font-bold text-slate-900">{props.title}</div>
            {props.subtitle ? <div className="mt-1 text-xs text-slate-500">{props.subtitle}</div> : null}
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={props.onClose}
            className="rounded-xl p-2 hover:bg-slate-50 text-slate-500 hover:text-slate-700 transition"
            aria-label="Close"
          >
            <Icon name="x" />
          </button>
        </div>
        <div className="px-5 py-5">{props.children}</div>
      </div>
    </div>
  );
}

function ProgressBar(props: {
  segments: Array<{ label: string; value: number; className: string }>;
  className?: string;
  emptyLabel?: string;
}) {
  const total = props.segments.reduce((s, x) => s + (x.value || 0), 0);
  if (total <= 0) {
    return (
      <div className={cx('w-full', props.className)}>
        <div className="h-3 rounded-full border border-slate-200 bg-slate-50" />
        <div className="mt-2 text-[11px] text-slate-500">{props.emptyLabel ?? 'No data yet.'}</div>
      </div>
    );
  }

  return (
    <div className={cx('w-full', props.className)}>
      <div className="h-3 w-full overflow-hidden rounded-full border border-slate-200 bg-slate-50 flex">
        {props.segments.map((seg) => {
          const w = (seg.value / total) * 100;
          if (w <= 0) return null;
          return <div key={seg.label} className={cx('h-full', seg.className)} style={{ width: `${w}%` }} />;
        })}
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600">
        {props.segments.map((seg) => (
          <span key={seg.label} className="inline-flex items-center gap-2">
            <span className={cx('h-2 w-2 rounded-full', seg.className)} />
            {seg.label}: <span className="font-semibold text-slate-800">{seg.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   Page
========================================================= */
export default function MedicationsPage() {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'overview' | 'list' | 'history'>('overview');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | MedicationStatus>('Active');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<NewMedForm>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createMode, setCreateMode] = useState<'manual' | 'erx'>('manual');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Medication> | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // eRx sync
  const [encounters, setEncounters] = useState<EncounterSession[]>([]);
  const [encLoading, setEncLoading] = useState(false);
  const [encError, setEncError] = useState<string | null>(null);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string>('');
  const [erxItems, setErxItems] = useState<ErxMedSelectable[]>([]);
  const [erxLoading, setErxLoading] = useState(false);
  const [autoSelectLatestErx, setAutoSelectLatestErx] = useState(false);

  // reminders + adherence
  const [remindersAll, setRemindersAll] = useState<Reminder[]>([]);
  const [remindersAggByMed, setRemindersAggByMed] = useState<Record<string, ReminderAgg>>({});

  const [reminderMed, setReminderMed] = useState<Medication | null>(null);
  const [reminderSchedules, setReminderSchedules] = useState<ReminderSchedule[]>([]);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderFreqPerDay, setReminderFreqPerDay] = useState<number | undefined>(undefined);

  /* ------------------------------
     Load medications
  --------------------------------*/
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const res = await fetch('/api/medications', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load medications');
        const data = (await res.json()) as Medication[] | { items?: Medication[] };
        const list = Array.isArray(data) ? data : data.items ?? [];
        setMeds(list);
      } catch (err) {
        console.error('Error loading medications:', err);
        setLoadError('Unable to load medications from the server. Showing a sample list instead.');
        setMeds(MOCK_MEDS);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  /* ------------------------------
     Reminders indicators + adherence feed
  --------------------------------*/
  async function reloadReminders() {
    try {
      const res = await fetch('/api/reminders?source=medication', { cache: 'no-store' });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();

      const raw: Reminder[] = Array.isArray((data as any).reminders) ? (data as any).reminders : [];
      setRemindersAll(raw);

      const map: Record<string, ReminderAgg> = {};
      for (const r of raw) {
        const mid = r.medicationId;
        if (!mid) continue;

        const cur = map[mid] ?? { pending: 0, taken: 0, missed: 0, total: 0 };
        cur.total += 1;

        if (r.status === 'Pending') cur.pending += 1;
        else if (r.status === 'Taken') cur.taken += 1;
        else if (r.status === 'Missed') cur.missed += 1;

        map[mid] = cur;
      }

      setRemindersAggByMed(map);
    } catch (err) {
      console.error('Failed to load reminders', err);
      // soft fail
    }
  }

  useEffect(() => {
    reloadReminders();
  }, []);

  /* ------------------------------
     Lazy-load encounters when eRx mode is opened
  --------------------------------*/
  useEffect(() => {
    if (!isCreateOpen || createMode !== 'erx' || encounters.length > 0 || encLoading) return;

    (async () => {
      setEncLoading(true);
      setEncError(null);
      try {
        const res = await fetch('/api/encounters?mode=sessions&limit=20', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load encounters');

        const data = await res.json();
        const encsRaw: any[] = Array.isArray(data)
          ? data
          : Array.isArray((data as any).encounters)
          ? (data as any).encounters
          : [];

        if (!encsRaw.length) throw new Error('No encounters');

        const encs: EncounterSession[] = encsRaw.map((e: any) => ({
          id: e.id,
          caseId: e.caseId ?? e.case ?? 'UNKNOWN',
          caseTitle: e.caseTitle ?? e.title ?? null,
          caseStatus: e.caseStatus ?? e.status ?? null,
          start: e.start,
          stop: e.stop,
          clinician: e.clinician ? { id: e.clinician.id, name: e.clinician.name, specialty: e.clinician.specialty } : undefined,
        }));

        setEncounters(encs);

        if (autoSelectLatestErx && encs.length > 0) {
          const latest = [...encs].sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())[0];
          if (latest) {
            setAutoSelectLatestErx(false);
            await onEncounterChange(latest.id);
          }
        }
      } catch (err) {
        console.error('Error loading encounters:', err);
        setEncError('Unable to load recent sessions. Showing sample data instead.');
        setEncounters(MOCK_ENCOUNTERS);

        if (autoSelectLatestErx && MOCK_ENCOUNTERS.length > 0) {
          const latest = [...MOCK_ENCOUNTERS].sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())[0];
          setAutoSelectLatestErx(false);
          await onEncounterChange(latest.id);
        }
      } finally {
        setEncLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreateOpen, createMode, encounters.length, encLoading]);

  const filteredMeds = useMemo(() => {
    const q = search.trim().toLowerCase();
    return meds.filter((m) => {
      const matchesSearch =
        !q ||
        (m.name ?? '').toLowerCase().includes(q) ||
        (m.dose ?? '').toLowerCase().includes(q) ||
        (m.frequency ?? '').toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'All' ? true : m.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [meds, search, statusFilter]);

  const selectedErxCount = useMemo(() => erxItems.filter((i) => i.selected).length, [erxItems]);

  const pendingForMed = (id: string) => remindersAggByMed[id]?.pending ?? 0;
  const aggForMed = (id: string): ReminderAgg => remindersAggByMed[id] ?? { pending: 0, taken: 0, missed: 0, total: 0 };

  const medStats = useMemo(() => {
    if (!meds.length) {
      return {
        total: 0,
        active: 0,
        completed: 0,
        onHold: 0,
        erxActive: 0,
        manualActive: 0,
        withAnyReminders: 0,
        pendingRemindersTotal: 0,
        takenTotal: 0,
        missedTotal: 0,
        totalRemindersAll: 0,
      };
    }

    const active = meds.filter((m) => m.status === 'Active');
    const completed = meds.filter((m) => m.status === 'Completed');
    const onHold = meds.filter((m) => m.status === 'On Hold');

    const erxActive = active.filter((m) => m.source === 'erx').length;
    const manualActive = active.length - erxActive;

    let withAnyReminders = 0;
    let pendingRemindersTotal = 0;
    let takenTotal = 0;
    let missedTotal = 0;
    let totalRemindersAll = 0;

    for (const m of active) {
      const a = aggForMed(m.id);
      if (a.total > 0) withAnyReminders += 1;
      pendingRemindersTotal += a.pending;
      takenTotal += a.taken;
      missedTotal += a.missed;
      totalRemindersAll += a.total;
    }

    return {
      total: meds.length,
      active: active.length,
      completed: completed.length,
      onHold: onHold.length,
      erxActive,
      manualActive,
      withAnyReminders,
      pendingRemindersTotal,
      takenTotal,
      missedTotal,
      totalRemindersAll,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meds, remindersAggByMed]);

  const historyMeds = useMemo(() => meds.filter((m) => m.status !== 'Active'), [meds]);

  // Overall adherence (based on reminders for ACTIVE meds only)
  const adherence = useMemo(() => {
    const denom = medStats.takenTotal + medStats.missedTotal;
    const pct = denom <= 0 ? 100 : Math.round((medStats.takenTotal / denom) * 100);

    const hasAnyTracking = medStats.totalRemindersAll > 0;
    const hasHistory = denom > 0;

    return {
      pct,
      denom,
      hasAnyTracking,
      hasHistory,
      taken: medStats.takenTotal,
      missed: medStats.missedTotal,
      pending: medStats.pendingRemindersTotal,
      total: medStats.totalRemindersAll,
    };
  }, [medStats]);

  const adherenceSeries = useMemo(() => buildTrendSeries(adherence.pct, meds.length + medStats.active * 11), [adherence.pct, meds.length, medStats.active]);

  /* =========================================================
     Actions
  ========================================================= */
  function openCreate() {
    const today = new Date().toISOString().slice(0, 10);
    setForm({ ...emptyForm, started: today, lastFilled: today });
    setCreateMode('manual');
    setIsCreateOpen(true);
  }

  function closeCreate() {
    if (isSubmitting) return;
    setIsCreateOpen(false);
  }

  function handleFormChange<K extends keyof NewMedForm>(key: K, value: NewMedForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function formatEncounterLabel(enc: EncounterSession) {
    const d = new Date(enc.start);
    const dateStr = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    const clinician = enc.clinician?.name ? ` · ${enc.clinician.name}` : '';
    const title = enc.caseTitle ? ` · ${enc.caseTitle}` : '';
    return `${dateStr} ${timeStr}${clinician}${title}`;
  }

  async function onEncounterChange(id: string) {
    setSelectedEncounterId(id);
    setErxItems([]);
    if (!id) return;

    setErxLoading(true);
    try {
      const res = await fetch(`/api/erx/encounter/${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('bad status');
      const data = await res.json();
      const list: ErxMed[] = Array.isArray(data)
        ? data
        : Array.isArray((data as any).items)
        ? (data as any).items
        : [];

      setErxItems(list.map((m) => ({ ...m, selected: true })));
    } catch (err) {
      console.error('Error loading eRx for encounter:', err);
      toast('Could not load prescriptions for this encounter.', { type: 'error' });
      setErxItems([]);
    } finally {
      setErxLoading(false);
    }
  }

  function toggleErxSelection(id: string) {
    setErxItems((prev) => prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)));
  }

  function selectAllErx(selected: boolean) {
    setErxItems((prev) => prev.map((i) => ({ ...i, selected })));
  }

  function openSyncLatestErx() {
    setCreateMode('erx');
    setIsCreateOpen(true);

    if (encounters.length > 0) {
      const latest = [...encounters].sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())[0];
      if (latest) {
        setAutoSelectLatestErx(false);
        void onEncounterChange(latest.id);
      }
    } else {
      setAutoSelectLatestErx(true);
    }
  }

  async function patchMedicationOnServer(id: string, patch: Partial<Medication>) {
    if (!id || id.startsWith('temp-')) return;
    const res = await fetch('/api/medications', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    });
    await res.text().catch(() => '');
    if (!res.ok) throw new Error('PATCH failed');
  }

  /* ------------------------------
     Create medication (manual or eRx)
  --------------------------------*/
  async function handleCreate(e: FormEvent) {
    e.preventDefault();

    if (createMode === 'erx') {
      await handleCreateFromErx();
      return;
    }

    if (!form.name.trim()) {
      toast('Name is required', { type: 'error' });
      return;
    }

    setIsSubmitting(true);

    const tempId = `temp-${Date.now()}`;
    const durationDays =
      form.duration.trim() === ''
        ? null
        : Number.isNaN(Number(form.duration))
        ? null
        : Number(form.duration);

    const payload: any = {
      name: form.name.trim(),
      dose: form.dose.trim() || null,
      frequency: form.frequency.trim() || null,
      route: form.route.trim() || null,
      started: form.started,
      lastFilled: form.lastFilled,
      status: form.status,
      durationDays,
      orderId: form.orderId.trim() || null,
      source: 'manual',
    };

    try {
      const res = await fetch('/api/medications', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let created: Medication = {
        id: tempId,
        name: payload.name,
        dose: payload.dose ?? '',
        frequency: payload.frequency ?? '',
        route: payload.route ?? '',
        started: payload.started,
        lastFilled: payload.lastFilled,
        status: payload.status,
        durationDays: payload.durationDays,
        orderId: payload.orderId,
        source: payload.source,
      };

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && (data as any).id) created = { ...created, ...(data as Partial<Medication>) };
        else if ((data as any)?.med?.id) created = { ...created, ...((data as any).med as Partial<Medication>) };
        toast('Medication added', { type: 'success' });
      } else {
        toast('Could not save to server — medication added locally only', { type: 'error' });
      }

      setMeds((prev) => [...prev, created]);
      setIsCreateOpen(false);
    } catch (err) {
      console.error('Error creating medication:', err);
      toast('Network error — medication added locally only', { type: 'error' });

      const created: Medication = {
        id: tempId,
        name: payload.name,
        dose: payload.dose ?? '',
        frequency: payload.frequency ?? '',
        route: payload.route ?? '',
        started: payload.started,
        lastFilled: payload.lastFilled,
        status: payload.status,
        durationDays: payload.durationDays,
        orderId: payload.orderId,
        source: payload.source,
      };

      setMeds((prev) => [...prev, created]);
      setIsCreateOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateFromErx() {
    if (!selectedEncounterId) {
      toast('Select an encounter first', { type: 'error' });
      return;
    }
    const selected = erxItems.filter((i) => i.selected);
    if (selected.length === 0) {
      toast('Select at least one prescription to add', { type: 'error' });
      return;
    }

    setIsSubmitting(true);

    const today = new Date().toISOString().slice(0, 10);
    const createdMeds: Medication[] = [];
    let hadError = false;

    for (const item of selected) {
      const tempId = `temp-${Date.now()}-${item.id}`;

      const payload: any = {
        name: item.name,
        dose: item.dose,
        frequency: item.frequency,
        route: item.route,
        started: today,
        lastFilled: today,
        status: 'Active' as MedicationStatus,
        durationDays: item.durationDays ?? null,
        orderId: item.orderId ?? null,
        source: 'erx',
        meta: item.encounterId ? { encounterId: item.encounterId } : undefined,
      };

      let created: Medication = {
        id: tempId,
        name: payload.name,
        dose: payload.dose ?? '',
        frequency: payload.frequency ?? '',
        route: payload.route ?? '',
        started: payload.started,
        lastFilled: payload.lastFilled,
        status: payload.status,
        durationDays: payload.durationDays,
        orderId: payload.orderId,
        source: payload.source,
        meta: payload.meta,
      };

      try {
        const res = await fetch('/api/medications', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data && (data as any).id) created = { ...created, ...(data as Partial<Medication>) };
          else if ((data as any)?.med?.id) created = { ...created, ...((data as any).med as Partial<Medication>) };
        } else {
          hadError = true;
        }
      } catch (err) {
        console.error('Error creating medication from eRx:', err);
        hadError = true;
      }

      createdMeds.push(created);
    }

    setMeds((prev) => [...prev, ...createdMeds]);
    setIsCreateOpen(false);
    setIsSubmitting(false);

    if (hadError) toast('Some items could not be synced to server. They were added locally.', { type: 'error' });
    else toast('Medications added from eRx', { type: 'success' });
  }

  /* ------------------------------
     Inline edit
  --------------------------------*/
  function startEditing(m: Medication) {
    if (m.source === 'erx') {
      toast('This medication was synced from your clinician. To change the prescription, please discuss it with them.', {
        type: 'info',
      });
      return;
    }

    setEditingId(m.id);
    setEditDraft({
      name: m.name,
      dose: m.dose,
      frequency: m.frequency,
      route: m.route,
      started: m.started?.slice(0, 10),
      lastFilled: m.lastFilled?.slice(0, 10),
      status: m.status,
      durationDays: m.durationDays ?? undefined,
      orderId: m.orderId ?? undefined,
    });
  }

  function updateEdit<K extends keyof Medication>(key: K, value: any) {
    setEditDraft((prev) => ({ ...(prev ?? {}), [key]: value }));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function saveEdit() {
    if (!editingId || !editDraft) return;
    const original = meds.find((m) => m.id === editingId);
    if (!original) return;

    setIsSavingEdit(true);

    const patch: Partial<Medication> = {
      name: String(editDraft.name ?? original.name).trim(),
      dose: String(editDraft.dose ?? original.dose).trim(),
      frequency: String(editDraft.frequency ?? original.frequency).trim(),
      route: String(editDraft.route ?? original.route).trim(),
      started: (editDraft.started as string) ?? original.started,
      lastFilled: (editDraft.lastFilled as string) ?? original.lastFilled,
      status: (editDraft.status as MedicationStatus) ?? original.status,
      durationDays:
        typeof editDraft.durationDays === 'number'
          ? editDraft.durationDays
          : editDraft.durationDays === undefined
          ? original.durationDays
          : original.durationDays,
      orderId: (editDraft.orderId as any) ?? original.orderId ?? null,
    };

    setMeds((prev) => prev.map((m) => (m.id === editingId ? { ...m, ...patch } : m)));

    try {
      await patchMedicationOnServer(editingId, patch);
      toast('Medication updated', { type: 'success' });
    } catch {
      toast('Could not sync changes to server. Updates kept locally for now.', { type: 'error' });
    } finally {
      setIsSavingEdit(false);
      setEditingId(null);
      setEditDraft(null);
    }
  }

  /* ------------------------------
     Stop medication
  --------------------------------*/
  async function handleStopMedication(m: Medication) {
    const confirmMessage =
      'Mark this medication as no longer taken?\n\nIt will move to Completed and be hidden from the Active list.';
    if (!window.confirm(confirmMessage)) return;

    const patch: Partial<Medication> = { status: 'Completed' };

    setMeds((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: 'Completed' } : x)));

    try {
      await patchMedicationOnServer(m.id, patch);
      toast('Medication marked as completed', { type: 'success' });
    } catch {
      toast('Could not sync change to server. It will remain updated locally for now.', { type: 'error' });
    }
  }

  /* ------------------------------
     Reminder creation
  --------------------------------*/
  function openReminderFor(m: Medication) {
    setReminderMed(m);

    const freqPerDay = guessFrequencyPerDay(m.frequency);
    setReminderFreqPerDay(freqPerDay);

    const times = defaultTimesForFrequencyPerDay(freqPerDay);
    const scheds: ReminderSchedule[] = times.map((t, idx) => ({
      id: `sch-${Date.now()}-${idx}`,
      time: t,
      enabled: true,
    }));
    setReminderSchedules(scheds);
  }

  function closeReminder() {
    if (reminderBusy) return;
    setReminderMed(null);
    setReminderSchedules([]);
    setReminderFreqPerDay(undefined);
  }

  function updateSchedule(id: string, time: string) {
    setReminderSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, time } : s)));
  }

  function toggleSchedule(id: string) {
    setReminderSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  }

  function addSchedule() {
    setReminderSchedules((prev) => [...prev, { id: `sch-${Date.now()}`, time: '08:00', enabled: true }]);
  }

  function removeSchedule(id: string) {
    setReminderSchedules((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleCreateReminder(e: FormEvent) {
    e.preventDefault();
    if (!reminderMed) return;

    const active = reminderSchedules.filter((s) => s.enabled && s.time);
    if (active.length === 0) {
      toast('Add at least one time for this reminder.', { type: 'error' });
      return;
    }

    setReminderBusy(true);
    try {
      const items = active.map((s) => ({
        name: reminderMed.name,
        dose: reminderMed.dose || null,
        time: s.time,
        status: 'Pending',
        source: 'medication',
        medicationId: reminderMed.id.startsWith('temp-') ? undefined : reminderMed.id,
        meta: {
          durationDays: reminderMed.durationDays ?? null,
          frequencyPerDay: active.length,
        },
        durationDays: reminderMed.durationDays ?? null,
        frequencyPerDay: active.length,
      }));

      const res = await fetch('/api/reminders', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(items),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || (data && data.ok === false)) {
        toast(data?.error || 'Could not create reminder. Please try again later.', { type: 'error' });
        return;
      }

      toast('Reminder(s) created', { type: 'success' });
      closeReminder();
      reloadReminders();
    } catch (err) {
      console.error('Error creating reminder:', err);
      toast('Network error creating reminder', { type: 'error' });
    } finally {
      setReminderBusy(false);
    }
  }

  const canSubmitCreate = createMode === 'manual' ? !!form.name.trim() : selectedErxCount > 0 && !!selectedEncounterId;

  const primaryButtonLabel =
    createMode === 'manual'
      ? isSubmitting
        ? 'Saving…'
        : 'Save Medication'
      : isSubmitting
      ? 'Adding…'
      : selectedErxCount > 1
      ? `Add ${selectedErxCount} Medications`
      : 'Add Medication';

  /* =========================================================
     UI
  ========================================================= */
  const showMobileCards = true;

  return (
    <main className="max-w-6xl mx-auto p-5 sm:p-6 space-y-6">
      {/* Premium header */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-indigo-50 shadow-sm">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-emerald-200/35 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-indigo-200/30 blur-3xl" />

        <div className="relative p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-700">
                <Icon name="pill" className="h-4 w-4" />
                Medication Hub
              </div>

              <h1 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-slate-950">Medications</h1>

              <p className="mt-2 text-sm text-slate-600 max-w-2xl">
                Keep your list clean, synced from eRx, and track adherence — so you and your clinician can make better decisions.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Chip className="border-slate-200 bg-white/80 text-slate-700">
                  <Dot className="bg-slate-900" />
                  Total: {medStats.total}
                </Chip>
                <Chip className={cx('border', STATUS_STYLES.Active.chip)}>
                  <Dot className={STATUS_STYLES.Active.dot} />
                  Active: {medStats.active}
                </Chip>
                <Chip className="border-sky-200 bg-sky-50 text-sky-800">
                  <Dot className="bg-sky-500" />
                  Pending reminders: {medStats.pendingRemindersTotal}
                </Chip>
                <Chip className="border-indigo-200 bg-indigo-50 text-indigo-800">
                  <Dot className="bg-indigo-500" />
                  eRx active: {medStats.erxActive}
                </Chip>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
              <Button
                onClick={openSyncLatestErx}
                className="bg-slate-900 text-white hover:bg-slate-800"
                title="Sync prescriptions from your latest eRx encounter"
              >
                <Icon name="sync" />
                Sync latest eRx
              </Button>

              <Button onClick={openCreate} className="bg-emerald-600 text-white hover:bg-emerald-700" title="Add a medication manually">
                <Icon name="plus" />
                Add Medication
              </Button>

              <Link
                href="/medications/print"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition"
                title="Print or export your medication list"
              >
                <Icon name="printer" />
                Print
              </Link>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedTabs
              value={activeTab}
              onChange={(v) => setActiveTab(v)}
              items={[
                { id: 'overview', label: 'Overview' },
                { id: 'list', label: 'Medications' },
                { id: 'history', label: 'History' },
              ]}
            />

            <div className="text-xs text-slate-500 flex items-center gap-2">
              <Icon name="bolt" className="h-4 w-4" />
              Pro tip: create reminders for every daily med, then the adherence score becomes meaningful.
            </div>
          </div>
        </div>
      </div>

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Your snapshot"
              subtitle="A clinician-friendly summary of active meds + adherence tracking."
              right={<GhostButton onClick={() => setActiveTab('list')}>View list</GhostButton>}
            />
            <CardBody className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs text-slate-500">Active meds</div>
                  <div className="mt-2 text-3xl font-black text-slate-950">{medStats.active}</div>
                  <div className="mt-2 text-xs text-slate-500">
                    {medStats.erxActive} from eRx · {medStats.manualActive} manual
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs text-slate-500">Reminder coverage</div>
                  <div className="mt-2 text-3xl font-black text-slate-950">
                    {medStats.active === 0 ? '—' : `${Math.round((medStats.withAnyReminders / Math.max(medStats.active, 1)) * 100)}%`}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {medStats.withAnyReminders}/{medStats.active} active meds have reminders
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs text-slate-500">History</div>
                  <div className="mt-2 text-xl font-extrabold text-slate-950">
                    {medStats.completed} <span className="text-xs font-semibold text-slate-400">completed</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">{medStats.onHold} on hold</div>
                </div>
              </div>

              {/* Adherence block (donut + trend + progress) */}
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-slate-900">Medication adherence</div>
                    <div className="mt-1 text-xs text-slate-600">
                      Based on reminder outcomes (Taken vs Missed). Pending reminders are treated as “not done yet.”
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <GhostButton onClick={reloadReminders} title="Refresh reminder status">
                      <Icon name="sync" />
                      Refresh
                    </GhostButton>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {/* Donut */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col items-center justify-center">
                    <div className="text-xs text-slate-500 mb-2">Adherence score</div>
                    <MeterDonut value={adherence.pct} max={100} label="Adherence" color="#10B981" unit="%" />
                    <div className="mt-2 text-[11px] text-slate-500 text-center">
                      {adherence.hasAnyTracking ? (
                        <>
                          <span className="font-semibold text-slate-700">{adherence.taken}</span> taken ·{' '}
                          <span className="font-semibold text-slate-700">{adherence.missed}</span> missed
                        </>
                      ) : (
                        'No reminder tracking yet — create reminders for daily meds.'
                      )}
                    </div>
                  </div>

                  {/* Trend */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs text-slate-500">Trend</div>
                        <div className="text-sm font-bold text-slate-900">Last 7 days</div>
                      </div>
                      <Chip
                        className={cx(
                          'border',
                          adherence.pct >= 90
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : adherence.pct >= 75
                            ? 'border-sky-200 bg-sky-50 text-sky-800'
                            : 'border-amber-200 bg-amber-50 text-amber-900'
                        )}
                      >
                        {adherence.pct >= 90 ? <Icon name="check" /> : <Icon name="warn" />}
                        {adherence.pct}% today
                      </Chip>
                    </div>

                    <div className="mt-3">
                      <Sparkline data={adherenceSeries} height={72} />
                    </div>

                    <div className="mt-3">
                      <div className="text-xs font-semibold text-slate-700">Progress (active meds)</div>
                      <div className="mt-2">
                        <ProgressBar
                          segments={[
                            { label: 'Taken', value: adherence.taken, className: 'bg-emerald-500' },
                            { label: 'Missed', value: adherence.missed, className: 'bg-rose-500' },
                            { label: 'Pending', value: adherence.pending, className: 'bg-sky-500' },
                          ]}
                          emptyLabel="No reminders found yet. Add reminders on your active meds to unlock adherence tracking."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
                <div className="text-sm font-bold text-slate-900">Next best step</div>
                <p className="mt-1 text-sm text-slate-600">
                  If you want the adherence score to be accurate, add reminders to your daily meds, then mark doses as taken.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={() => setActiveTab('list')} className="bg-emerald-600 text-white hover:bg-emerald-700">
                    Review list
                  </Button>

                  <GhostButton onClick={openSyncLatestErx}>
                    <Icon name="sync" />
                    Sync eRx
                  </GhostButton>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Today" subtitle="What’s pending right now, based on reminders." />
            <CardBody className="space-y-3">
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-bold text-sky-900">Pending reminders</div>
                  <Chip className="border-sky-200 bg-white text-sky-900">
                    <Icon name="clock" className="h-4 w-4" />
                    {medStats.pendingRemindersTotal}
                  </Chip>
                </div>
                <p className="mt-2 text-xs text-sky-800/80">
                  If this number feels high, create reminders only for active daily meds — and archive meds you’ve stopped.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-bold text-slate-900">Quality checks</div>
                <ul className="mt-2 space-y-2 text-xs text-slate-600">
                  <li className="flex gap-2">
                    <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Remove meds you’ve stopped (moves to History).
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    eRx meds are read-only (discuss changes with your clinician).
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-sky-500" />
                    Use “Print” before an appointment.
                  </li>
                </ul>
              </div>
            </CardBody>
          </Card>
        </section>
      )}

      {/* LIST */}
      {activeTab === 'list' && (
        <section className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader
              title="Filters"
              subtitle="Search across name, dose, or frequency — and slice by status."
              right={
                <div className="flex gap-2">
                  <GhostButton onClick={() => setSearch('')} disabled={!search}>
                    Clear search
                  </GhostButton>
                </div>
              }
            />
            <CardBody className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Icon name="search" />
                    </div>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by name, dose, or frequency…"
                      className={cx(
                        'w-full rounded-2xl border border-slate-200 bg-white',
                        'pl-10 pr-10 py-3 text-sm',
                        'focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400'
                      )}
                    />
                    {search ? (
                      <button
                        type="button"
                        onClick={() => setSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
                  {(['All', 'Active', 'Completed', 'On Hold'] as const).map((s) => {
                    const active = statusFilter === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatusFilter(s as any)}
                        className={cx(
                          'rounded-full border px-4 py-2 text-sm font-semibold transition',
                          active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        )}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Loading/error */}
          {isLoading ? (
            <Card>
              <CardHeader title="Loading" subtitle="Fetching your medication list…" />
              <CardBody className="space-y-3">
                <SkeletonLine className="w-1/3" />
                <SkeletonLine className="w-full" />
                <SkeletonLine className="w-2/3" />
                <div className="grid gap-2 sm:grid-cols-2">
                  <SkeletonLine className="h-20" />
                  <SkeletonLine className="h-20" />
                </div>
              </CardBody>
            </Card>
          ) : null}

          {!isLoading && loadError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{loadError}</div>
          ) : null}

          {/* Empty */}
          {!isLoading && filteredMeds.length === 0 ? (
            <Card>
              <CardHeader title="No matches" subtitle="Try adjusting your filters, or add a new medication." />
              <CardBody className="flex flex-col items-center justify-center py-10 text-center">
                <div className="text-sm text-slate-600">No medications found.</div>
                <Button onClick={openCreate} className="mt-4 bg-emerald-600 text-white hover:bg-emerald-700">
                  <Icon name="plus" />
                  Add Medication
                </Button>
              </CardBody>
            </Card>
          ) : null}

          {/* Content */}
          {!isLoading && filteredMeds.length > 0 ? (
            <>
              {/* Mobile cards */}
              {showMobileCards ? (
                <div className="grid gap-3 sm:hidden">
                  {filteredMeds.map((m) => {
                    const isEditing = editingId === m.id;
                    const draft = editDraft ?? {};
                    const a = aggForMed(m.id);
                    const encounterId = (m.meta && m.meta.encounterId) || undefined;

                    const totalToday = a.pending + a.taken + a.missed;
                    const doneToday = a.taken + a.missed;
                    const pctToday = totalToday > 0 ? Math.round((doneToday / totalToday) * 100) : 0;

                    return (
                      <Card key={m.id} className={cx(m.source === 'erx' ? 'border-indigo-200 bg-indigo-50/30' : '')}>
                        <CardBody className="pt-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-base font-extrabold text-slate-950 truncate">{m.name}</div>

                                <Chip className={cx('border', STATUS_STYLES[m.status].chip)}>
                                  <Dot className={STATUS_STYLES[m.status].dot} />
                                  {m.status}
                                </Chip>

                                {m.source === 'erx' ? (
                                  <Chip className="border-indigo-200 bg-indigo-50 text-indigo-800">
                                    <Dot className="bg-indigo-500" />
                                    eRx
                                  </Chip>
                                ) : null}

                                {a.pending > 0 ? (
                                  <Chip className="border-sky-200 bg-sky-50 text-sky-800">
                                    <Dot className="bg-sky-500" />
                                    {a.pending} pending
                                  </Chip>
                                ) : null}
                              </div>

                              {m.dose ? <div className="mt-2 text-sm text-slate-700">{m.dose}</div> : null}
                              {m.frequency ? <div className="mt-1 text-xs text-slate-500">{m.frequency}</div> : null}
                              <div className="mt-2 text-xs text-slate-500">
                                Started {formatDate(m.started)}
                                {m.lastFilled ? ` · Filled ${formatDate(m.lastFilled)}` : ''}
                              </div>

                              {m.orderId ? <div className="mt-2 text-xs text-slate-500">Order: {m.orderId}</div> : null}

                              {m.source === 'erx' && encounterId ? (
                                <div className="mt-1 text-xs text-indigo-700">
                                  Synced from encounter <span className="font-semibold">{encounterId}</span>
                                </div>
                              ) : null}

                              {m.status === 'Active' ? (
                                <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-xs font-bold text-slate-800">Adherence progress</div>
                                    <div className="text-[11px] text-slate-500">{totalToday > 0 ? `${pctToday}% done` : '—'}</div>
                                  </div>
                                  <div className="mt-2">
                                    <ProgressBar
                                      segments={[
                                        { label: 'Taken', value: a.taken, className: 'bg-emerald-500' },
                                        { label: 'Missed', value: a.missed, className: 'bg-rose-500' },
                                        { label: 'Pending', value: a.pending, className: 'bg-sky-500' },
                                      ]}
                                      emptyLabel="No reminders for this medication yet."
                                    />
                                  </div>
                                </div>
                              ) : null}
                            </div>

                            <div className="shrink-0 flex flex-col gap-2">
                              {isEditing ? null : (
                                <>
                                  {m.status === 'Active' ? (
                                    <GhostButton onClick={() => openReminderFor(m)}>
                                      <Icon name="clock" />
                                      {a.total ? 'Reminders' : 'Add reminder'}
                                    </GhostButton>
                                  ) : null}

                                  {m.source !== 'erx' ? <GhostButton onClick={() => startEditing(m)}>Edit</GhostButton> : null}

                                  {m.status === 'Active' ? (
                                    <button
                                      type="button"
                                      onClick={() => handleStopMedication(m)}
                                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition"
                                    >
                                      Remove
                                    </button>
                                  ) : null}
                                </>
                              )}
                            </div>
                          </div>

                          {/* Inline edit (mobile) */}
                          {isEditing ? (
                            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                              <div className="grid gap-3">
                                <label className="text-xs font-semibold text-slate-600">Name</label>
                                <input
                                  value={(draft.name as string) ?? m.name}
                                  onChange={(e) => updateEdit('name', e.target.value)}
                                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs font-semibold text-slate-600">Dose</label>
                                  <input
                                    value={(draft.dose as string) ?? m.dose}
                                    onChange={(e) => updateEdit('dose', e.target.value)}
                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-slate-600">Route</label>
                                  <input
                                    value={(draft.route as string) ?? m.route}
                                    onChange={(e) => updateEdit('route', e.target.value)}
                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="text-xs font-semibold text-slate-600">Frequency</label>
                                <input
                                  value={(draft.frequency as string) ?? m.frequency}
                                  onChange={(e) => updateEdit('frequency', e.target.value)}
                                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs font-semibold text-slate-600">Started</label>
                                  <input
                                    type="date"
                                    value={(draft.started as string) ?? m.started.slice(0, 10)}
                                    onChange={(e) => updateEdit('started', e.target.value)}
                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-slate-600">Last filled</label>
                                  <input
                                    type="date"
                                    value={(draft.lastFilled as string) ?? m.lastFilled.slice(0, 10)}
                                    onChange={(e) => updateEdit('lastFilled', e.target.value)}
                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs font-semibold text-slate-600">Duration (days)</label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={
                                      typeof draft.durationDays === 'number'
                                        ? String(draft.durationDays)
                                        : m.durationDays != null
                                        ? String(m.durationDays)
                                        : ''
                                    }
                                    onChange={(e) => updateEdit('durationDays', e.target.value ? Number(e.target.value) : undefined)}
                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-slate-600">Status</label>
                                  <select
                                    value={(draft.status as MedicationStatus) ?? m.status}
                                    onChange={(e) => updateEdit('status', e.target.value as MedicationStatus)}
                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                  >
                                    <option value="Active">Active</option>
                                    <option value="Completed">Completed</option>
                                    <option value="On Hold">On Hold</option>
                                  </select>
                                </div>
                              </div>

                              <div className="flex justify-end gap-2 pt-2">
                                <GhostButton onClick={cancelEdit} disabled={isSavingEdit}>
                                  Cancel
                                </GhostButton>
                                <Button onClick={saveEdit} disabled={isSavingEdit} className="bg-emerald-600 text-white hover:bg-emerald-700">
                                  {isSavingEdit ? 'Saving…' : 'Save'}
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </CardBody>
                      </Card>
                    );
                  })}
                </div>
              ) : null}

              {/* Desktop table */}
              <Card className="hidden sm:block">
                <CardHeader title="Medication list" subtitle="Editable (manual entries), with reminders + adherence indicators and eRx protection." />
                <CardBody className="pt-0">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                          <th className="py-3 pr-4">Name</th>
                          <th className="py-3 pr-4">Dose</th>
                          <th className="py-3 pr-4">Frequency</th>
                          <th className="py-3 pr-4">Route</th>
                          <th className="py-3 pr-4">Adherence</th>
                          <th className="py-3 pr-4">Duration</th>
                          <th className="py-3 pr-4">Started</th>
                          <th className="py-3 pr-4">Last Filled</th>
                          <th className="py-3 pr-4">Status</th>
                          <th className="py-3 pr-0 text-right">Actions</th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredMeds.map((m) => {
                          const isEditing = editingId === m.id;
                          const draft = editDraft ?? {};
                          const durationVal =
                            isEditing && typeof draft.durationDays === 'number'
                              ? String(draft.durationDays)
                              : m.durationDays != null
                              ? String(m.durationDays)
                              : '';

                          const a = aggForMed(m.id);
                          const reminderLabel = a.pending > 0 ? (a.pending === 1 ? '1 pending' : `${a.pending} pending`) : null;

                          const denom = a.taken + a.missed;
                          const pct = denom <= 0 ? (a.total > 0 ? 100 : 0) : Math.round((a.taken / denom) * 100);

                          const encounterId = (m.meta && m.meta.encounterId) || undefined;

                          return (
                            <tr
                              key={m.id}
                              className={cx(
                                'border-b border-slate-100 last:border-0 hover:bg-slate-50/60',
                                m.source === 'erx' ? 'bg-indigo-50/30' : ''
                              )}
                            >
                              {/* Name */}
                              <td className="py-3 pr-4 font-semibold text-slate-900">
                                <div className="flex flex-col gap-1">
                                  {isEditing ? (
                                    <input
                                      value={(draft.name as string) ?? m.name}
                                      onChange={(e) => updateEdit('name', e.target.value)}
                                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                    />
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <span className="truncate">{m.name}</span>
                                      {m.source === 'erx' ? (
                                        <Chip className="border-indigo-200 bg-indigo-50 text-indigo-800">
                                          <Dot className="bg-indigo-500" />
                                          eRx
                                        </Chip>
                                      ) : null}
                                    </div>
                                  )}

                                  {m.orderId && !isEditing ? <span className="text-[11px] font-medium text-slate-500">Order: {m.orderId}</span> : null}

                                  {m.source === 'erx' && encounterId && !isEditing ? (
                                    <span className="text-[11px] font-semibold text-indigo-700">Synced from eRx ({encounterId})</span>
                                  ) : null}
                                </div>
                              </td>

                              {/* Dose */}
                              <td className="py-3 pr-4 whitespace-nowrap text-slate-700">
                                {isEditing ? (
                                  <input
                                    value={(draft.dose as string) ?? m.dose}
                                    onChange={(e) => updateEdit('dose', e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                  />
                                ) : (
                                  m.dose
                                )}
                              </td>

                              {/* Frequency */}
                              <td className="py-3 pr-4 whitespace-nowrap text-slate-700">
                                {isEditing ? (
                                  <input
                                    value={(draft.frequency as string) ?? m.frequency}
                                    onChange={(e) => updateEdit('frequency', e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                  />
                                ) : (
                                  m.frequency
                                )}
                              </td>

                              {/* Route */}
                              <td className="py-3 pr-4 whitespace-nowrap text-slate-700">
                                {isEditing ? (
                                  <input
                                    value={(draft.route as string) ?? m.route}
                                    onChange={(e) => updateEdit('route', e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                  />
                                ) : (
                                  m.route
                                )}
                              </td>

                              {/* Adherence */}
                              <td className="py-3 pr-4 whitespace-nowrap">
                                {m.status !== 'Active' ? (
                                  <span className="text-xs text-slate-400">—</span>
                                ) : a.total <= 0 ? (
                                  <span className="text-xs text-slate-500">No reminders</span>
                                ) : (
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                      <Chip
                                        className={cx(
                                          'border',
                                          pct >= 90
                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                            : pct >= 75
                                            ? 'border-sky-200 bg-sky-50 text-sky-800'
                                            : 'border-amber-200 bg-amber-50 text-amber-900'
                                        )}
                                      >
                                        {pct >= 90 ? <Icon name="check" /> : <Icon name="warn" />}
                                        {pct}%
                                      </Chip>
                                      <span className="text-[11px] text-slate-500">
                                        {a.taken} taken · {a.missed} missed
                                      </span>
                                    </div>
                                    <div className="h-2 w-44 overflow-hidden rounded-full border border-slate-200 bg-slate-50 flex">
                                      <div className="bg-emerald-500 h-full" style={{ width: `${(a.taken / Math.max(1, a.total)) * 100}%` }} />
                                      <div className="bg-rose-500 h-full" style={{ width: `${(a.missed / Math.max(1, a.total)) * 100}%` }} />
                                      <div className="bg-sky-500 h-full" style={{ width: `${(a.pending / Math.max(1, a.total)) * 100}%` }} />
                                    </div>
                                  </div>
                                )}
                              </td>

                              {/* Duration */}
                              <td className="py-3 pr-4 whitespace-nowrap text-slate-700">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    min={0}
                                    value={durationVal}
                                    onChange={(e) => updateEdit('durationDays', e.target.value ? Number(e.target.value) : undefined)}
                                    className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                    placeholder="days"
                                  />
                                ) : m.durationDays != null ? (
                                  `${m.durationDays} day${m.durationDays === 1 ? '' : 's'}`
                                ) : (
                                  '—'
                                )}
                              </td>

                              {/* Started */}
                              <td className="py-3 pr-4 whitespace-nowrap text-slate-700">
                                {isEditing ? (
                                  <input
                                    type="date"
                                    value={(draft.started as string) ?? m.started.slice(0, 10)}
                                    onChange={(e) => updateEdit('started', e.target.value)}
                                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                  />
                                ) : (
                                  formatDate(m.started)
                                )}
                              </td>

                              {/* Last Filled */}
                              <td className="py-3 pr-4 whitespace-nowrap text-slate-700">
                                {isEditing ? (
                                  <input
                                    type="date"
                                    value={(draft.lastFilled as string) ?? m.lastFilled.slice(0, 10)}
                                    onChange={(e) => updateEdit('lastFilled', e.target.value)}
                                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                  />
                                ) : (
                                  formatDate(m.lastFilled)
                                )}
                              </td>

                              {/* Status */}
                              <td className="py-3 pr-4 whitespace-nowrap">
                                <div className="flex flex-col items-start gap-1">
                                  {isEditing ? (
                                    <select
                                      value={(draft.status as MedicationStatus) ?? m.status}
                                      onChange={(e) => updateEdit('status', e.target.value as MedicationStatus)}
                                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                    >
                                      <option value="Active">Active</option>
                                      <option value="Completed">Completed</option>
                                      <option value="On Hold">On Hold</option>
                                    </select>
                                  ) : (
                                    <Chip className={cx('border', STATUS_STYLES[m.status].chip)}>
                                      <Dot className={STATUS_STYLES[m.status].dot} />
                                      {m.status}
                                    </Chip>
                                  )}

                                  {reminderLabel ? (
                                    <Chip className="border-sky-200 bg-sky-50 text-sky-800">
                                      <Dot className="bg-sky-500" />
                                      {reminderLabel}
                                    </Chip>
                                  ) : null}
                                </div>
                              </td>

                              {/* Actions */}
                              <td className="py-3 pr-0 text-right whitespace-nowrap">
                                {isEditing ? (
                                  <div className="flex justify-end gap-2">
                                    <GhostButton onClick={cancelEdit} disabled={isSavingEdit}>
                                      Cancel
                                    </GhostButton>
                                    <Button onClick={saveEdit} disabled={isSavingEdit} className="bg-emerald-600 text-white hover:bg-emerald-700">
                                      {isSavingEdit ? 'Saving…' : 'Save'}
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex justify-end gap-3 text-sm">
                                    {m.status === 'Active' ? (
                                      <button
                                        type="button"
                                        onClick={() => handleStopMedication(m)}
                                        className="font-semibold text-slate-500 hover:text-red-700 hover:underline"
                                      >
                                        Remove
                                      </button>
                                    ) : null}

                                    {m.source !== 'erx' ? (
                                      <button type="button" onClick={() => startEditing(m)} className="font-semibold text-emerald-700 hover:underline">
                                        Edit
                                      </button>
                                    ) : null}

                                    {m.status === 'Active' ? (
                                      <button
                                        type="button"
                                        onClick={() => openReminderFor(m)}
                                        className="font-semibold text-slate-600 hover:text-emerald-700 hover:underline"
                                      >
                                        {a.total ? 'Manage reminders' : 'Add reminder'}
                                      </button>
                                    ) : null}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>
            </>
          ) : null}
        </section>
      )}

      {/* HISTORY */}
      {activeTab === 'history' && (
        <Card>
          <CardHeader title="History" subtitle="Completed and on-hold medications." />
          <CardBody>
            {historyMeds.length === 0 ? (
              <div className="text-sm text-slate-600">No completed or on-hold medications yet.</div>
            ) : (
              <div className="space-y-3">
                {historyMeds.map((m) => (
                  <div key={m.id} className="flex items-start justify-between gap-4 border-b border-slate-100 last:border-0 pb-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-extrabold text-slate-950 truncate">{m.name}</div>
                        {m.dose ? <div className="text-sm text-slate-500">· {m.dose}</div> : null}
                        <Chip className={cx('border', STATUS_STYLES[m.status].chip)}>
                          <Dot className={STATUS_STYLES[m.status].dot} />
                          {m.status}
                        </Chip>
                        {m.source === 'erx' ? (
                          <Chip className="border-indigo-200 bg-indigo-50 text-indigo-800">
                            <Dot className="bg-indigo-500" />
                            eRx
                          </Chip>
                        ) : null}
                      </div>

                      <div className="mt-1 text-xs text-slate-600">
                        {(m.frequency ?? '').trim()}
                        {m.route ? ` · ${m.route}` : ''}
                      </div>

                      <div className="mt-2 text-[11px] text-slate-500">
                        Started {formatDate(m.started)}
                        {m.lastFilled ? ` · Last filled ${formatDate(m.lastFilled)}` : ''}
                      </div>

                      {m.source === 'erx' && m.meta?.encounterId ? (
                        <div className="mt-1 text-[11px] text-indigo-700 font-semibold">Synced from eRx ({m.meta.encounterId})</div>
                      ) : null}
                    </div>

                    {m.durationDays != null ? (
                      <div className="shrink-0 text-right text-xs text-slate-500">
                        Duration
                        <div className="mt-1 text-sm font-extrabold text-slate-900">{m.durationDays}d</div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* CREATE / SYNC MODAL */}
      <Modal open={isCreateOpen} onClose={closeCreate} title="Add Medication" subtitle="Capture manually, or sync from an eRx encounter." maxW="2xl">
        <form onSubmit={handleCreate} className="space-y-4">
          {/* Mode toggle */}
          <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setCreateMode('manual')}
              className={cx(
                'px-4 py-2 rounded-xl text-sm font-bold transition',
                createMode === 'manual' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Manual entry
            </button>
            <button
              type="button"
              onClick={() => setCreateMode('erx')}
              className={cx(
                'px-4 py-2 rounded-xl text-sm font-bold transition',
                createMode === 'erx' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Sync from eRx
            </button>
          </div>

          {createMode === 'manual' ? (
            <>
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  placeholder="e.g., Paracetamol"
                  className={cx(
                    'w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400'
                  )}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Dose</label>
                  <input
                    value={form.dose}
                    onChange={(e) => handleFormChange('dose', e.target.value)}
                    placeholder="e.g., 500 mg"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Frequency</label>
                  <input
                    value={form.frequency}
                    onChange={(e) => handleFormChange('frequency', e.target.value)}
                    placeholder="e.g., 1 tablet every 6 hours"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Route</label>
                  <input
                    value={form.route}
                    onChange={(e) => handleFormChange('route', e.target.value)}
                    placeholder="e.g., Oral"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Duration (days)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.duration}
                    onChange={(e) => handleFormChange('duration', e.target.value)}
                    placeholder="e.g., 5"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => handleFormChange('status', e.target.value as MedicationStatus)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                  >
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Started</label>
                  <input
                    type="date"
                    value={form.started}
                    onChange={(e) => handleFormChange('started', e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Last Filled</label>
                  <input
                    type="date"
                    value={form.lastFilled}
                    onChange={(e) => handleFormChange('lastFilled', e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Related Order ID (optional)</label>
                <input
                  value={form.orderId}
                  onChange={(e) => handleFormChange('orderId', e.target.value)}
                  placeholder="If this medication comes from an order"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                />
                <p className="mt-1 text-xs text-slate-500">If populated, the list will show where it was synced from.</p>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-800">Encounter (eRx session)</label>
                <select
                  value={selectedEncounterId}
                  onChange={(e) => onEncounterChange(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                  disabled={encLoading}
                >
                  <option value="">{encLoading ? 'Loading encounters…' : 'Select an encounter'}</option>
                  {encounters.map((enc) => (
                    <option key={enc.id} value={enc.id}>
                      {formatEncounterLabel(enc)}
                    </option>
                  ))}
                </select>

                {encError ? <p className="text-xs text-amber-700">{encError}</p> : null}
                <p className="text-xs text-slate-500">We’ll pull prescriptions from this session so you can choose what you are currently taking.</p>
              </div>

              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 text-xs text-slate-500">
                  <span>{selectedEncounterId ? 'Prescriptions from this encounter' : 'Select an encounter to see prescriptions'}</span>
                  {erxItems.length > 0 ? (
                    <div className="flex gap-3 font-semibold">
                      <button type="button" onClick={() => selectAllErx(true)} className="hover:underline">
                        Select all
                      </button>
                      <button type="button" onClick={() => selectAllErx(false)} className="hover:underline">
                        Clear
                      </button>
                    </div>
                  ) : null}
                </div>

                {erxLoading ? (
                  <div className="px-4 py-6 text-sm text-slate-600">Loading prescriptions…</div>
                ) : erxItems.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-slate-600">No prescriptions found for this encounter (live or mock).</div>
                ) : (
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                          <th className="px-4 py-2">Use</th>
                          <th className="px-4 py-2">Name</th>
                          <th className="px-4 py-2">Dose</th>
                          <th className="px-4 py-2">Frequency</th>
                          <th className="px-4 py-2">Route</th>
                          <th className="px-4 py-2">Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {erxItems.map((item) => (
                          <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                            <td className="px-4 py-2">
                              <input
                                type="checkbox"
                                checked={item.selected}
                                onChange={() => toggleErxSelection(item.id)}
                                className="h-4 w-4"
                              />
                            </td>
                            <td className="px-4 py-2 font-bold text-slate-900">{item.name}</td>
                            <td className="px-4 py-2 text-slate-700">{item.dose}</td>
                            <td className="px-4 py-2 text-slate-700">{item.frequency}</td>
                            <td className="px-4 py-2 text-slate-700">{item.route}</td>
                            <td className="px-4 py-2 text-slate-700">
                              {item.durationDays != null ? `${item.durationDays} day${item.durationDays === 1 ? '' : 's'}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <GhostButton onClick={closeCreate} disabled={isSubmitting}>
              Cancel
            </GhostButton>
            <Button type="submit" disabled={isSubmitting || !canSubmitCreate} className="bg-emerald-600 text-white hover:bg-emerald-700">
              {primaryButtonLabel}
            </Button>
          </div>
        </form>
      </Modal>

      {/* REMINDER MODAL */}
      <Modal open={!!reminderMed} onClose={closeReminder} title="Create reminders" subtitle={reminderMed ? `Set daily times for ${reminderMed.name}.` : undefined} maxW="md">
        {reminderMed ? (
          <form onSubmit={handleCreateReminder} className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-extrabold text-slate-900">
                {reminderMed.name}
                {reminderMed.dose ? <span className="text-slate-500"> · {reminderMed.dose}</span> : null}
              </div>
              {reminderMed.frequency ? <div className="mt-1 text-xs text-slate-600">{reminderMed.frequency}</div> : null}
              {reminderMed.durationDays != null ? (
                <div className="mt-1 text-xs text-slate-600">
                  Duration: {reminderMed.durationDays} day{reminderMed.durationDays === 1 ? '' : 's'}
                </div>
              ) : null}

              {reminderFreqPerDay && reminderMed.durationDays ? (
                <div className="mt-2 text-xs text-slate-600">
                  Approx. <span className="font-bold">{reminderFreqPerDay}×/day</span> for{' '}
                  <span className="font-bold">
                    {reminderMed.durationDays} day{reminderMed.durationDays === 1 ? '' : 's'}
                  </span>{' '}
                  ({reminderFreqPerDay * reminderMed.durationDays} doses)
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-extrabold text-slate-900">Daily times</div>
                <button type="button" onClick={addSchedule} className="text-sm font-bold text-emerald-700 hover:underline">
                  Add another time
                </button>
              </div>

              <div className="space-y-2">
                {reminderSchedules.map((s, idx) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <input type="checkbox" checked={s.enabled} onChange={() => toggleSchedule(s.id)} className="h-4 w-4" />

                    <input
                      type="time"
                      value={s.time}
                      onChange={(e) => updateSchedule(s.id, e.target.value)}
                      className={cx(
                        'rounded-xl border border-slate-200 px-4 py-2 text-sm',
                        'focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400'
                      )}
                      required={s.enabled}
                    />

                    <div className="hidden sm:flex gap-1 text-[11px] text-slate-500">
                      {idx === 0 ? (
                        <>
                          <button
                            type="button"
                            onClick={() => updateSchedule(s.id, '08:00')}
                            className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
                          >
                            Morning
                          </button>
                          <button
                            type="button"
                            onClick={() => updateSchedule(s.id, '14:00')}
                            className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
                          >
                            Afternoon
                          </button>
                          <button
                            type="button"
                            onClick={() => updateSchedule(s.id, '20:00')}
                            className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
                          >
                            Evening
                          </button>
                        </>
                      ) : null}
                    </div>

                    {reminderSchedules.length > 1 ? (
                      <button type="button" onClick={() => removeSchedule(s.id)} className="ml-auto text-sm font-bold text-slate-400 hover:text-red-700">
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-500">
              You can adjust reminder times later. For meds taken more than once a day, keep multiple times enabled.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <GhostButton onClick={closeReminder} disabled={reminderBusy}>
                Cancel
              </GhostButton>
              <Button type="submit" disabled={reminderBusy} className="bg-emerald-600 text-white hover:bg-emerald-700">
                {reminderBusy ? 'Creating…' : 'Create reminder(s)'}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </main>
  );
}
