// apps/patient-app/app/medications/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { formatDate } from '../../src/lib/date';
import { computeMedicationAdherence } from '../../src/lib/medication-adherence';
import { toast } from '../../components/toast';
import { ensureRemindersPushSubscription } from '@/lib/pushBrowser';

// Reuse the same “homepage-style” visuals (donut + sparkline)
import MeterDonut from '../../components/charts/AnimatedMeterDonut';

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
  started: string | null;
  lastFilled: string | null;
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
  started: string | null;
  lastFilled: string | null;
  status: MedicationStatus;
  duration: string;
  orderId: string;
};

type ReminderStatus = 'Pending' | 'Taken' | 'Missed';

type Reminder = {
  id: string;
  medicationId?: string | null;
  name?: string | null;
  title?: string | null;
  dose?: string | null;
  status: ReminderStatus;
  scheduledFor?: string;
  takenAt?: string;
  reportedTakenAt?: string;
  verifiedAt?: string;
  verificationRequired?: boolean;
  verificationStatus?: string | null;
  takenSource?: string | null;
  snoozedUntil?: string | null;
  createdAt?: string;
  dueAt?: string;
  time?: string;
  source?: string | null;
  type?: string | null;
  category?: string | null;
  meta?: any;
};

type ReminderAgg = {
  pending: number;
  taken: number;
  verifiedTaken: number;
  selfReportedTaken: number;
  missed: number;
  total: number;
  weightedPct: number;
  confidencePct: number;
};

type ReminderSchedule = {
  id: string;
  time: string;
  enabled: boolean;
  label?: string;
  scheduledFor?: string | null;
};

