// apps/patient-app/app/clinicians/[id]/calendar/page.tsx
'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import RefundPolicyPanel from '@/components/RefundPolicyPanel';

type SlotStatus = 'available' | 'limited' | 'blocked' | 'booked' | 'past';
type ConsultType = 'standard' | 'followup';
type DayPhase = 'overnight' | 'morning' | 'afternoon' | 'evening' | 'night';

const DAY_PHASES: DayPhase[] = ['overnight', 'morning', 'afternoon', 'evening', 'night'];

type Slot = {
  start: string;
  end?: string;
  localStart?: string | null;
  localEnd?: string | null;
  localDate?: string | null;
  localStartTime?: string | null;
  localEndTime?: string | null;
  localTimeLabel?: string | null;
  timezone?: string | null;
  status?: SlotStatus;
  reason?: string;
  consultType?: ConsultType;
  feeCents?: number;
  currency?: string;
  durationMin?: number;
  bufferMin?: number;
};

type NormalizedSlot = {
  start: string;
  end: string;
  localStart?: string;
  localEnd?: string;
  localDate?: string;
  localStartTime?: string;
  localEndTime?: string;
  localTimeLabel?: string;
  timezone?: string;
  status: SlotStatus;
  reason?: string;
  consultType: ConsultType;
  feeCents: number;
  currency: string;
  durationMin: number;
  bufferMin: number;
};

type RefundPolicy = {
  within24hPercent: number;
  noShowPercent: number;
  clinicianMissPercent: number;
  networkProrate: boolean;
};

type FeeProfile = {
  priceCents: number;
  currency: string;
  durationMin: number;
  bufferMin: number;
};

type BookingProfile = {
  clinician: {
    id: string;
    name: string;
    specialty?: string;
    timezone?: string;
    rating?: number;
    ratingCount?: number;
    acceptsMedicalAid?: boolean;
    operational?: {
      canBeListed?: boolean;
      canBeBooked?: boolean;
      canPrescribe?: boolean;
      prescribingMode?: 'no' | 'conditional' | 'yes';
      allowedWorkspaces?: string[];
      patientCategory?: 'clinical' | 'wellness' | null;
      blockers?: string[];
      riskFlags?: string[];
      ambulantId?: string | null;
    };
  };
  fees: {
    standard: FeeProfile;
    followUp: FeeProfile;
  };
  refundPolicy: RefundPolicy;
  rules?: {
    followUpRequiresOpenCase?: boolean;
    followUpFromCaseContextOnly?: boolean;
  };
};

type AppointmentWarning = {
  code: string;
  severity: 'info' | 'warning' | 'blocking';
  title: string;
  message: string;
  requiresAck: boolean;
};

type AppointmentConflict = {
  code?: string;
  reason?: string | null;
  appointmentId?: string;
  startsAt?: string;
  endsAt?: string;
};

type AppointmentPreflight = {
  ok?: boolean;
  canProceed?: boolean;
  error?: string;
  decisionToken?: string;
  expiresAt?: string;
  warnings?: AppointmentWarning[];
  conflicts?: {
    details?: AppointmentConflict[];
    clinicianOverlap?: boolean;
    patientOverlap?: boolean;
    roomOverlap?: boolean;
    scheduleBlocked?: boolean;
  };
  priceLock?: {
    token?: string;
    amountMinor?: number;
    currency?: string;
    expiresInSeconds?: number;
  };
};

type Toast = { id: string; text: string; tone?: 'info' | 'success' | 'error' };

function cx(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(' ');
}

function getUid() {
  if (typeof window === 'undefined') return 'server-user';
  const key = 'ambulant_uid';
  let v = localStorage.getItem(key);
  if (!v) {
    v = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + '-u';
    localStorage.setItem(key, v);
  }
  return v;
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function push(text: string, tone: Toast['tone'] = 'info', ttl = 5000) {
    const id = String(Date.now()) + Math.random().toString(36).slice(2, 6);
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ttl);
  }

  function remove(id: string) {
    setToasts((t) => t.filter((x) => x.id !== id));
  }

  const Toasts = () => (
    <div className="fixed bottom-4 right-4 z-[1200]" aria-live="polite">
      <div className="flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'max-w-sm rounded-2xl border px-3 py-2 text-sm shadow-lg backdrop-blur',
              t.tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-900',
              t.tone === 'error' && 'border-rose-200 bg-rose-50 text-rose-900',
              (!t.tone || t.tone === 'info') && 'border-slate-200 bg-white text-slate-800',
            )}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">{t.text}</div>
              <button onClick={() => remove(t.id)} className="text-xs text-slate-500">
                x
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return { push, Toasts };
}

function formatMoney(cents: number, currency: string) {
  const v = Number(cents ?? 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(v);
  } catch {
    const amount = v.toFixed(2);
    return currency === 'ZAR' ? `R ${amount}` : `${currency} ${amount}`;
  }
}


function safeNum(v: any): number | undefined {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function localApiUrl(path: string) {
  return path;
}

async function readJsonSafe(r: Response) {
  return r.json().catch(() => null);
}

function normalizePreflightPayload(
  value: any,
  retainedPriceLock?: AppointmentPreflight['priceLock'],
): AppointmentPreflight | null {
  if (!value || typeof value !== 'object') return null;

  const source = value.preflight && typeof value.preflight === 'object' ? value.preflight : value;
  const warnings = Array.isArray(source.warnings)
    ? source.warnings
        .map((warning: any) => ({
          code: String(warning?.code || ''),
          severity: ['info', 'warning', 'blocking'].includes(String(warning?.severity))
            ? (String(warning.severity) as AppointmentWarning['severity'])
            : 'warning',
          title: String(warning?.title || 'Booking notice'),
          message: String(warning?.message || ''),
          requiresAck: Boolean(warning?.requiresAck),
        }))
        .filter((warning: AppointmentWarning) => warning.code || warning.message)
    : [];

  const conflictDetails = Array.isArray(source?.conflicts?.details) ? source.conflicts.details : [];
  const priceLock = value.priceLock || source.priceLock || retainedPriceLock;

  return {
    ...source,
    warnings,
    conflicts: {
      ...(source.conflicts || {}),
      details: conflictDetails,
    },
    priceLock,
  };
}

function normalizeFeeProfile(p: Partial<FeeProfile> | null | undefined, fallback: FeeProfile): FeeProfile {
  const priceCents = Number.isFinite(Number(p?.priceCents)) ? Number(p!.priceCents) : fallback.priceCents;
  const durationMin = Number.isFinite(Number(p?.durationMin)) ? Number(p!.durationMin) : fallback.durationMin;
  const bufferMin = Number.isFinite(Number(p?.bufferMin)) ? Number(p!.bufferMin) : fallback.bufferMin;
  const currency = String(p?.currency || fallback.currency || 'ZAR').toUpperCase();

  return { priceCents, durationMin, bufferMin, currency };
}

function normalizeBookingProfile(p: any, fallback: BookingProfile): BookingProfile {
  const clinician = {
    id: String(p?.clinician?.id || fallback.clinician.id),
    name: String(p?.clinician?.name || fallback.clinician.name),
    specialty: p?.clinician?.specialty ?? fallback.clinician.specialty,
    timezone: p?.clinician?.timezone ?? fallback.clinician.timezone,
    rating:
      safeNum(p?.clinician?.rating) ??
      safeNum(p?.clinician?.ratingAvg) ??
      safeNum(p?.clinician?.ratingAverage) ??
      fallback.clinician.rating,
    ratingCount:
      safeNum(p?.clinician?.ratingCount) ??
      safeNum(p?.clinician?.ratingsCount) ??
      safeNum(p?.clinician?.reviewCount) ??
      safeNum(p?.clinician?.totalRatings) ??
      fallback.clinician.ratingCount,
    acceptsMedicalAid:
      typeof p?.clinician?.acceptsMedicalAid === 'boolean'
        ? p.clinician.acceptsMedicalAid
        : fallback.clinician.acceptsMedicalAid,
    operational:
      p?.clinician?.operational && typeof p.clinician.operational === 'object'
        ? {
            canBeListed: p.clinician.operational.canBeListed,
            canBeBooked: p.clinician.operational.canBeBooked,
            canPrescribe: p.clinician.operational.canPrescribe,
            prescribingMode: p.clinician.operational.prescribingMode ?? 'no',
            allowedWorkspaces: Array.isArray(p.clinician.operational.allowedWorkspaces)
              ? p.clinician.operational.allowedWorkspaces.map(String)
              : [],
            patientCategory: p.clinician.operational.patientCategory ?? null,
            blockers: Array.isArray(p.clinician.operational.blockers)
              ? p.clinician.operational.blockers.map(String)
              : [],
            riskFlags: Array.isArray(p.clinician.operational.riskFlags)
              ? p.clinician.operational.riskFlags.map(String)
              : [],
            ambulantId: p.clinician.operational.ambulantId ?? null,
          }
        : fallback.clinician.operational,
  };

  const fees = {
    standard: normalizeFeeProfile(p?.fees?.standard, fallback.fees.standard),
    followUp: normalizeFeeProfile(p?.fees?.followUp, fallback.fees.followUp),
  };

  const refundPolicy: RefundPolicy = {
    within24hPercent: Number.isFinite(Number(p?.refundPolicy?.within24hPercent))
      ? Number(p.refundPolicy.within24hPercent)
      : fallback.refundPolicy.within24hPercent,
    noShowPercent: Number.isFinite(Number(p?.refundPolicy?.noShowPercent))
      ? Number(p.refundPolicy.noShowPercent)
      : fallback.refundPolicy.noShowPercent,
    clinicianMissPercent: Number.isFinite(Number(p?.refundPolicy?.clinicianMissPercent))
      ? Number(p.refundPolicy.clinicianMissPercent)
      : fallback.refundPolicy.clinicianMissPercent,
    networkProrate:
      typeof p?.refundPolicy?.networkProrate === 'boolean'
        ? Boolean(p.refundPolicy.networkProrate)
        : fallback.refundPolicy.networkProrate,
  };

  const rules = {
    followUpRequiresOpenCase:
      typeof p?.rules?.followUpRequiresOpenCase === 'boolean'
        ? Boolean(p.rules.followUpRequiresOpenCase)
        : fallback.rules?.followUpRequiresOpenCase,
    followUpFromCaseContextOnly:
      typeof p?.rules?.followUpFromCaseContextOnly === 'boolean'
        ? Boolean(p.rules.followUpFromCaseContextOnly)
        : fallback.rules?.followUpFromCaseContextOnly,
  };

  return { clinician, fees, refundPolicy, rules };
}

function normalizeSlot(
  raw: Slot,
  consultType: ConsultType,
): NormalizedSlot | null {
  const start = String(raw?.start || '').trim();
  const end = String(raw?.end || '').trim();
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  const durationMin = Number(raw?.durationMin);
  const bufferMin = Number(raw?.bufferMin);
  const feeCents = Number(raw?.feeCents);
  const currency = String(raw?.currency || '').trim().toUpperCase();

  if (
    !start ||
    !end ||
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    endMs <= startMs ||
    !Number.isFinite(durationMin) ||
    durationMin <= 0 ||
    !Number.isFinite(bufferMin) ||
    bufferMin < 0 ||
    !Number.isFinite(feeCents) ||
    feeCents < 0 ||
    !/^[A-Z]{3}$/.test(currency)
  ) {
    return null;
  }

  const allowed: SlotStatus[] = [
    'available',
    'limited',
    'blocked',
    'booked',
    'past',
  ];
  const rawStatus =
    String(raw?.status || '').toLowerCase() as SlotStatus;
  const status =
    allowed.includes(rawStatus) ? rawStatus : 'available';

  const localStart =
    raw.localStart ? String(raw.localStart) : undefined;
  const localEnd =
    raw.localEnd ? String(raw.localEnd) : undefined;
  const localDate =
    raw.localDate ? String(raw.localDate) : undefined;
  const localStartTime =
    raw.localStartTime ? String(raw.localStartTime) : undefined;
  const localEndTime =
    raw.localEndTime ? String(raw.localEndTime) : undefined;
  const localTimeLabel =
    raw.localTimeLabel ? String(raw.localTimeLabel) : undefined;
  const timezone =
    raw.timezone ? String(raw.timezone) : undefined;

  return {
    start,
    end,
    localStart,
    localEnd,
    localDate,
    localStartTime,
    localEndTime,
    localTimeLabel,
    timezone,
    status,
    reason: raw.reason ? String(raw.reason) : undefined,
    consultType:
      raw.consultType === 'followup' ? 'followup' : consultType,
    feeCents,
    currency,
    durationMin,
    bufferMin,
  };
}

function phaseOfSlot(slot: NormalizedSlot): DayPhase {
  const localHourRaw = String(slot.localStartTime || slot.localStart?.slice(11, 16) || '').slice(0, 2);
  const h = /^\d{2}$/.test(localHourRaw) ? Number(localHourRaw) : new Date(slot.start).getHours();

  if (h < 5) return 'overnight';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
}

function phaseLabel(phase: DayPhase) {
  if (phase === 'overnight') return 'Overnight';
  if (phase === 'morning') return 'Morning';
  if (phase === 'afternoon') return 'Afternoon';
  if (phase === 'evening') return 'Evening';
  return 'Night';
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateFromLocalDate(localDate?: string) {
  if (!localDate) return null;
  const [year, month, day] = localDate.split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return null;
  return new Date(year, month - 1, day);
}

function slotDayKey(slot: NormalizedSlot) {
  return slot.localDate || dayKey(slot.start);
}

function slotDayLabel(slot: NormalizedSlot) {
  const d = dateFromLocalDate(slot.localDate) || new Date(slot.start);
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(d);
}

function slotFullDayLabel(slot: NormalizedSlot) {
  const d = dateFromLocalDate(slot.localDate) || new Date(slot.start);
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(d);
}

function timeLabel(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function shortDateTime(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function localDateLabel(localDate?: string) {
  if (!localDate) return '';

  const [yRaw, mRaw, dRaw] = localDate.split('-').map(Number);
  if (!Number.isFinite(yRaw) || !Number.isFinite(mRaw) || !Number.isFinite(dRaw)) return '';

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(new Date(yRaw, (mRaw || 1) - 1, dRaw || 1));
}

function slotStartLabel(slot: NormalizedSlot) {
  return slot.localStartTime || timeLabel(slot.start);
}

function slotEndLabel(slot: NormalizedSlot) {
  return slot.localEndTime || timeLabel(slot.end);
}

function slotWindowLabel(slot: NormalizedSlot) {
  return slot.localTimeLabel || `${slotStartLabel(slot)} - ${slotEndLabel(slot)}`;
}

function slotDateTimeLabel(slot: NormalizedSlot) {
  const date = localDateLabel(slot.localDate);
  return date ? `${date}, ${slotStartLabel(slot)}` : shortDateTime(slot.start);
}

function slotEndDateTimeLabel(slot: NormalizedSlot) {
  const date = localDateLabel(slot.localDate);
  return date ? `${date}, ${slotEndLabel(slot)}` : shortDateTime(slot.end);
}

function isSelectableSlot(slot: NormalizedSlot, apiEnabled: boolean, canBeBooked: boolean) {
  return apiEnabled && canBeBooked && (slot.status === 'available' || slot.status === 'limited');
}

function statusLabel(status: SlotStatus) {
  if (status === 'available') return 'Available';
  if (status === 'limited') return 'Limited';
  if (status === 'blocked') return 'Blocked';
  if (status === 'booked') return 'Booked';
  return 'Past';
}

function statusExplanation(status: SlotStatus) {
  if (status === 'available') return 'Available to book.';
  if (status === 'limited') return 'Available, with an additional booking notice.';
  if (status === 'blocked') return 'Unavailable to book.';
  if (status === 'booked') return 'Already booked.';
  return 'This time has passed.';
}

function statusClasses(status: SlotStatus, selected: boolean) {
  const base =
    'w-full rounded-2xl border px-3 py-3 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-slate-900/10';
  const selectedCls = selected ? 'ring-2 ring-slate-900 ring-offset-1' : '';

  if (status === 'available') {
    return cx(
      base,
      selectedCls,
      'border-emerald-200 bg-emerald-50 text-emerald-950 hover:border-emerald-400 hover:bg-emerald-100',
    );
  }

  if (status === 'limited') {
    return cx(
      base,
      selectedCls,
      'border-amber-200 bg-amber-50 text-amber-950 hover:border-amber-400 hover:bg-amber-100',
    );
  }

  if (status === 'blocked') {
    return cx(base, selectedCls, 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500');
  }

  if (status === 'booked') {
    return cx(base, selectedCls, 'cursor-not-allowed border-rose-200 bg-rose-50 text-rose-800');
  }

  return cx(base, selectedCls, 'cursor-not-allowed border-slate-200 bg-white text-slate-400 opacity-75');
}

function groupSlots(slots: NormalizedSlot[]) {
  const phases = DAY_PHASES;
  const map = new Map<
    string,
    {
      key: string;
      label: string;
      fullLabel: string;
      slots: NormalizedSlot[];
      groups: Record<DayPhase, NormalizedSlot[]>;
      counts: Record<SlotStatus, number>;
    }
  >();

  for (const slot of slots) {
    const key = slotDayKey(slot);
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: slotDayLabel(slot),
        fullLabel: slotFullDayLabel(slot),
        slots: [],
        groups: { overnight: [], morning: [], afternoon: [], evening: [], night: [] },
        counts: { available: 0, limited: 0, blocked: 0, booked: 0, past: 0 },
      });
    }

    const day = map.get(key)!;
    day.slots.push(slot);
    day.groups[phaseOfSlot(slot)].push(slot);
    day.counts[slot.status] += 1;
  }

  const days = Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));

  for (const day of days) {
    day.slots.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    for (const phase of phases) {
      day.groups[phase].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    }
  }

  return days;
}