/* =========================================================
   Styles + constants
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

function normalizeSigText(...values: Array<string | null | undefined>) {
  return values
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ');
}

// SIG/frequency parser: conservative, deterministic, and safe for patient-facing reminder defaults.
function guessFrequencyPerDay(freq: string | undefined | null): number | undefined {
  const s = normalizeSigText(freq);
  if (!s) return undefined;

  if (/\b(q4h|every\s*4\s*hours?)\b/.test(s)) return 6;
  if (/\b(q6h|every\s*6\s*hours?)\b/.test(s)) return 4;
  if (/\b(q8h|every\s*8\s*hours?)\b/.test(s)) return 3;
  if (/\b(q12h|every\s*12\s*hours?)\b/.test(s)) return 2;
  if (/\b(q24h|every\s*24\s*hours?)\b/.test(s)) return 1;

  if (/\b(four times|4 times|qid|q\.i\.d)\b/.test(s)) return 4;
  if (/\b(three times|3 times|tid|t\.i\.d)\b/.test(s)) return 3;
  if (/\b(twice|2 times|bid|b\.i\.d|bd)\b/.test(s)) return 2;
  if (/\b(once daily|once a day|daily|od|o\.d|nocte|nightly|mane|morning)\b/.test(s)) return 1;

  return undefined;
}

function inferIntervalHours(freq: string | undefined | null): number | null {
  const s = normalizeSigText(freq);
  if (!s) return null;

  const explicit = s.match(/\bevery\s*(\d{1,2})\s*hours?\b/);
  if (explicit) {
    const n = Number(explicit[1]);
    return Number.isFinite(n) && n >= 4 && n <= 24 ? n : null;
  }

  const qh = s.match(/\bq(\d{1,2})h\b/);
  if (qh) {
    const n = Number(qh[1]);
    return Number.isFinite(n) && n >= 4 && n <= 24 ? n : null;
  }

  return null;
}

function parseDateCandidate(value: unknown): Date | null {
  const raw = safeText(value);
  if (!raw) return null;

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;

  return d;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function setClock(date: Date, hhmm: string) {
  const [hh, mm] = hhmm.split(':').map((x) => Number(x));
  const next = new Date(date);
  next.setHours(Number.isFinite(hh) ? hh : 8, Number.isFinite(mm) ? mm : 0, 0, 0);
  return next;
}

function formatHHMM(date: Date) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function roundUpToNextQuarter(date: Date) {
  const next = new Date(date);
  next.setSeconds(0, 0);
  const minute = next.getMinutes();
  const rounded = Math.ceil(minute / 15) * 15;

  if (rounded >= 60) {
    next.setHours(next.getHours() + 1, 0, 0, 0);
  } else {
    next.setMinutes(rounded, 0, 0);
  }

  return next;
}

function nextOccurrenceForTime(hhmm: string, from = new Date()) {
  const today = setClock(from, hhmm);
  if (today.getTime() >= from.getTime() - 5 * 60_000) return today;

  const tomorrow = new Date(from);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return setClock(tomorrow, hhmm);
}

function medicationIsErx(m: Medication) {
  const source = normalizeSigText(m.source, m.meta?.source, m.meta?.rxSource);
  return (
    source.includes('erx') ||
    source.includes('prescription') ||
    Boolean(m.orderId) ||
    Boolean(m.meta?.erxId || m.meta?.rxId || m.meta?.encounterId)
  );
}

function inferCarePortFulfilment(m: Medication) {
  const meta = m.meta && typeof m.meta === 'object' ? m.meta : {};
  const careport = meta.careport && typeof meta.careport === 'object' ? meta.careport : {};
  const delivery = meta.delivery && typeof meta.delivery === 'object' ? meta.delivery : {};

  const deliveredAt =
    parseDateCandidate(careport.deliveredAt) ||
    parseDateCandidate(careport.completedAt) ||
    parseDateCandidate(delivery.deliveredAt) ||
    parseDateCandidate(delivery.completedAt) ||
    parseDateCandidate(meta.deliveredAt);

  const collectedAt =
    parseDateCandidate(careport.collectedAt) ||
    parseDateCandidate(delivery.collectedAt) ||
    parseDateCandidate(meta.collectedAt);

  const mode = normalizeSigText(
    careport.mode,
    careport.fulfilmentMode,
    delivery.mode,
    delivery.fulfilmentMode,
    meta.fulfilmentMode,
    meta.deliveryMode,
  );

  if (deliveredAt || mode.includes('delivery') || mode.includes('home')) {
    return {
      kind: 'careport_delivery' as const,
      eventAt: deliveredAt,
      label: deliveredAt
        ? 'First dose is anchored shortly after confirmed CarePort delivery.'
        : 'CarePort delivery detected; confirm the first practical dose time.',
    };
  }

  if (collectedAt || mode.includes('collect') || mode.includes('pickup') || mode.includes('pick-up')) {
    return {
      kind: 'collection' as const,
      eventAt: collectedAt,
      label: collectedAt
        ? 'First dose is anchored after collection.'
        : 'Collection/outside fulfilment detected; confirm the first practical dose time.',
    };
  }

  return {
    kind: 'manual_or_unknown' as const,
    eventAt: null,
    label: 'Confirm the first practical dose time for this medication.',
  };
}

function getDoseTimeLabels(freqText: string | undefined | null, count: number) {
  const s = normalizeSigText(freqText);

  if (count === 1) {
    if (/\b(nocte|night|nightly|bedtime|at night)\b/.test(s)) return ['Night'];
    if (/\b(evening|pm)\b/.test(s)) return ['Evening'];
    if (/\b(afternoon|noon|midday)\b/.test(s)) return ['Afternoon'];
    return ['Morning'];
  }

  if (count === 2) return ['Morning', 'Evening'];
  if (count === 3) return ['Morning', 'Afternoon', 'Evening'];
  if (count === 4) return ['Early', 'Midday', 'Evening', 'Night'];

  return Array.from({ length: count }, (_, i) => `Dose ${i + 1}`);
}

function inferReminderSchedulesForMedication(m: Medication) {
  const sig = normalizeSigText(m.frequency, m.route, m.dose);
  const freqPerDay = guessFrequencyPerDay(sig) ?? 1;
  const intervalHours = inferIntervalHours(sig);
  const fulfilment = inferCarePortFulfilment(m);
  const now = new Date();

  const startCandidate =
    fulfilment.eventAt != null
      ? addMinutes(fulfilment.eventAt, fulfilment.kind === 'careport_delivery' ? 15 : 30)
      : parseDateCandidate(m.started) ||
        parseDateCandidate(m.lastFilled) ||
        null;

  let firstDose: Date;

  if (startCandidate) {
    const startIsToday = startOfDay(startCandidate).getTime() === startOfDay(now).getTime();
    const startIsFuture = startCandidate.getTime() > now.getTime();

    if (startIsFuture || startIsToday) {
      firstDose = roundUpToNextQuarter(startCandidate.getTime() < now.getTime() ? addMinutes(now, 30) : startCandidate);
    } else {
      firstDose = nextOccurrenceForTime(defaultTimesForFrequencyPerDay(freqPerDay)[0], now);
    }
  } else if (medicationIsErx(m)) {
    firstDose = roundUpToNextQuarter(addMinutes(now, 30));
  } else {
    firstDose = nextOccurrenceForTime(defaultTimesForFrequencyPerDay(freqPerDay)[0], now);
  }

  const labels = getDoseTimeLabels(sig, freqPerDay);
  const times =
    intervalHours && freqPerDay > 1
      ? Array.from({ length: freqPerDay }, (_, index) => addMinutes(firstDose, index * intervalHours * 60))
      : defaultTimesForFrequencyPerDay(freqPerDay).map((time, index) =>
          index === 0 && (fulfilment.eventAt || medicationIsErx(m))
            ? firstDose
            : nextOccurrenceForTime(time, now),
        );

  const seen = new Set<string>();
  const schedules = times
    .map((date, index): ReminderSchedule => {
      const hhmm = formatHHMM(date);
      return {
        id: `sch-${Date.now()}-${index}`,
        time: hhmm,
        scheduledFor: date.toISOString(),
        enabled: !seen.has(hhmm),
        label: labels[index] ?? `Dose ${index + 1}`,
      };
    })
    .filter((schedule) => {
      if (seen.has(schedule.time)) return false;
      seen.add(schedule.time);
      return true;
    });

  return {
    freqPerDay,
    intervalHours,
    fulfilment,
    firstDoseIso: firstDose.toISOString(),
    schedules: schedules.length ? schedules : [{ id: `sch-${Date.now()}-0`, time: '08:00', scheduledFor: nextOccurrenceForTime('08:00').toISOString(), enabled: true, label: 'Morning' }],
  };
}

function reminderVerificationDefault(m: Medication) {
  if (typeof m.meta?.verificationRequiredDefault === 'boolean') return m.meta.verificationRequiredDefault;
  if (typeof m.meta?.verificationRequired === 'boolean') return m.meta.verificationRequired;

  return medicationIsErx(m);
}

function reminderManualEarlierDefault(m: Medication) {
  if (typeof m.meta?.manualEarlierLoggingAllowed === 'boolean') {
    return m.meta.manualEarlierLoggingAllowed;
  }

  return true;
}

async function postJsonWithResult(url: string, method: 'POST' | 'PUT' | 'PATCH', body: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(body ?? {}),
  });

  const raw = await res.text().catch(() => '');
  let data: any = null;

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
    }
  }

  const ok = res.ok && !(data && typeof data === 'object' && data.ok === false);
  return { res, data, ok };
}

async function createMedicationReminders(items: any[]) {
  const attempts: Array<{ method: 'POST' | 'PUT'; body: unknown; label: string }> = [
    {
      method: 'POST',
      body: { action: 'create', reminders: items },
      label: 'post_action_create',
    },
    {
      method: 'POST',
      body: { reminders: items, items },
      label: 'post_wrapped_items',
    },
    {
      method: 'PUT',
      body: items,
      label: 'put_legacy_array',
    },
  ];

  let last: { data: any; status: number; label: string } | null = null;

  for (const attempt of attempts) {
    const result = await postJsonWithResult('/api/reminders', attempt.method, attempt.body);

    if (result.ok) {
      return {
        ok: true,
        data: result.data,
        status: result.res.status,
        label: attempt.label,
      };
    }

    last = {
      data: result.data,
      status: result.res.status,
      label: attempt.label,
    };

    if (![400, 404, 405, 409, 422].includes(result.res.status)) break;
  }

  return {
    ok: false,
    data: last?.data,
    status: last?.status ?? 0,
    label: last?.label ?? 'not_attempted',
  };
}


async function ensureMedicationReminderPushEnabled() {
  if (typeof window === 'undefined') return;

  try {
    if (!('Notification' in window)) return;

    if (window.Notification.permission === 'default') {
      const permission = await window.Notification.requestPermission();
      if (permission !== 'granted') return;
    }

    if (window.Notification.permission !== 'granted') return;

    await ensureRemindersPushSubscription();
  } catch (err) {
    console.error('Medication reminder push setup failed', err);
  }
}

function getWeekBucket(date: Date | null) {
  if (!date) return 'Unscheduled';

  const today = startOfDay(new Date()).getTime();
  const day = startOfDay(date).getTime();
  const diff = Math.round((day - today) / (24 * 60 * 60 * 1000));

  if (diff < 0) return 'Overdue';
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff >= 2 && diff <= 6) {
    return date.toLocaleDateString(undefined, { weekday: 'long' });
  }

  return 'Later';
}


function getReminderDisplayName(reminder: Reminder) {
  return safeText(reminder.name ?? reminder.title ?? reminder.meta?.name ?? reminder.meta?.title) || 'Medication reminder';
}

function getReminderDose(reminder: Reminder) {
  return safeText(reminder.dose ?? reminder.meta?.dose);
}

function getReminderStatus(reminder: Reminder) {
  return safeText(reminder.status).toLowerCase();
}

function isMedicationReminder(reminder: Reminder) {
  const source = normalizeSigText(reminder.source, reminder.type, reminder.category, reminder.meta?.source, reminder.meta?.type, reminder.meta?.category);
  return (
    source.includes('medication') ||
    source.includes('pill') ||
    Boolean(reminder.medicationId)
  );
}

function getReminderDueDate(reminder: Reminder) {
  return (
    parseDateCandidate(reminder.snoozedUntil) ||
    parseDateCandidate(reminder.dueAt) ||
    parseDateCandidate(reminder.scheduledFor) ||
    (reminder.time ? nextOccurrenceForTime(reminder.time) : null)
  );
}

function formatDueLabel(reminder: Reminder) {
  const due = getReminderDueDate(reminder);
  if (!due) return reminder.time || 'Time not set';

  const today = startOfDay(new Date()).getTime();
  const dueDay = startOfDay(due).getTime();
  const time = due.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  if (dueDay === today) return `Today · ${time}`;
  if (dueDay === today + 24 * 60 * 60 * 1000) return `Tomorrow · ${time}`;

  return due.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function reminderRequiresCamera(reminder: Reminder) {
  return Boolean(reminder.verificationRequired ?? reminder.meta?.verificationRequired);
}

function timeToIsoToday(hhmm: string) {
  const target = setClock(new Date(), hhmm || formatHHMM(new Date()));
  return target.toISOString();
}

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function safeText(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function safeIsoDate(value: unknown): string | null {
  const raw = safeText(value);
  if (!raw) return null;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  return raw;
}

function safeDateInputValue(value: unknown): string {
  const raw = safeText(value);
  if (!raw) return '';

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';

  return raw.slice(0, 10);
}

function safeFormatDate(value: unknown, fallback = 'Not recorded'): string {
  const iso = safeIsoDate(value);
  if (!iso) return fallback;

  try {
    return formatDate(iso);
  } catch {
    return fallback;
  }
}

function normalizeStatus(value: unknown): MedicationStatus {
  const raw = safeText(value).toLowerCase();

  if (raw === 'completed' || raw === 'taken' || raw === 'stopped' || raw === 'inactive') {
    return 'Completed';
  }

  if (raw === 'on hold' || raw === 'hold' || raw === 'paused' || raw === 'pause') {
    return 'On Hold';
  }

  return 'Active';
}

function normalizeMedication(item: unknown, index: number): Medication | null {
  if (!item || typeof item !== 'object') return null;

  const record = item as Record<string, any>;
  const id = safeText(record.id ?? record.medicationId ?? record.orderId);
  const name = safeText(record.name ?? record.drug ?? record.display ?? record.title);

  if (!id || !name) return null;

  return {
    id,
    name,
    dose: safeText(record.dose),
    frequency: safeText(record.frequency),
    route: safeText(record.route),
    started: safeIsoDate(record.started ?? record.startedAt ?? record.startDate),
    lastFilled: safeIsoDate(record.lastFilled ?? record.filledAt ?? record.dispensedAt),
    status: normalizeStatus(record.status),
    durationDays:
      typeof record.durationDays === 'number' && Number.isFinite(record.durationDays)
        ? record.durationDays
        : record.durationDays == null || record.durationDays === ''
          ? null
          : Number.isFinite(Number(record.durationDays))
            ? Number(record.durationDays)
            : null,
    orderId: record.orderId == null ? null : safeText(record.orderId) || null,
    source: record.source == null ? null : safeText(record.source) || null,
    meta: record.meta ?? null,
  };
}

// deterministic trend series derived from the current adherence percentage
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
  name: 'plus' | 'sync' | 'printer' | 'x' | 'search' | 'bolt' | 'clock' | 'pill' | 'check' | 'warn' | 'camera';
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
    case 'camera':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 8a3 3 0 0 1 3-3h1.2l1.4-2h4.8l1.4 2H17a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="2" />
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

function AdherenceSparkline(props: { values: number[]; height?: number }) {
  const height = props.height ?? 72;
  const width = 420;
  const values = props.values.length ? props.values : [0];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const step = values.length > 1 ? width / (values.length - 1) : width;

  const points = values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / range) * (height - 12) - 6;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Medication adherence trend"
      className="h-full w-full overflow-visible"
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-emerald-600"
      />
    </svg>
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
  const [requireCameraVerification, setRequireCameraVerification] = useState(true);
  const [allowManualEarlierTaken, setAllowManualEarlierTaken] = useState(true);

  const [takeModalOpen, setTakeModalOpen] = useState(false);
  const [takeSelectedReminderId, setTakeSelectedReminderId] = useState<string>('');
  const [takeUseCameraVerification, setTakeUseCameraVerification] = useState(false);
  const [takeEarlierMode, setTakeEarlierMode] = useState(false);
  const [takeEarlierTime, setTakeEarlierTime] = useState(formatHHMM(new Date()));
  const [takeBusy, setTakeBusy] = useState(false);
  const [todaysPillsDrawerOpen, setTodaysPillsDrawerOpen] = useState(false);

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
        setMeds(list.map(normalizeMedication).filter(Boolean) as Medication[]);
      } catch (err) {
        console.error('Error loading medications:', err);
        setLoadError('Unable to load medications from the server.');
        setMeds([]);
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

      const grouped: Record<string, Reminder[]> = {};
      for (const r of raw) {
        const mid = r.medicationId;
        if (!mid) continue;
        if (!grouped[mid]) grouped[mid] = [];
        grouped[mid].push(r);
      }

      const map: Record<string, ReminderAgg> = {};
      for (const [mid, items] of Object.entries(grouped)) {
        const summary = computeMedicationAdherence(items);
        map[mid] = {
          pending: summary.pending,
          taken: summary.taken,
          verifiedTaken: summary.verifiedTaken,
          selfReportedTaken: summary.selfReportedTaken,
          missed: summary.missed,
          total: summary.pending + summary.taken + summary.missed,
          weightedPct: summary.weightedPct,
          confidencePct: summary.confidencePct,
        };
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
        setEncError('Unable to load recent sessions.');
        setEncounters([]);
        setAutoSelectLatestErx(false);
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
  const aggForMed = (id: string): ReminderAgg =>
    remindersAggByMed[id] ?? {
      pending: 0,
      taken: 0,
      verifiedTaken: 0,
      selfReportedTaken: 0,
      missed: 0,
      total: 0,
      weightedPct: 100,
      confidencePct: 100,
    };

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
        verifiedTakenTotal: 0,
        selfReportedTakenTotal: 0,
        missedTotal: 0,
        totalRemindersAll: 0,
        weightedPctAvg: 100,
        confidencePctAvg: 100,
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
    let verifiedTakenTotal = 0;
    let selfReportedTakenTotal = 0;
    let missedTotal = 0;
    let totalRemindersAll = 0;
    let weightedPctSum = 0;
    let confidencePctSum = 0;
    let weightedCount = 0;

    for (const m of active) {
      const a = aggForMed(m.id);
      if (a.total > 0) withAnyReminders += 1;
      pendingRemindersTotal += a.pending;
      takenTotal += a.taken;
      verifiedTakenTotal += a.verifiedTaken;
      selfReportedTakenTotal += a.selfReportedTaken;
      missedTotal += a.missed;
      totalRemindersAll += a.total;
      if (a.total > 0) {
        weightedPctSum += a.weightedPct;
        confidencePctSum += a.confidencePct;
        weightedCount += 1;
      }
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
      verifiedTakenTotal,
      selfReportedTakenTotal,
      missedTotal,
      totalRemindersAll,
      weightedPctAvg: weightedCount > 0 ? Math.round(weightedPctSum / weightedCount) : 100,
      confidencePctAvg: weightedCount > 0 ? Math.round(confidencePctSum / weightedCount) : 100,
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
      weightedPct: medStats.weightedPctAvg,
      confidencePct: medStats.confidencePctAvg,
      denom,
      hasAnyTracking,
      hasHistory,
      taken: medStats.takenTotal,
      verifiedTaken: medStats.verifiedTakenTotal,
      selfReportedTaken: medStats.selfReportedTakenTotal,
      missed: medStats.missedTotal,
      pending: medStats.pendingRemindersTotal,
      total: medStats.totalRemindersAll,
    };
  }, [medStats]);

  const adherenceSeries = useMemo(() => buildTrendSeries(adherence.weightedPct, meds.length + medStats.active * 11), [adherence.weightedPct, meds.length, medStats.active]);

  const nextDueMedicationReminders = useMemo(
    () =>
      remindersAll
        .filter((reminder) => isMedicationReminder(reminder))
        .filter((reminder) => ['pending', 'scheduled', 'due'].some((status) => getReminderStatus(reminder).includes(status)))
        .slice()
        .sort((a, b) => {
          const aTime = getReminderDueDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const bTime = getReminderDueDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          return aTime - bTime;
        })
        .slice(0, 5),
    [remindersAll],
  );

  const selectedTakeReminder = useMemo(
    () => nextDueMedicationReminders.find((reminder) => reminder.id === takeSelectedReminderId) ?? null,
    [nextDueMedicationReminders, takeSelectedReminderId],
  );

  const todaysMedicationReminders = useMemo(
    () =>
      remindersAll
        .filter((reminder) => isMedicationReminder(reminder))
        .filter((reminder) => ['pending', 'scheduled', 'due'].some((status) => getReminderStatus(reminder).includes(status)))
        .filter((reminder) => {
          const due = getReminderDueDate(reminder);
          return due ? startOfDay(due).getTime() === startOfDay(new Date()).getTime() : true;
        })
        .slice()
        .sort((a, b) => {
          const aTime = getReminderDueDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const bTime = getReminderDueDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          return aTime - bTime;
        }),
    [remindersAll],
  );

  const weeklyMedicationOrganizer = useMemo(() => {
    const buckets = new Map<string, Reminder[]>();

    remindersAll
      .filter((reminder) => isMedicationReminder(reminder))
      .filter((reminder) => ['pending', 'scheduled', 'due'].some((status) => getReminderStatus(reminder).includes(status)))
      .forEach((reminder) => {
        const bucket = getWeekBucket(getReminderDueDate(reminder));
        if (!buckets.has(bucket)) buckets.set(bucket, []);
        buckets.get(bucket)!.push(reminder);
      });

    const order = ['Overdue', 'Today', 'Tomorrow', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Later', 'Unscheduled'];

    return Array.from(buckets.entries())
      .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
      .map(([label, items]) => ({
        label,
        items: items
          .slice()
          .sort((a, b) => {
            const aTime = getReminderDueDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
            const bTime = getReminderDueDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
            return aTime - bTime;
          })
          .slice(0, 4),
      }));
  }, [remindersAll]);

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
      started: safeIsoDate(form.started),
      lastFilled: safeIsoDate(form.lastFilled),
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

      if (!res.ok) {
        throw new Error('Could not save medication');
      }

      const data = await res.json().catch(() => null);
      const createdSource =
        data && typeof data === 'object'
          ? (data as any).med ?? (data as any).item ?? data
          : null;

      toast('Medication added', { type: 'success' });
      const normalizedCreated = normalizeMedication(
        createdSource && typeof createdSource === 'object'
          ? { ...payload, ...createdSource }
          : createdSource,
        meds.length,
      );

      if (normalizedCreated) {
        setMeds((prev) => [...prev, normalizedCreated]);
      } else {
        const refreshed = await fetch('/api/medications', { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
        const refreshedList = Array.isArray(refreshed) ? refreshed : Array.isArray(refreshed?.items) ? refreshed.items : [];
        setMeds(refreshedList.map(normalizeMedication).filter(Boolean) as Medication[]);
      }
      setIsCreateOpen(false);
    } catch (err) {
      console.error('Error creating medication:', err);
      toast('Could not save medication. Please try again.', { type: 'error' });
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

      try {
        const res = await fetch('/api/medications', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json().catch(() => null);
          const createdSource =
            data && typeof data === 'object'
              ? (data as any).med ?? (data as any).item ?? data
              : null;
          const normalizedCreated = normalizeMedication(
            createdSource && typeof createdSource === 'object'
              ? { ...payload, ...createdSource }
              : createdSource,
            createdMeds.length,
          );

          if (normalizedCreated) {
            createdMeds.push(normalizedCreated);
          }
        } else {
          hadError = true;
        }
      } catch (err) {
        console.error('Error creating medication from eRx:', err);
        hadError = true;
      }
    }

    if (hadError) {
      toast('Some prescriptions could not be synced. Please try again.', { type: 'error' });
    } else {
      if (createdMeds.length > 0) {
        setMeds((prev) => [...createdMeds, ...prev]);
      } else {
        const refreshed = await fetch('/api/medications', { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
        const refreshedList = Array.isArray(refreshed) ? refreshed : Array.isArray(refreshed?.items) ? refreshed.items : [];
        setMeds(refreshedList.map(normalizeMedication).filter(Boolean) as Medication[]);
      }
      setIsCreateOpen(false);
      toast('Medications added from eRx', { type: 'success' });
    }

    setIsSubmitting(false);
  }

  /* ------------------------------
     Inline edit
  --------------------------------*/
  function startEditing(m: Medication) {
    if (m.source === 'erx') {
      toast('This medication was synced from your clinician. To change the prescription, please discuss it with them.', { type: 'info' });
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
      started: safeIsoDate((editDraft.started as string) ?? original.started),
      lastFilled: safeIsoDate((editDraft.lastFilled as string) ?? original.lastFilled),
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
      setMeds((prev) => prev.map((m) => (m.id === editingId ? original : m)));
      toast('Could not save changes. Please try again.', { type: 'error' });
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
      setMeds((prev) => prev.map((x) => (x.id === m.id ? m : x)));
      toast('Could not save change. Please try again.', { type: 'error' });
    }
  }

  /* ------------------------------
     Reminder creation
  --------------------------------*/
  function openReminderFor(m: Medication) {
    setReminderMed(m);
    setRequireCameraVerification(reminderVerificationDefault(m));
    setAllowManualEarlierTaken(reminderManualEarlierDefault(m));

    const plan = inferReminderSchedulesForMedication(m);
    setReminderFreqPerDay(plan.freqPerDay);
    setReminderSchedules(plan.schedules);
  }

  function closeReminder(force = false) {
    if (reminderBusy && !force) return;
    setReminderMed(null);
    setReminderSchedules([]);
    setReminderFreqPerDay(undefined);
  }

  function updateSchedule(id: string, time: string) {
    setReminderSchedules((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              time,
              scheduledFor: nextOccurrenceForTime(time).toISOString(),
            }
          : s,
      ),
    );
  }

  function toggleSchedule(id: string) {
    setReminderSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  }

  function addSchedule() {
    setReminderSchedules((prev) => [
      ...prev,
      {
        id: `sch-${Date.now()}`,
        time: '08:00',
        scheduledFor: nextOccurrenceForTime('08:00').toISOString(),
        enabled: true,
        label: `Dose ${prev.length + 1}`,
      },
    ]);
  }

  function removeSchedule(id: string) {
    setReminderSchedules((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleCreateReminder(e: FormEvent) {
    e.preventDefault();
    if (!reminderMed) return;

    if (!reminderMed.id || reminderMed.id.startsWith('temp-')) {
      toast('Save this medication first before creating reminders.', { type: 'error' });
      return;
    }

    const active = reminderSchedules.filter((s) => s.enabled && s.time);
    if (active.length === 0) {
      toast('Add at least one time for this reminder.', { type: 'error' });
      return;
    }

    const plan = inferReminderSchedulesForMedication(reminderMed);
    const medicationSource = medicationIsErx(reminderMed) ? 'erx' : 'manual';
    const fulfilment = inferCarePortFulfilment(reminderMed);

    setReminderBusy(true);
    try {
      const items = active.map((s, index) => {
        const scheduledFor = s.scheduledFor || nextOccurrenceForTime(s.time).toISOString();

        return {
          name: reminderMed.name,
          title: reminderMed.name,
          dose: reminderMed.dose || null,
          time: s.time,
          dueAt: scheduledFor,
          scheduledFor,
          status: 'Pending',
          source: 'medication',
          type: 'pill',
          category: 'medication',
          medicationId: reminderMed.id,
          orderId: reminderMed.orderId ?? null,
          verificationRequired: requireCameraVerification,
          verificationMode: requireCameraVerification ? 'CAMERA_SEQUENCE' : 'NONE',
          verificationStatus: requireCameraVerification ? 'PENDING' : 'NOT_REQUIRED',
          takenSource: 'NONE',
          durationDays: reminderMed.durationDays ?? null,
          frequencyPerDay: active.length,
          meta: {
            medicationSource,
            prescriptionSource: reminderMed.source ?? null,
            orderId: reminderMed.orderId ?? null,
            erxId: reminderMed.meta?.erxId ?? reminderMed.meta?.rxId ?? null,
            encounterId: reminderMed.meta?.encounterId ?? null,
            sig: reminderMed.frequency || null,
            route: reminderMed.route || null,
            durationDays: reminderMed.durationDays ?? null,
            frequencyPerDay: active.length,
            inferredFrequencyPerDay: plan.freqPerDay,
            intervalHours: plan.intervalHours,
            doseSlotLabel: s.label ?? `Dose ${index + 1}`,
            firstDoseAt: plan.firstDoseIso,
            activationContext: fulfilment.kind,
            activationNote: fulfilment.label,
            fulfilmentEventAt: fulfilment.eventAt?.toISOString?.() ?? null,
            verificationRequired: requireCameraVerification,
            verificationMode: requireCameraVerification ? 'CAMERA_SEQUENCE' : 'NONE',
            manualEarlierLoggingAllowed: allowManualEarlierTaken,
            generatedBy: 'patient_medications_reminder_scheduler',
          },
        };
      });

      const result = await createMedicationReminders(items);

      if (!result.ok) {
        console.error('Reminder create failed', result);
        const message =
          result.data?.message ||
          result.data?.error ||
          `Could not create reminder. Reminder service returned ${result.status || 'no response'}.`;
        toast(message, { type: 'error' });
        return;
      }

      toast('Reminder(s) created', { type: 'success' });
      void ensureMedicationReminderPushEnabled();
      setReminderBusy(false);
      closeReminder(true);
      await reloadReminders();
    } catch (err) {
      console.error('Error creating reminder:', err);
      toast('Network error creating reminder', { type: 'error' });
    } finally {
      setReminderBusy(false);
    }
  }


  function openTakeMedication() {
    const first = nextDueMedicationReminders[0] ?? null;
    setTakeSelectedReminderId(first?.id ?? '');
    setTakeUseCameraVerification(first ? reminderRequiresCamera(first) : false);
    setTakeEarlierMode(false);
    setTakeEarlierTime(formatHHMM(new Date()));
    setTakeModalOpen(true);
  }

  function closeTakeMedication(force = false) {
    if (takeBusy && !force) return;
    setTakeModalOpen(false);
    setTakeSelectedReminderId('');
    setTakeUseCameraVerification(false);
    setTakeEarlierMode(false);
  }

  async function startReminderCameraVerification(reminder: Reminder) {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        stream.getTracks().forEach((track) => track.stop());
      } catch (err) {
        throw new Error('Camera permission was not granted. Please allow camera access and try again.');
      }
    }

    const res = await fetch('/api/medication-verifications/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reminderId: reminder.id,
        medicationId: reminder.medicationId ?? null,
        requiredMode: 'CAMERA_SEQUENCE',
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok || !data?.sessionId) {
      throw new Error(data?.error || data?.message || 'Could not start camera verification.');
    }

    window.location.href = `/reminder/verify?reminderId=${encodeURIComponent(reminder.id)}&sessionId=${encodeURIComponent(data.sessionId)}&returnTo=${encodeURIComponent('/medications')}`;
  }

  async function confirmReminderTaken(reminder: Reminder) {
    const takenAt = takeEarlierMode ? timeToIsoToday(takeEarlierTime) : new Date().toISOString();
    const payload = {
      action: 'confirm',
      ids: [reminder.id],
      id: reminder.id,
      takenAt,
      takenSource: 'SELF_REPORTED',
      verificationStatus: 'SELF_REPORTED',
      reason: takeEarlierMode ? 'already_taken_earlier' : 'manual_confirmation',
    };

    const result = await postJsonWithResult('/api/reminders', 'POST', payload);

    if (!result.ok) {
      throw new Error(result.data?.error || result.data?.message || 'Could not record this dose.');
    }

    setRemindersAll((prev) =>
      prev.map((item) =>
        item.id === reminder.id
          ? {
              ...item,
              status: 'Taken',
              takenAt,
              reportedTakenAt: takenAt,
              takenSource: 'SELF_REPORTED',
              verificationStatus: 'SELF_REPORTED',
            }
          : item,
      ),
    );
  }

  async function handleTakeMedication() {
    if (!selectedTakeReminder) {
      toast('Choose a medication reminder first.', { type: 'error' });
      return;
    }

    setTakeBusy(true);
    try {
      if (takeUseCameraVerification) {
        await startReminderCameraVerification(selectedTakeReminder);
        return;
      }

      await confirmReminderTaken(selectedTakeReminder);
      toast('Dose recorded', { type: 'success' });
      closeTakeMedication(true);
      await reloadReminders();
    } catch (err: any) {
      console.error('Take medication failed', err);
      toast(err?.message || 'Could not record this dose.', { type: 'error' });
    } finally {
      setTakeBusy(false);
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
    <main data-p-ui="patient-medications-page" className="min-w-0 overflow-x-clip max-w-6xl mx-auto p-5 sm:p-6 space-y-6">
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
                onClick={openTakeMedication}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                title="Record a medication dose due now"
              >
                <Icon name="pill" />
                Take medication
              </Button>

              <Button
                onClick={openSyncLatestErx}
                className="bg-slate-900 text-white hover:bg-slate-800"
                title="Sync prescriptions from your latest eRx encounter"
              >
                <Icon name="sync" />
                Sync latest eRx
              </Button>

              <Link
                href="/medications/new"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-50"
                title="Add OTC, external eRx, upload an eRx document, or sync from Ambulant+ eRx"
              >
                <Icon name="plus" />
                Add Medication
              </Link>

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

            <div className="rounded-full border border-slate-200 bg-white/75 px-3 py-1.5 text-xs font-medium text-slate-500">
              Tip: create reminders for active daily medications so adherence reflects real dosing activity.
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
                      Weighted to distinguish verified doses from self-reported doses. Pending reminders are treated as “not done yet.”
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
                    <div className="text-xs text-slate-500 mb-2">Weighted adherence</div>
                    <MeterDonut value={adherence.weightedPct} max={100} />
                    <div className="mt-2 text-[11px] text-slate-500 text-center">
                      {adherence.hasAnyTracking ? (
                        <>
                          <span className="font-semibold text-slate-700">{adherence.verifiedTaken}</span> verified ·{' '}
                          <span className="font-semibold text-slate-700">{adherence.selfReportedTaken}</span> self-reported
                        </>
                      ) : (
                        'No reminder tracking yet — create reminders for daily meds.'
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500 text-center">
                      Confidence: <span className="font-semibold text-slate-700">{adherence.confidencePct}%</span>
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
                          adherence.weightedPct >= 90
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : adherence.weightedPct >= 75
                            ? 'border-sky-200 bg-sky-50 text-sky-800'
                            : 'border-amber-200 bg-amber-50 text-amber-900'
                        )}
                      >
                        {adherence.weightedPct >= 90 ? <Icon name="check" /> : <Icon name="warn" />}
                        {adherence.weightedPct}% today
                      </Chip>
                    </div>

                    <div className="mt-3">
                      <AdherenceSparkline values={adherenceSeries} height={72} />
                    </div>

                    <div className="mt-3">
                      <div className="text-xs font-semibold text-slate-700">Progress (active meds)</div>
                      <div className="mt-2">
                        <ProgressBar
                          segments={[
                            { label: 'Verified', value: adherence.verifiedTaken, className: 'bg-emerald-500' },
                            { label: 'Self-reported', value: adherence.selfReportedTaken, className: 'bg-amber-400' },
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
                  <Button onClick={openTakeMedication} className="bg-emerald-600 text-white hover:bg-emerald-700">
                    <Icon name="pill" />
                    Take medication
                  </Button>

                  <GhostButton onClick={() => setActiveTab('list')}>
                    Review list
                  </GhostButton>

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
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    onClick={openTakeMedication}
                    className="bg-emerald-600 px-3 py-2 text-xs text-white hover:bg-emerald-700"
                  >
                    <Icon name="pill" />
                    Take due pill
                  </Button>
                  <GhostButton onClick={() => setTodaysPillsDrawerOpen(true)} className="text-xs">
                    View today’s pills
                  </GhostButton>
                </div>
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

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-900">This week</div>
                    <div className="mt-1 text-xs text-slate-500">Upcoming medication reminders grouped by day.</div>
                  </div>
                  <GhostButton onClick={() => setTodaysPillsDrawerOpen(true)} className="text-xs">Open drawer</GhostButton>
                </div>

                {weeklyMedicationOrganizer.length === 0 ? (
                  <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                    No medication reminders are scheduled yet.
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {weeklyMedicationOrganizer.slice(0, 4).map((group) => (
                      <div key={group.label}>
                        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{group.label}</div>
                        <div className="mt-1 space-y-1.5">
                          {group.items.map((reminder) => (
                            <button
                              key={reminder.id}
                              type="button"
                              onClick={() => {
                                setTakeSelectedReminderId(reminder.id);
                                setTakeUseCameraVerification(reminderRequiresCamera(reminder));
                                setTakeEarlierMode(false);
                                setTakeModalOpen(true);
                              }}
                              className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-left text-xs hover:bg-white"
                            >
                              <span className="min-w-0 truncate font-semibold text-slate-800">{getReminderDisplayName(reminder)}</span>
                              <span className="shrink-0 text-slate-500">{formatDueLabel(reminder)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                <Link
                  href="/medications/new"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  <Icon name="plus" />
                  Add Medication
                </Link>
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
                                Started {safeFormatDate(m.started)}
                                {m.lastFilled ? ` · Filled ${safeFormatDate(m.lastFilled)}` : ''}
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
                                        { label: 'Verified', value: a.verifiedTaken, className: 'bg-emerald-500' },
                                        { label: 'Self-reported', value: a.selfReportedTaken, className: 'bg-amber-400' },
                                        { label: 'Missed', value: a.missed, className: 'bg-rose-500' },
                                        { label: 'Pending', value: a.pending, className: 'bg-sky-500' },
                                      ]}
                                      emptyLabel="No reminders for this medication yet."
                                    />
                                  </div>
                                  <div className="mt-2 text-[11px] text-slate-500">
                                    Weighted {a.weightedPct}% · Confidence {a.confidencePct}%
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
                                    value={(draft.started as string) ?? safeDateInputValue(m.started)}
                                    onChange={(e) => updateEdit('started', e.target.value)}
                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-slate-600">Last filled</label>
                                  <input
                                    type="date"
                                    value={(draft.lastFilled as string) ?? safeDateInputValue(m.lastFilled)}
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
                                          a.weightedPct >= 90
                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                            : a.weightedPct >= 75
                                            ? 'border-sky-200 bg-sky-50 text-sky-800'
                                            : 'border-amber-200 bg-amber-50 text-amber-900'
                                        )}
                                      >
                                        {a.weightedPct >= 90 ? <Icon name="check" /> : <Icon name="warn" />}
                                        {a.weightedPct}%
                                      </Chip>
                                      <span className="text-[11px] text-slate-500">
                                        {a.verifiedTaken} verified · {a.selfReportedTaken} self-reported
                                      </span>
                                    </div>
                                    <div className="h-2 w-44 overflow-hidden rounded-full border border-slate-200 bg-slate-50 flex">
                                      <div className="bg-emerald-500 h-full" style={{ width: `${(a.verifiedTaken / Math.max(1, a.total)) * 100}%` }} />
                                      <div className="bg-amber-400 h-full" style={{ width: `${(a.selfReportedTaken / Math.max(1, a.total)) * 100}%` }} />
                                      <div className="bg-rose-500 h-full" style={{ width: `${(a.missed / Math.max(1, a.total)) * 100}%` }} />
                                      <div className="bg-sky-500 h-full" style={{ width: `${(a.pending / Math.max(1, a.total)) * 100}%` }} />
                                    </div>
                                    <div className="text-[11px] text-slate-500">Confidence {a.confidencePct}%</div>
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
                                    value={(draft.started as string) ?? safeDateInputValue(m.started)}
                                    onChange={(e) => updateEdit('started', e.target.value)}
                                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                  />
                                ) : (
                                  safeFormatDate(m.started)
                                )}
                              </td>

                              {/* Last Filled */}
                              <td className="py-3 pr-4 whitespace-nowrap text-slate-700">
                                {isEditing ? (
                                  <input
                                    type="date"
                                    value={(draft.lastFilled as string) ?? safeDateInputValue(m.lastFilled)}
                                    onChange={(e) => updateEdit('lastFilled', e.target.value)}
                                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                  />
                                ) : (
                                  safeFormatDate(m.lastFilled)
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
                        Started {safeFormatDate(m.started)}
                        {m.lastFilled ? ` · Last filled ${safeFormatDate(m.lastFilled)}` : ''}
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

      {/* TAKE MEDICATION MODAL */}
      <Modal
        open={todaysPillsDrawerOpen}
        onClose={() => setTodaysPillsDrawerOpen(false)}
        title="Today’s pills"
        subtitle="Due medication reminders for today, with quick access to logging and verification."
        maxW="2xl"
      >
        <div className="space-y-4">
          {todaysMedicationReminders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
              No medication reminders are due today. Add reminders from an active medication to start adherence tracking.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {todaysMedicationReminders.map((reminder) => {
                const requiresCamera = reminderRequiresCamera(reminder);
                return (
                  <button
                    key={reminder.id}
                    type="button"
                    onClick={() => {
                      setTakeSelectedReminderId(reminder.id);
                      setTakeUseCameraVerification(requiresCamera);
                      setTakeEarlierMode(false);
                      setTodaysPillsDrawerOpen(false);
                      setTakeModalOpen(true);
                    }}
                    className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-slate-950">{getReminderDisplayName(reminder)}</div>
                        <div className="mt-1 text-xs text-slate-600">
                          {[getReminderDose(reminder), formatDueLabel(reminder)].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      {requiresCamera ? (
                        <Chip className="border-indigo-200 bg-indigo-50 text-indigo-800">
                          <Icon name="camera" />
                          Verify
                        </Chip>
                      ) : (
                        <Chip className="border-slate-200 bg-slate-50 text-slate-700">Self log</Chip>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={takeModalOpen}
        onClose={closeTakeMedication}
        title="Take medication"
        subtitle="Record a due dose, or start camera verification when required."
        maxW="md"
      >
        <div className="space-y-4">
          {nextDueMedicationReminders.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <div className="font-bold text-slate-900">No due medication reminders found</div>
              <p className="mt-1">Create reminders from an active medication, or add a medication first.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/medications/new"
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <Icon name="plus" />
                  Add medication
                </Link>
                <GhostButton onClick={() => { closeTakeMedication(true); setActiveTab('list'); }}>
                  Review medication list
                </GhostButton>
              </div>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void handleTakeMedication();
              }}
            >
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-800">Choose due medication</label>
                <div className="space-y-2">
                  {nextDueMedicationReminders.map((reminder) => {
                    const selected = reminder.id === takeSelectedReminderId;
                    const dose = getReminderDose(reminder);
                    const requiresCamera = reminderRequiresCamera(reminder);

                    return (
                      <button
                        key={reminder.id}
                        type="button"
                        onClick={() => {
                          setTakeSelectedReminderId(reminder.id);
                          setTakeUseCameraVerification(requiresCamera);
                        }}
                        className={cx(
                          'w-full rounded-2xl border px-4 py-3 text-left transition',
                          selected
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900">{getReminderDisplayName(reminder)}</div>
                            <div className="mt-1 text-xs text-slate-600">
                              {[dose, formatDueLabel(reminder)].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                          {requiresCamera ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-800">
                              <Icon name="camera" className="h-3.5 w-3.5" />
                              camera
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <label className="flex items-start gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={takeUseCameraVerification}
                    onChange={(event) => setTakeUseCameraVerification(event.target.checked)}
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <span className="block font-bold text-slate-900">Use camera verification</span>
                    <span className="block text-xs leading-5 text-slate-600">
                      eRx reminders inherit camera verification by default. You can override it for legitimate non-camera logging.
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={takeEarlierMode}
                    onChange={(event) => setTakeEarlierMode(event.target.checked)}
                    className="mt-1 h-4 w-4"
                    disabled={takeUseCameraVerification}
                  />
                  <span className="min-w-0">
                    <span className="block font-bold text-slate-900">I already took this earlier today</span>
                    <span className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                      Time
                      <input
                        type="time"
                        value={takeEarlierTime}
                        onChange={(event) => setTakeEarlierTime(event.target.value)}
                        disabled={!takeEarlierMode || takeUseCameraVerification}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs disabled:opacity-60"
                      />
                    </span>
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <GhostButton onClick={closeTakeMedication} disabled={takeBusy}>
                  Cancel
                </GhostButton>
                <Button type="submit" disabled={takeBusy || !selectedTakeReminder} className="bg-emerald-600 text-white hover:bg-emerald-700">
                  {takeBusy ? 'Opening…' : takeUseCameraVerification ? 'Start camera verification' : 'Record dose'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      <Modal open={isCreateOpen} onClose={closeCreate} title="Sync latest eRx" subtitle="Pull prescribed medications from an Ambulant+ eRx encounter. Use Add Medication for manual, OTC, or external eRx document intake." maxW="2xl">
        <form onSubmit={handleCreate} className="space-y-4">
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
                    value={form.started ?? ''}
                    onChange={(e) => handleFormChange('started', e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Last Filled</label>
                  <input
                    type="date"
                    value={form.lastFilled ?? ''}
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
                  <div className="px-4 py-6 text-sm text-slate-600">No prescriptions found for this encounter.</div>
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

            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div>
                <div className="text-sm font-extrabold text-slate-900">Verification policy</div>
                <div className="mt-1 text-xs text-slate-500">
                  Decide whether this medication should require camera verification before it counts as a verified dose.
                </div>
              </div>

              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={requireCameraVerification}
                  onChange={(e) => setRequireCameraVerification(e.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  <span className="font-semibold text-slate-900">Require camera verification</span>
                  <span className="block text-xs text-slate-500">
                    When enabled, reminders start in a verification-pending state and should flow through camera sequence verification.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={allowManualEarlierTaken}
                  onChange={(e) => setAllowManualEarlierTaken(e.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  <span className="font-semibold text-slate-900">Allow manual “taken earlier” logging</span>
                  <span className="block text-xs text-slate-500">
                    Keeps support for self-reported earlier logging when policy allows it.
                  </span>
                </span>
              </label>
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