function bestNextSlot(slots: NormalizedSlot[], apiEnabled: boolean, canBeBooked: boolean) {
  return slots
    .filter((s) => isSelectableSlot(s, apiEnabled, canBeBooked))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0];
}

function mostOptionsWindow(slots: NormalizedSlot[], apiEnabled: boolean, canBeBooked: boolean) {
  const buckets = new Map<
    string,
    {
      label: string;
      first: string;
      selectable: number;
      limited: number;
      blocked: number;
      booked: number;
      past: number;
    }
  >();

  for (const slot of slots) {
    const phase = phaseOfSlot(slot);
    const key = `${slotDayKey(slot)}:${phase}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        label: `${slotDayLabel(slot)} - ${phaseLabel(phase)}`,
        first: slot.start,
        selectable: 0,
        limited: 0,
        blocked: 0,
        booked: 0,
        past: 0,
      });
    }

    const row = buckets.get(key)!;
    if (isSelectableSlot(slot, apiEnabled, canBeBooked)) row.selectable += 1;
    if (slot.status === 'limited') row.limited += 1;
    if (slot.status === 'blocked') row.blocked += 1;
    if (slot.status === 'booked') row.booked += 1;
    if (slot.status === 'past') row.past += 1;
  }

  return Array.from(buckets.values())
    .filter((b) => b.selectable > 0)
    .sort((a, b) => {
      if (b.selectable !== a.selectable) return b.selectable - a.selectable;
      if (a.limited !== b.limited) return a.limited - b.limited;
      return new Date(a.first).getTime() - new Date(b.first).getTime();
    })[0];
}

function availabilityPercent(day: ReturnType<typeof groupSlots>[number]) {
  const bookable = day.counts.available + day.counts.limited;
  const constrained = day.counts.booked + day.counts.blocked;
  const total = Math.max(1, bookable + constrained);
  return Math.round((bookable / total) * 100);
}

export default function ClinicianCalendar({ params }: { params: { id: string } }) {
  const router = useRouter();
  const sp = useSearchParams();
  const { push, Toasts } = useToasts();

  const country = String(sp?.get('country') || 'ZA').toUpperCase();
  const apiEnabled = country === 'ZA';
  const caseId = sp?.get('caseId') || undefined;

  const queryType = sp?.get('type') === 'followup' ? 'followup' : 'standard';
  const [consultType, setConsultType] = useState<ConsultType>(queryType === 'followup' && !caseId ? 'standard' : queryType);
  const [showUnavailable, setShowUnavailable] = useState(false);

  const [profile, setProfile] = useState<BookingProfile | null>(null);
  const [slots, setSlots] = useState<NormalizedSlot[]>([]);
  const [profileBusy, setProfileBusy] = useState(true);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<NormalizedSlot | null>(null);
  const [preflight, setPreflight] = useState<AppointmentPreflight | null>(null);
  const [ackedWarningCodes, setAckedWarningCodes] = useState<string[]>([]);
  const [bookingRequestKey, setBookingRequestKey] = useState('');

  // Structural defaults only. These values are never shown or used for a booking unless
  // a real booking profile has loaded successfully.
  const emptyProfile = useMemo<BookingProfile>(
    () => ({
      clinician: {
        id: params.id,
        name: 'Clinician',
        timezone: 'Africa/Johannesburg',
        rating: undefined,
        ratingCount: undefined,
        operational: { canBeBooked: false },
      },
      fees: {
        standard: { priceCents: 0, currency: 'ZAR', durationMin: 0, bufferMin: 0 },
        followUp: { priceCents: 0, currency: 'ZAR', durationMin: 0, bufferMin: 0 },
      },
      refundPolicy: {
        within24hPercent: 0,
        noShowPercent: 0,
        clinicianMissPercent: 0,
        networkProrate: false,
      },
      rules: { followUpRequiresOpenCase: true, followUpFromCaseContextOnly: true },
    }),
    [params.id],
  );

  const followUpAllowed = useMemo(() => Boolean(caseId), [caseId]);

  useEffect(() => {
    if (consultType === 'followup' && !followUpAllowed) setConsultType('standard');
  }, [consultType, followUpAllowed]);

  const normalizedForUi = useMemo(
    () => (profile ? normalizeBookingProfile(profile as any, emptyProfile) : emptyProfile),
    [profile, emptyProfile],
  );

  const fee: FeeProfile = useMemo(() => {
    const src = normalizedForUi;
    return consultType === 'followup' ? src.fees.followUp : src.fees.standard;
  }, [normalizedForUi, consultType]);


  useEffect(() => {
    let canceled = false;

    async function loadProfile() {
      try {
        setProfileBusy(true);
        setProfileError(null);
        setProfile(null);

        const url = localApiUrl(`/api/clinicians/${encodeURIComponent(params.id)}/booking-profile`);
        const r = await fetch(url, {
          cache: 'no-store',
          headers: { 'x-role': 'patient', 'x-uid': getUid() },
        });

        const j = await readJsonSafe(r);
        if (!r.ok || !j) {
          throw new Error(j?.error || j?.message || `Failed to load clinician profile (HTTP ${r.status})`);
        }

        const standardFeeComplete =
          Number.isFinite(Number(j?.fees?.standard?.priceCents)) &&
          Number.isFinite(Number(j?.fees?.standard?.durationMin));
        const followUpFeeComplete =
          Number.isFinite(Number(j?.fees?.followUp?.priceCents)) &&
          Number.isFinite(Number(j?.fees?.followUp?.durationMin));

        if (!standardFeeComplete || !followUpFeeComplete) {
          throw new Error('This clinician’s current consultation fees could not be confirmed. Please try again later.');
        }

        const normalized = normalizeBookingProfile(j, emptyProfile);
        if (!canceled) setProfile(normalized);
      } catch (e: any) {
        if (!canceled) {
          setProfileError(e?.message || 'Failed to load clinician profile');
          setProfile(null);
        }
      } finally {
        if (!canceled) setProfileBusy(false);
      }
    }

    loadProfile();

    return () => {
      canceled = true;
    };
  }, [params.id, emptyProfile]);

  const c = normalizedForUi.clinician;
  const operational = c.operational ?? null;
  const canBeBooked = Boolean(profile) && (operational ? operational.canBeBooked !== false : true);
  const ratingValue = typeof c.rating === 'number' && Number.isFinite(c.rating) ? c.rating : null;
  const ratingCount = typeof c.ratingCount === 'number' && Number.isFinite(c.ratingCount) ? c.ratingCount : null;

  useEffect(() => {
    let canceled = false;

    async function loadSlots() {
      try {
        setAvailabilityBusy(true);
        setAvailabilityError(null);
        setSlots([]);

        if (!apiEnabled || !profile || !canBeBooked) return;

        const from = new Date();
        const q = new URLSearchParams({
          from: from.toISOString().slice(0, 10),
          days: '14',
          type: consultType,
          includeUnavailable: showUnavailable ? '1' : '0',
        });
        if (caseId) q.set('caseId', caseId);

        const url = localApiUrl(`/api/clinicians/${encodeURIComponent(params.id)}/availability?${q.toString()}`);
        const r = await fetch(url, {
          cache: 'no-store',
          headers: { 'x-role': 'patient', 'x-uid': getUid() },
        });

        const j = await readJsonSafe(r);
        if (!r.ok) throw new Error(j?.error || `Failed to load availability (HTTP ${r.status})`);

        const out = Array.isArray(j?.slots) ? (j.slots as Slot[]) : [];
        const normalized = out
          .map((slot) => normalizeSlot(slot, consultType))
          .filter(
            (slot): slot is NormalizedSlot =>
              slot !== null,
          );

        if (!canceled) setSlots(normalized);
      } catch (e: any) {
        if (!canceled) {
          setAvailabilityError(e?.message || 'Failed to load availability');
          setSlots([]);
        }
      } finally {
        if (!canceled) setAvailabilityBusy(false);
      }
    }

    loadSlots();

    return () => {
      canceled = true;
    };
  }, [params.id, consultType, caseId, apiEnabled, profile, canBeBooked, showUnavailable]);

  useEffect(() => {
    setSelectedSlot(null);
    setPreflight(null);
    setAckedWarningCodes([]);
    setBookingRequestKey('');
  }, [consultType, caseId, params.id]);

  useEffect(() => {
    if (!selectedSlot) return;

    const current = slots.find(
      (slot) =>
        slot.start === selectedSlot.start &&
        slot.status === selectedSlot.status &&
        slot.consultType === consultType,
    );

    if (!current) {
      setSelectedSlot(null);
      setPreflight(null);
      setAckedWarningCodes([]);
      setBookingRequestKey('');
      return;
    }

    const changed =
      current.end !== selectedSlot.end ||
      current.feeCents !== selectedSlot.feeCents ||
      current.currency !== selectedSlot.currency ||
      current.durationMin !== selectedSlot.durationMin;

    if (changed) {
      setSelectedSlot(current);
      setPreflight(null);
      setAckedWarningCodes([]);
    }
  }, [slots, selectedSlot, consultType]);

  const visibleSlots = useMemo(() => {
    if (showUnavailable) return slots;
    return slots.filter((slot) => slot.status === 'available' || slot.status === 'limited');
  }, [slots, showUnavailable]);

  const days = useMemo(() => groupSlots(visibleSlots), [visibleSlots]);
  const bestSlot = useMemo(() => bestNextSlot(slots, apiEnabled, canBeBooked), [slots, apiEnabled, canBeBooked]);
  const optionsWindow = useMemo(() => mostOptionsWindow(slots, apiEnabled, canBeBooked), [slots, apiEnabled, canBeBooked]);

  const title = consultType === 'followup' ? 'Book a follow-up consultation' : 'Book a new consultation';
  const helperText =
    consultType === 'followup'
      ? `Follow-up for Case: ${caseId ?? 'case context missing'}`
      : 'Choose an available date and time for a new consultation.';

  const selectedEndsAt = selectedSlot?.end;
  const preflightWarnings = Array.isArray(preflight?.warnings) ? preflight.warnings : [];
  const blockingWarnings = preflightWarnings.filter((warning) => warning.severity === 'blocking');
  const acknowledgementWarnings = preflightWarnings.filter(
    (warning) => warning.requiresAck && warning.severity !== 'blocking',
  );
  const conflictDetails = Array.isArray(preflight?.conflicts?.details) ? preflight.conflicts.details : [];
  const allRequiredWarningsAcknowledged = acknowledgementWarnings.every((warning) =>
    ackedWarningCodes.includes(warning.code),
  );
  const lockedFeeCents = Number.isFinite(Number(preflight?.priceLock?.amountMinor))
    ? Number(preflight?.priceLock?.amountMinor)
    : null;
  const displayedFeeCents = lockedFeeCents ?? selectedSlot?.feeCents ?? 0;
  const displayedFeeCurrency = preflight?.priceLock?.currency || selectedSlot?.currency || fee.currency;
  const feeChangedDuringReview =
    lockedFeeCents !== null && selectedSlot !== null && lockedFeeCents !== selectedSlot.feeCents;

  function clearPreflightReview() {
    setPreflight(null);
    setAckedWarningCodes([]);
  }

  function toggleWarningAcknowledgement(code: string) {
    setAckedWarningCodes((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
  }

  async function runBookingPreflight(payload: Record<string, unknown>) {
    const r = await fetch('/api/appointments/preflight', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const j = await readJsonSafe(r);
    const normalized = normalizePreflightPayload(j);

    if (!r.ok || !normalized || normalized.ok === false) {
      if (r.status === 401 || ['patient_session_required', 'unauthorized'].includes(String(j?.error || ''))) {
        throw new Error('Please sign in to your patient account before booking.');
      }

      if (normalized && (j?.error === 'PRECHECK_REQUIRED' || normalized.error === 'PRECHECK_REQUIRED')) {
        setPreflight(normalized);
        setAckedWarningCodes([]);
        return normalized;
      }
      throw new Error(j?.message || j?.error || `Booking review failed (HTTP ${r.status})`);
    }

    if (!normalized.priceLock?.token) {
      throw new Error('Booking review did not return a valid fee lock. Please try again.');
    }

    setPreflight(normalized);
    setAckedWarningCodes([]);
    return normalized;
  }

  async function confirmBooking() {
    if (bookingBusy) return;

    if (!selectedSlot || !selectedEndsAt) {
      push('Choose a slot first.', 'error');
      return;
    }

    if (!isSelectableSlot(selectedSlot, apiEnabled, canBeBooked) || selectedSlot.consultType !== consultType) {
      push('This appointment time is no longer valid for the selected consultation type. Please choose another time.', 'error');
      setSelectedSlot(null);
      clearPreflightReview();
      setBookingRequestKey('');
      return;
    }

    if (consultType === 'followup' && !followUpAllowed) {
      push('Follow-ups require an active case context.', 'error');
      return;
    }

    try {
      setBookingBusy(true);

      const basePayload: Record<string, unknown> = {
        clinicianId: params.id,
        startsAt: selectedSlot.start,
        endsAt: selectedSlot.end,
        paymentMethod: 'card',
        reason: consultType === 'followup' ? 'Follow-up consultation' : 'New consultation',
        kind: consultType,
        visitMode: 'televisit',
        country,
      };

      if (consultType === 'followup' && caseId) {
        basePayload.caseId = caseId;
      }

      const alreadyReviewed = Boolean(preflight?.priceLock?.token);
      const reviewed = alreadyReviewed ? preflight : await runBookingPreflight(basePayload);
      const reviewedWarnings = Array.isArray(reviewed?.warnings) ? reviewed.warnings : [];
      const reviewedBlocking = reviewedWarnings.filter((warning) => warning.severity === 'blocking');
      const reviewedConflicts = Array.isArray(reviewed?.conflicts?.details) ? reviewed.conflicts.details : [];
      const reviewedRequiredCodes = reviewedWarnings
        .filter((warning) => warning.requiresAck && warning.severity !== 'blocking')
        .map((warning) => warning.code);

      if (reviewedBlocking.length > 0 || reviewedConflicts.length > 0 || reviewed?.canProceed === false) {
        push('This appointment cannot proceed. Review the booking notices shown below.', 'error');
        return;
      }

      const reviewedAmountMinor = Number(reviewed?.priceLock?.amountMinor);
      if (!alreadyReviewed) {
        if (Number.isFinite(reviewedAmountMinor) && reviewedAmountMinor !== selectedSlot.feeCents) {
          push('The confirmed consultation fee differs from the earlier slot estimate. Please review the updated fee.', 'info');
        } else if (reviewedRequiredCodes.length > 0) {
          push('Please review and acknowledge the booking notices before continuing.', 'info');
        } else {
          push('Appointment details confirmed. Review the fee and continue to secure card payment.', 'info');
        }
        return;
      }

      if (reviewedRequiredCodes.some((code) => !ackedWarningCodes.includes(code))) {
        push('Please review and acknowledge the booking notices before continuing.', 'info');
        return;
      }

      if (!reviewed?.priceLock?.token) {
        clearPreflightReview();
        throw new Error('The booking fee lock is unavailable. Please review the appointment again.');
      }

      const requestId =
        bookingRequestKey ||
        globalThis.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (!bookingRequestKey) setBookingRequestKey(requestId);

      const payload = {
        ...basePayload,
        priceLock: reviewed.priceLock.token,
        decisionToken: reviewed.decisionToken || undefined,
        ackedWarningCodes: reviewedRequiredCodes,
      };

      const r = await fetch('/api/appointments/new', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-idempotency-key': requestId,
        },
        body: JSON.stringify(payload),
      });

      const j = await readJsonSafe(r);

      if (r.status === 409 && j?.error === 'PRECHECK_REQUIRED') {
        const refreshed = normalizePreflightPayload(j, reviewed.priceLock);
        if (refreshed) setPreflight(refreshed);
        setAckedWarningCodes([]);
        push('The booking conditions changed. Please review the updated notices before continuing.', 'error');
        return;
      }

      if (r.status === 409 && ['PRICE_LOCK_REQUIRED', 'PRICE_LOCK_MISMATCH'].includes(String(j?.error || ''))) {
        clearPreflightReview();
        throw new Error('The confirmed fee expired or changed. Please review the appointment again.');
      }

      if (!r.ok || j?.ok === false) {
        if (r.status === 401 || ['patient_session_required', 'unauthorized'].includes(String(j?.error || ''))) {
          throw new Error('Please sign in to your patient account before booking.');
        }
        throw new Error(j?.message || j?.error || `Booking failed (HTTP ${r.status})`);
      }

      setSelectedSlot(null);
      clearPreflightReview();
      setBookingRequestKey('');

      const redirectUrl = j?.redirectUrl || j?.redirect_url;
      if (redirectUrl) {
        try {
          sessionStorage.setItem(
            'ambulant:lastPaymentAttempt',
            JSON.stringify({
              appointmentId: j.appointmentId ?? j.appointment_id ?? '',
              encounterId: j.encounterId ?? j.encounter_id ?? '',
              paymentRef: j.payment?.ref ?? j.paymentRef ?? j.payment_ref ?? '',
              redirectUrl,
              clinicianId: params.id,
              createdAt: new Date().toISOString(),
            }),
          );
        } catch {}

        push('Redirecting to secure payment...', 'info');
        window.location.href = redirectUrl;
        return;
      }

      if (String(j?.payment?.status || j?.paymentStatus || '').toUpperCase() === 'PENDING') {
        push('Booking created. Payment is pending.', 'info');
        router.push('/appointments');
        return;
      }

      if (String(j?.sponsor?.decision || '').toUpperCase() === 'COVERED') {
        push('Appointment booked and covered.', 'success');
        router.push('/appointments');
        return;
      }

      push('Appointment booked.', 'success');
      router.push('/appointments');
    } catch (e: any) {
      push(e?.message || 'Failed to book appointment', 'error');
    } finally {
      setBookingBusy(false);
    }
  }

  function selectSlot(slot: NormalizedSlot) {
    if (!isSelectableSlot(slot, apiEnabled, canBeBooked)) {
      push(statusExplanation(slot.status), 'error');
      return;
    }

    setSelectedSlot(slot);
    clearPreflightReview();
    setBookingRequestKey(
      globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
  }

  const totalBookable = slots.filter((slot) => isSelectableSlot(slot, apiEnabled, canBeBooked)).length;

  if (profileBusy) {
    return (
      <main data-p-ui="patient-clinician-calendar-page" className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Loading clinician and booking details...
        </div>
      </main>
    );
  }

  if (profileError || !profile) {
    return (
      <main data-p-ui="patient-clinician-calendar-page" className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-2xl rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center">
          <h1 className="text-lg font-semibold text-rose-900">Booking details unavailable</h1>
          <p className="mt-2 text-sm text-rose-700">{profileError || 'The clinician booking profile could not be loaded.'}</p>
          <div className="mt-5 flex justify-center gap-3">
            <button onClick={() => window.location.reload()} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white">
              Try again
            </button>
            <button onClick={() => router.back()} className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-900">
              Go back
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main data-p-ui="patient-clinician-calendar-page" className="min-w-0 overflow-x-clip min-h-screen bg-slate-50 px-4 py-5 sm:px-6 lg:px-8">
      <Toasts />

      <div className="mx-auto max-w-7xl space-y-5 pb-28 lg:pb-8">
        <header className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 px-5 py-5 text-white sm:px-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <button
                onClick={() => router.back()}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white/90 hover:bg-white/15"
              >
                Back
              </button>

              <div className="min-w-0 flex-1 text-center">
                <div className="text-xs uppercase tracking-[0.25em] text-emerald-200">Ambulant+ appointment booking</div>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
                <p className="mt-1 text-sm text-slate-200">{helperText}</p>
              </div>

              <Link
                href="/clinicians"
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white/90 hover:bg-white/15"
              >
                Clinicians
              </Link>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs text-slate-300">Clinician</div>
                <div className="mt-1 truncate text-lg font-semibold">{c.name}</div>
                <div className="text-xs text-slate-300">{c.specialty ?? 'Clinical consultation'}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs text-slate-300">Trust signal</div>
                <div className="mt-1 text-lg font-semibold">
                  {ratingValue != null ? ratingValue.toFixed(1) : 'Not rated yet'}
                </div>
                <div className="text-xs text-slate-300">
                  {ratingCount != null ? `${ratingCount.toLocaleString()} ratings` : 'Rating appears when available'}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs text-slate-300">Best next slot</div>
                <div className="mt-1 text-lg font-semibold">{bestSlot ? slotStartLabel(bestSlot) : 'None open'}</div>
                <div className="text-xs text-slate-300">{bestSlot ? slotDayLabel(bestSlot) : 'Try again later'}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs text-slate-300">Most appointment options</div>
                <div className="mt-1 text-lg font-semibold">{optionsWindow ? optionsWindow.label : 'No open times'}</div>
                <div className="text-xs text-slate-300">
                  {optionsWindow ? `${optionsWindow.selectable} available times` : 'Check again later'}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:p-7 lg:grid-cols-[1.4fr_1fr]">
            <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Consultation pathway</div>
                  <p className="mt-1 text-xs text-slate-600">
                    New consultations start a new case. Follow-ups must come from an active case context.
                  </p>
                </div>

                {consultType === 'followup' && !followUpAllowed && (
                  <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-800">
                    Case required
                  </span>
                )}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setConsultType('standard')}
                  disabled={!canBeBooked}
                  className={cx(
                    'rounded-2xl border p-4 text-left transition',
                    consultType === 'standard'
                      ? 'border-slate-950 bg-white shadow-sm'
                      : 'border-slate-200 bg-white/70 hover:bg-white',
                    !canBeBooked && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-slate-900">New consultation</div>
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] text-white">New case</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">Best for a new concern, fresh assessment, or first visit.</p>
                  <div className="mt-3 text-sm font-semibold text-slate-900">
                    {formatMoney(normalizedForUi.fees.standard.priceCents, normalizedForUi.fees.standard.currency)}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!followUpAllowed) {
                      push('Follow-up requires a caseId from your Cases or Encounters page.', 'error');
                      return;
                    }
                    setConsultType('followup');
                  }}
                  disabled={!canBeBooked}
                  className={cx(
                    'rounded-2xl border p-4 text-left transition',
                    consultType === 'followup'
                      ? 'border-emerald-700 bg-white shadow-sm'
                      : 'border-slate-200 bg-white/70 hover:bg-white',
                    !followUpAllowed && 'border-dashed bg-slate-100 text-slate-500',
                    !canBeBooked && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold">Follow-up</div>
                    <span
                      className={cx(
                        'rounded-full px-2 py-0.5 text-[11px]',
                        followUpAllowed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600',
                      )}
                    >
                      {followUpAllowed ? 'Case linked' : 'Locked'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    {followUpAllowed ? `Linked to Case ${caseId}.` : 'Open an active case first, then book follow-up from there.'}
                  </p>
                  <div className="mt-3 text-sm font-semibold">
                    {formatMoney(normalizedForUi.fees.followUp.priceCents, normalizedForUi.fees.followUp.currency)}
                  </div>
                </button>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="text-xs text-slate-500">Consultation fee</div>
                <div className="mt-1 text-xl font-semibold text-slate-950">{formatMoney(fee.priceCents, fee.currency)}</div>
                <div className="text-xs text-slate-500">Confirmed before payment</div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="text-xs text-slate-500">Consult duration</div>
                <div className="mt-1 text-xl font-semibold text-slate-950">{fee.durationMin} min</div>
                <div className="text-xs text-slate-500">Scheduled consultation time</div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="text-xs text-slate-500">Appointment spacing</div>
                <div className="mt-1 text-xl font-semibold text-slate-950">{fee.bufferMin} min</div>
                <div className="text-xs text-slate-500">Managed by the clinician</div>
              </div>
            </section>
          </div>
        </header>

        {!apiEnabled && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Live booking is currently available for South Africa (ZA) only.
          </div>
        )}

        {!canBeBooked && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Booking is temporarily unavailable for this clinician. Please choose another clinician or try again later.
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Choose an appointment time</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Select an available date and time. Your consultation fee and duration are shown before booking.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowUnavailable((v) => !v)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {showUnavailable ? 'Show available times only' : 'Show unavailable times'}
                  </button>
                  <span className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white">
                    {totalBookable} bookable
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-5">
                {(['available', 'limited', 'blocked', 'booked', 'past'] as SlotStatus[]).map((status) => (
                  <div key={status} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold text-slate-900">{statusLabel(status)}</div>
                    <div className="mt-1 text-[11px] leading-relaxed text-slate-600">{statusExplanation(status)}</div>
                  </div>
                ))}
              </div>
            </div>

            {availabilityBusy ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                Loading available appointment times...
              </div>
            ) : availabilityError ? (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">{availabilityError}</div>
            ) : days.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                {apiEnabled ? 'No slots in this window.' : 'Live availability is not available for this country.'}
              </div>
            ) : (
              <div className="space-y-4">
                {days.map((day) => {
                  const load = availabilityPercent(day);
                  const dayFirstBookable = day.slots.find((slot) => isSelectableSlot(slot, apiEnabled, canBeBooked));

                  return (
                    <article key={day.key} className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
                      <div className="border-b border-slate-100 bg-slate-50 px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-950">{day.fullLabel}</div>
                            <div className="mt-1 text-xs text-slate-600">
                              {day.counts.available} available - {day.counts.limited} limited - {day.counts.booked} booked
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {bestSlot && dayFirstBookable?.start === bestSlot.start && (
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                                Best next
                              </span>
                            )}
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
                              Availability {load}%
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${load}%` }} />
                        </div>
                      </div>

                      <div className="space-y-5 p-4">
                        {DAY_PHASES.filter((phase) => day.groups[phase].length > 0).map((phase) => {
                          const phaseSlots = day.groups[phase];

                          return (
                            <section key={phase}>
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                  {phaseLabel(phase)}
                                </div>
                                <div className="text-xs text-slate-500">{phaseSlots.length} windows</div>
                              </div>

                              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                  {phaseSlots.map((slot) => {
                                    const selected = selectedSlot?.start === slot.start;
                                    const selectable = isSelectableSlot(slot, apiEnabled, canBeBooked);

                                    return (
                                      <li key={`${slot.start}-${slot.status}`}>
                                        <button
                                          type="button"
                                          className={statusClasses(slot.status, selected)}
                                          onClick={() => selectSlot(slot)}
                                          disabled={!selectable}
                                          title={statusExplanation(slot.status)}
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <div>
                                              <div className="text-base font-semibold">{slotStartLabel(slot)}</div>
                                              <div className="mt-0.5 text-[11px] opacity-80">
                                                Ends {slotEndLabel(slot)} - {slot.durationMin} min
                                              </div>
                                            </div>
                                            <span className="rounded-full bg-white/75 px-2 py-0.5 text-[10px] font-semibold">
                                              {statusLabel(slot.status)}
                                            </span>
                                          </div>

                                          <div className="mt-3 rounded-xl bg-white/60 px-2 py-1 text-[11px]">
                                            Fee: {formatMoney(slot.feeCents, slot.currency)}
                                          </div>

                                          {slot.status === 'limited' && (
                                            <div className="mt-2 text-[11px] opacity-80">Additional booking notice applies.</div>
                                          )}
                                        </button>
                                      </li>
                                    );
                                  })}
                                </ul>
                            </section>
                          );
                        })}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="space-y-4 lg:sticky lg:top-5 lg:h-fit">
            <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Booking summary</div>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">
                {selectedSlot ? 'Review your appointment' : 'Choose an appointment time'}
              </h2>

              {selectedSlot ? (
                <div className="mt-4 space-y-3 text-sm">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Selected appointment</div>
                    <div className="mt-1 font-semibold text-slate-950">{slotDateTimeLabel(selectedSlot)}</div>
                    <div className="text-xs text-slate-600">Ends {slotEndDateTimeLabel(selectedSlot)}</div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-2xl border border-slate-200 p-3">
                      <div className="text-xs text-slate-500">{lockedFeeCents !== null ? 'Confirmed fee' : 'Fee'}</div>
                      <div className="font-semibold">{formatMoney(displayedFeeCents, displayedFeeCurrency)}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-3">
                      <div className="text-xs text-slate-500">Type</div>
                      <div className="font-semibold">{consultType === 'followup' ? 'Follow-up' : 'New case'}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-3">
                      <div className="text-xs text-slate-500">Duration</div>
                      <div className="font-semibold">{selectedSlot.durationMin} min</div>
                    </div>

                  </div>

                  {feeChangedDuringReview && (
                    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
                      The confirmed fee is {formatMoney(displayedFeeCents, displayedFeeCurrency)}. Review this amount before continuing.
                    </div>
                  )}

                  {selectedSlot.status === 'limited' && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      Please review any additional notice shown during booking.
                    </div>
                  )}

                  {consultType === 'followup' && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                      Follow-up case: <b>{caseId ?? 'case context missing'}</b>
                    </div>
                  )}

                  {preflight && (preflightWarnings.length > 0 || conflictDetails.length > 0) && (
                    <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-amber-950">Booking notices</div>

                      {conflictDetails.map((conflict, index) => (
                        <div
                          key={`${conflict.code || 'conflict'}-${index}`}
                          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900"
                        >
                          <div className="font-semibold">This time is no longer available</div>
                          <div className="mt-1">Choose another appointment time.</div>
                        </div>
                      ))}

                      {preflightWarnings.map((warning) => {
                        const blocking = warning.severity === 'blocking';
                        return (
                          <label
                            key={warning.code || warning.title}
                            className={cx(
                              'block rounded-xl border p-3 text-xs',
                              blocking
                                ? 'border-rose-200 bg-rose-50 text-rose-900'
                                : 'border-amber-200 bg-white text-amber-950',
                            )}
                          >
                            <div className="flex items-start gap-2">
                              {warning.requiresAck && !blocking ? (
                                <input
                                  type="checkbox"
                                  className="mt-0.5 h-4 w-4 rounded border-amber-300"
                                  checked={ackedWarningCodes.includes(warning.code)}
                                  onChange={() => toggleWarningAcknowledgement(warning.code)}
                                />
                              ) : null}
                              <div>
                                <div className="font-semibold">{warning.title}</div>
                                {warning.message ? <div className="mt-1 leading-5">{warning.message}</div> : null}
                                {warning.requiresAck && !blocking ? (
                                  <div className="mt-1 font-medium">
                                    Tick to confirm that you have read and understood this notice.
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={confirmBooking}
                    disabled={
                      bookingBusy ||
                      !isSelectableSlot(selectedSlot, apiEnabled, canBeBooked) ||
                      selectedSlot.consultType !== consultType ||
                      blockingWarnings.length > 0 ||
                      conflictDetails.length > 0 ||
                      (preflight !== null && !allRequiredWarningsAcknowledged)
                    }
                    className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {bookingBusy
                      ? preflight?.priceLock?.token
                        ? 'Processing booking...'
                        : 'Reviewing appointment...'
                      : preflight?.priceLock?.token
                        ? 'Continue to secure card payment'
                        : 'Review card booking'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSlot(null);
                      clearPreflightReview();
                      setBookingRequestKey('');
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Clear selection
                  </button>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Choose an available or limited slot. Your selected time, fee and duration will be confirmed before secure card payment.
                </div>
              )}
            </section>

            <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="font-semibold text-slate-950">Refund policy</div>
              <p className="mt-1 text-xs text-slate-600">
                This clinician's policy applies to the selected booking. Review before confirming.
              </p>
              <div className="mt-3">
                <RefundPolicyPanel clinicianId={params.id} />
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="font-semibold text-slate-950">Booking information</div>
              <ul className="mt-3 space-y-2 text-xs text-slate-700">
                <li>- A new consultation creates a new case.</li>
                <li>- Follow-ups require an active case and must be launched from case context.</li>
                <li>- This streamlined calendar continues to secure card payment.</li>
                <li>- The consultation fee is confirmed before payment.</li>
                <li>- Appointment times include any spacing required by the clinician.</li>
              </ul>
              <Link
                href={`/appointments/new?clinicianId=${encodeURIComponent(params.id)}`}
                className="mt-4 block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-xs font-semibold text-slate-800 transition hover:bg-slate-100"
              >
                {c.acceptsMedicalAid
                  ? 'Use Medical Aid, family booking or additional participants'
                  : 'Use family booking or additional participants'}
              </Link>
            </section>
          </aside>
        </div>
      </div>

      {selectedSlot && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-950">{slotDateTimeLabel(selectedSlot)}</div>
              <div className="text-xs text-slate-600">
                {formatMoney(displayedFeeCents, displayedFeeCurrency)} - {selectedSlot.durationMin} min
              </div>
            </div>
            <button
              type="button"
              onClick={confirmBooking}
              disabled={
                bookingBusy ||
                !isSelectableSlot(selectedSlot, apiEnabled, canBeBooked) ||
                selectedSlot.consultType !== consultType ||
                blockingWarnings.length > 0 ||
                conflictDetails.length > 0 ||
                (preflight !== null && !allRequiredWarningsAcknowledged)
              }
              className="shrink-0 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
            >
              {bookingBusy
                ? 'Processing...'
                : preflight?.priceLock?.token
                  ? 'Pay by card'
                  : 'Review card booking'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
