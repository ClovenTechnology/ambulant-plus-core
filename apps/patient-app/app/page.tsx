//apps/patient-app/app/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  HeartPulse,
  ScanHeart,
  Shield,
  Sparkles,
  Stethoscope,
  Syringe,
  TrendingUp,
  Waves,
} from 'lucide-react';

import type { Allergy, Clinician, Pill, Vitals } from '@/types';
import type { BpPoint } from '../components/charts/BpChart';
import { pickPreferredVital, type VitalsType } from '@/src/lib/vitals';

import MeterDonut from '../components/charts/AnimatedMeterDonut';
import MiniMeterDonut from '../components/charts/MiniMeterDonut';
import Sparkline from '../components/charts/Sparkline';
import VitalsTrendChart from '../components/charts/VitalsTrendChart';

import RecentActivityStrip from '../components/RecentActivityStrip';

import AllergiesBlockWrapper from '@/components/AllergiesBlockWrapper';
import PillRemindersWrapper from '@/components/PillRemindersWrapper';
import MedicationsBlockWrapper from '@/components/MedicationsBlockWrapper';
import ReportsBlockWrapper from '@/components/ReportsBlockWrapper';

type AlertSeverity = 'low' | 'moderate' | 'high' | 'critical';

type InsightAlert = {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  ts: string;
};

type MedLike = {
  id?: string;
  orderId?: string;
  name?: string;
  dose?: string;
  time?: string;
  status?: string;
};

type MedicationBlockItem = {
  id: string;
  name: string;
  dose?: string;
  frequency?: string;
  route?: string;
  started?: string;
  lastFilled?: string;
  status?: string;
  orderId?: string | null;
};

type CaseLike = {
  id?: string;
  title?: string;
  status?: string;
  updatedAt?: string;
  latestEncounter?: {
    start?: string;
  };
};


type ProfileResponse = {
  ok?: boolean;
  userId?: string | null;
  patientId?: string | null;
  name?: string | null;
  allergies?: string[];
  chronicConditions?: string[];
  primaryConditionsText?: string | null;
};

type AppointmentPreview = {
  id: string;
  startsAt: string;
  status: string;
  clinicianName?: string;
};

type RawVitalRecord = {
  id?: string;
  type?: string;
  recorded_at?: string | null;
  payload?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
};

type LiveVitals = Omit<Vitals, 'temp' | 'bpSeries'> & {
  hr: number;
  bp: string;
  temp: number;
  spo2: number;
  bpSeries: BpPoint[];
  lastSync: string;
};

type UIMood = 'calm' | 'watchful' | 'alert';

const SURFACE =
  'relative overflow-hidden rounded-[30px] border border-white/60 bg-white/85 backdrop-blur-xl shadow-[0_10px_40px_rgba(15,23,42,0.06)]';

const sectionMotion = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.42 },
};

const hoverLift = {
  whileHover: { y: -6, scale: 1.01 },
  transition: { type: 'spring', stiffness: 220, damping: 18 },
} as const;

const GATEWAY = process.env.NEXT_PUBLIC_APIGW_BASE ?? 'http://localhost:3010';

const EMPTY_VITALS: LiveVitals = {
  hr: 0,
  bp: '—',
  temp: 0,
  spo2: 0,
  lastSync: 'Sync pending',
  bpSeries: [],
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function formatTimestamp(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function formatHumanDateTime(value?: string) {
  if (!value) return 'Plan next consultation';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeSync(value?: string) {
  if (!value) return 'Sync pending';
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return 'Sync pending';

  const diffMs = Date.now() - ts;
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function getDayPart() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function hasLiveVitalData(vitals: LiveVitals) {
  return (
    vitals.hr > 0 ||
    vitals.spo2 > 0 ||
    vitals.temp > 0 ||
    (typeof vitals.bp === 'string' && vitals.bp.includes('/')) ||
    vitals.bpSeries.length > 0
  );
}

function displayVitalNumber(value: number, suffix = '') {
  if (!Number.isFinite(value) || value <= 0) return '—';
  return `${value}${suffix}`;
}

function displayTemp(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '—';
  return `${value.toFixed(1)} °C`;
}

function displayBp(value?: string) {
  if (!value || value === '—') return '—';
  return value;
}

function computeRecoveryScore(
  vitals: LiveVitals,
  adherencePct: number,
  alertCount: number,
) {
  if (!hasLiveVitalData(vitals)) {
    const alertsPenalty = Math.min(20, alertCount * 5);
    const raw = adherencePct * 0.7 + (100 - alertsPenalty) * 0.3;
    return Math.max(40, Math.min(90, Math.round(raw)));
  }

  const systolic = parseInt(String(vitals.bp ?? '0/0').split('/')[0] ?? '0', 10);
  const diastolic = parseInt(String(vitals.bp ?? '0/0').split('/')[1] ?? '0', 10);

  const spo2Score = Math.min(100, Math.max(0, vitals.spo2));
  const hrScore = Math.max(0, 100 - Math.abs(vitals.hr - 72) * 2);
  const tempScore = Math.max(0, 100 - Math.abs(vitals.temp - 36.9) * 30);
  const bpPenalty = Math.max(
    0,
    Math.abs(systolic - 120) * 0.8 + Math.abs(diastolic - 80) * 0.6,
  );
  const alertsPenalty = Math.min(22, alertCount * 5);

  const raw =
    spo2Score * 0.28 +
    hrScore * 0.2 +
    tempScore * 0.16 +
    adherencePct * 0.24 +
    (100 - bpPenalty) * 0.12 -
    alertsPenalty;

  return Math.max(32, Math.min(99, Math.round(raw)));
}

function getRecoveryLabel(score: number) {
  if (score >= 86) return 'Stable';
  if (score >= 72) return 'Good';
  if (score >= 60) return 'Watchful';
  return 'Needs attention';
}

function getRecoveryNarrative(
  score: number,
  vitals: LiveVitals,
  adherencePct: number,
) {
  if (!hasLiveVitalData(vitals)) {
    if (adherencePct < 80) {
      return 'Your care workspace is active. Keeping medications on schedule and syncing your supported devices will strengthen today’s insight.';
    }
    return 'Connect or sync a supported device to activate a fuller real-time health picture.';
  }

  const systolic = parseInt(String(vitals.bp ?? '0/0').split('/')[0] ?? '0', 10);

  if (score < 60) {
    return 'A few signals need closer follow-up today. Review your vitals, medications, and any care-team alerts.';
  }

  if (vitals.spo2 < 94 || systolic > 140) {
    return 'Most signals are holding, but one or two readings deserve extra attention and a quick review.';
  }

  if (adherencePct < 80) {
    return 'Your vitals look reassuring overall. Staying on schedule with medication can improve your trend further.';
  }

  return 'Your latest readings and care activity suggest a steady, well-managed day with no immediate concern signals.';
}

function getPriorityAction(args: {
  alerts: InsightAlert[];
  adherencePct: number;
  nextAppointment: { when: string; with: string; status: string };
}) {
  const critical = args.alerts.find(
    (a) => a.severity === 'critical' || a.severity === 'high',
  );

  if (critical) {
    return {
      title: 'Review priority alert',
      body: critical.title,
      href: '/insights',
      tone: 'rose' as const,
    };
  }

  if (args.adherencePct < 85) {
    return {
      title: 'Stay on track with treatment',
      body: 'Medication adherence is the clearest opportunity to improve today.',
      href: '/medications',
      tone: 'amber' as const,
    };
  }

  return {
    title: 'Prepare for your next consultation',
    body: `${args.nextAppointment.with} • ${args.nextAppointment.when}`,
    href: '/appointments',
    tone: 'sky' as const,
  };
}

function severityChip(severity: AlertSeverity) {
  switch (severity) {
    case 'critical':
      return 'border-rose-200 bg-rose-50/90 text-rose-700';
    case 'high':
      return 'border-amber-200 bg-amber-50/90 text-amber-700';
    case 'moderate':
      return 'border-yellow-200 bg-yellow-50/90 text-yellow-700';
    default:
      return 'border-sky-200 bg-sky-50/90 text-sky-700';
  }
}

function severityLabel(severity: AlertSeverity) {
  switch (severity) {
    case 'critical':
      return 'Critical';
    case 'high':
      return 'High';
    case 'moderate':
      return 'Medium';
    default:
      return 'Low';
  }
}

function toneClasses(tone: 'rose' | 'amber' | 'sky') {
  switch (tone) {
    case 'rose':
      return 'from-rose-500/18 to-pink-500/8 border-rose-200/70';
    case 'amber':
      return 'from-amber-500/18 to-orange-500/8 border-amber-200/70';
    default:
      return 'from-sky-500/18 to-cyan-500/8 border-sky-200/70';
  }
}

function deriveStablePillId(med: MedLike, index: number) {
  return (
    med.id ??
    med.orderId ??
    [med.name ?? 'medication', med.time ?? 'time-unknown', med.dose ?? 'dose-unknown', index].join(
      '::',
    )
  );
}

function normalizeAppointments(payload: unknown): AppointmentPreview[] {
  const root = payload as { appointments?: unknown[] } | undefined;
  const raw = Array.isArray(root?.appointments) ? root.appointments : [];
  const mapped: AppointmentPreview[] = [];

  for (const item of raw) {
    const record = item as Record<string, unknown>;
    const id = String(record.id ?? '').trim();
    const startsAt = String(record.startsAt ?? record.when ?? '').trim();

    if (!id || !startsAt) continue;

    mapped.push({
      id,
      startsAt,
      status: String(record.status ?? 'Scheduled'),
      clinicianName: String(
        record.clinicianName ?? record.doctor ?? record.providerName ?? '',
      ).trim(),
    });
  }

  return mapped.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

function normalizeDevicesCount(payload: unknown): number {
  if (Array.isArray(payload)) return payload.length;

  const root = payload as
    | { items?: unknown[]; devices?: unknown[]; count?: number; total?: number }
    | undefined;

  if (typeof root?.count === 'number') return root.count;
  if (typeof root?.total === 'number') return root.total;
  if (Array.isArray(root?.items)) return root.items.length;
  if (Array.isArray(root?.devices)) return root.devices.length;

  return 0;
}

function normalizeAiMessages(payload: unknown): string[] {
  const root = payload as { messages?: unknown[] } | undefined;
  if (!Array.isArray(root?.messages)) return [];
  return root.messages.filter((m): m is string => typeof m === 'string').slice(0, 3);
}

function normalizeMedications(payload: unknown): MedLike[] {
  if (Array.isArray(payload)) {
    return payload.map((item, index) => {
      const record = item as Record<string, unknown>;
      return {
        id: String(record.id ?? record.medicationId ?? `med-${index}`).trim(),
        orderId: record.orderId == null ? undefined : String(record.orderId),
        name: record.name == null ? undefined : String(record.name),
        dose: record.dose == null ? undefined : String(record.dose),
        time: record.time == null ? undefined : String(record.time),
        status: record.status == null ? undefined : String(record.status),
      };
    });
  }

  const root = payload as { medications?: unknown[]; meds?: unknown[]; items?: unknown[] } | undefined;
  const raw = Array.isArray(root?.medications)
    ? root.medications
    : Array.isArray(root?.meds)
      ? root.meds
      : Array.isArray(root?.items)
        ? root.items
        : [];

  return raw.map((item, index) => {
    const record = item as Record<string, unknown>;
    return {
      id: String(record.id ?? record.medicationId ?? `med-${index}`).trim(),
      orderId: record.orderId == null ? undefined : String(record.orderId),
      name: record.name == null ? undefined : String(record.name),
      dose: record.dose == null ? undefined : String(record.dose),
      time: record.time == null ? undefined : String(record.time),
      status: record.status == null ? undefined : String(record.status),
    };
  });
}

function normalizeCases(payload: unknown): CaseLike[] {
  if (Array.isArray(payload)) {
    return payload.map((item, index) => {
      const record = item as Record<string, unknown>;
      const latestEncounter = record.latestEncounter as Record<string, unknown> | undefined;
      return {
        id: String(record.id ?? `case-${index}`).trim(),
        title: record.title == null ? undefined : String(record.title),
        status: record.status == null ? undefined : String(record.status),
        updatedAt: record.updatedAt == null ? undefined : String(record.updatedAt),
        latestEncounter: latestEncounter?.start == null ? undefined : { start: String(latestEncounter.start) },
      };
    });
  }

  const root = payload as { cases?: unknown[]; items?: unknown[] } | undefined;
  const raw = Array.isArray(root?.cases)
    ? root.cases
    : Array.isArray(root?.items)
      ? root.items
      : [];

  return raw.map((item, index) => {
    const record = item as Record<string, unknown>;
    const latestEncounter = record.latestEncounter as Record<string, unknown> | undefined;
    return {
      id: String(record.id ?? `case-${index}`).trim(),
      title: record.title == null ? undefined : String(record.title),
      status: record.status == null ? undefined : String(record.status),
      updatedAt: record.updatedAt == null ? undefined : String(record.updatedAt),
      latestEncounter: latestEncounter?.start == null ? undefined : { start: String(latestEncounter.start) },
    };
  });
}

function isVitalsType(value: unknown): value is VitalsType {
  return (
    value === 'heart_rate' ||
    value === 'spo2' ||
    value === 'temperature' ||
    value === 'blood_pressure' ||
    value === 'blood_glucose' ||
    value === 'ecg'
  );
}

function toNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function parseBloodPressure(record: RawVitalRecord) {
  const payload = record.payload ?? {};
  const systolic = toNumber(payload.systolic, payload.sys, payload.sbp, payload.high);
  const diastolic = toNumber(payload.diastolic, payload.dia, payload.dbp, payload.low);

  const bpString =
    typeof payload.bp === 'string'
      ? payload.bp
      : typeof payload.value === 'string'
        ? payload.value
        : null;

  if ((systolic === null || diastolic === null) && bpString?.includes('/')) {
    const [s, d] = bpString.split('/');
    return {
      systolic: toNumber(s),
      diastolic: toNumber(d),
    };
  }

  return { systolic, diastolic };
}

function resolveVitals(items: RawVitalRecord[]): LiveVitals {
  if (!Array.isArray(items) || items.length === 0) {
    return EMPTY_VITALS;
  }

  const latestByType = new Map<VitalsType, RawVitalRecord & { type: VitalsType }>();
  const bpSeries: BpPoint[] = items
    .reduce<BpPoint[]>((acc, item) => {
      if (item.type !== 'blood_pressure') return acc;

      const { systolic, diastolic } = parseBloodPressure(item);
      if (typeof systolic !== 'number' || typeof diastolic !== 'number') return acc;

      acc.push({
        ts: item.recorded_at ?? new Date().toISOString(),
        sys: Math.round(systolic),
        dia: Math.round(diastolic),
      });

      return acc;
    }, [])
    .sort((a, b) => new Date(String(a.ts)).getTime() - new Date(String(b.ts)).getTime())
    .slice(-7);

  for (const item of items) {
    if (!isVitalsType(item.type)) continue;
    const typedItem = { ...item, type: item.type } as RawVitalRecord & { type: VitalsType };
    const existing = latestByType.get(item.type);
    const preferred = pickPreferredVital(existing, typedItem);
    if (preferred) latestByType.set(item.type, preferred as RawVitalRecord & { type: VitalsType });
  }

  const hrRecord = latestByType.get('heart_rate');
  const spo2Record = latestByType.get('spo2');
  const tempRecord = latestByType.get('temperature');
  const bpRecord = latestByType.get('blood_pressure');

  const hr =
    toNumber(hrRecord?.payload?.bpm, hrRecord?.payload?.value, hrRecord?.payload?.hr) ?? 0;

  const spo2 =
    toNumber(spo2Record?.payload?.pct, spo2Record?.payload?.value, spo2Record?.payload?.spo2) ?? 0;

  const temp =
    toNumber(
      tempRecord?.payload?.celsius,
      tempRecord?.payload?.value,
      tempRecord?.payload?.temp,
      tempRecord?.payload?.temperature,
    ) ?? 0;

  const bpParsed = bpRecord ? parseBloodPressure(bpRecord) : { systolic: null, diastolic: null };
  const bp =
    typeof bpParsed.systolic === 'number' && typeof bpParsed.diastolic === 'number'
      ? `${Math.round(bpParsed.systolic)}/${Math.round(bpParsed.diastolic)}`
      : '—';

  const latestTimestamp = [hrRecord, spo2Record, tempRecord, bpRecord]
    .map((item) => item?.recorded_at ?? null)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];

  return {
    hr: Math.round(hr),
    spo2: Math.round(spo2),
    temp: Number(temp.toFixed(1)),
    bp,
    bpSeries,
    lastSync: formatRelativeSync(latestTimestamp),
  };
}

function getUIMood(vitals: LiveVitals, alerts: InsightAlert[], score: number): UIMood {
  const systolic = parseInt(String(vitals.bp ?? '0/0').split('/')[0] ?? '0', 10);

  if (
    alerts.some((a) => a.severity === 'critical' || a.severity === 'high') ||
    (hasLiveVitalData(vitals) &&
      (vitals.spo2 < 94 || vitals.hr > 112 || vitals.hr < 52 || systolic > 145)) ||
    score < 62
  ) {
    return 'alert';
  }

  if (
    alerts.length > 0 ||
    (hasLiveVitalData(vitals) &&
      (vitals.spo2 < 96 || vitals.hr > 96 || vitals.hr < 58)) ||
    score < 78
  ) {
    return 'watchful';
  }

  return 'calm';
}

function getMoodTheme(mood: UIMood) {
  if (mood === 'alert') {
    return {
      pageGlow:
        'before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_18%_0%,rgba(251,113,133,0.09),transparent_34%),radial-gradient(circle_at_100%_10%,rgba(244,114,182,0.07),transparent_26%)] before:pointer-events-none before:-z-10',
      heroTint: 'from-rose-50/70 via-white/92 to-orange-50/45',
      heroRingGlow: 'bg-[radial-gradient(circle_at_center,rgba(251,113,133,0.10),transparent_65%)]',
      badge: 'border-rose-200 bg-rose-50 text-rose-700',
      softCard: 'from-rose-50/55 to-white',
      accentText: 'text-rose-700',
      accentChip: 'border-rose-200 bg-rose-50/90 text-rose-700',
      signalTitle: 'Elevated attention mode',
      signalBody: 'A few important signals deserve closer review and tighter follow-through today.',
    };
  }

  if (mood === 'watchful') {
    return {
      pageGlow:
        'before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_18%_0%,rgba(245,158,11,0.07),transparent_34%),radial-gradient(circle_at_100%_10%,rgba(34,211,238,0.05),transparent_26%)] before:pointer-events-none before:-z-10',
      heroTint: 'from-amber-50/65 via-white/92 to-cyan-50/40',
      heroRingGlow: 'bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.10),transparent_65%)]',
      badge: 'border-amber-200 bg-amber-50 text-amber-700',
      softCard: 'from-amber-50/45 to-white',
      accentText: 'text-amber-700',
      accentChip: 'border-amber-200 bg-amber-50/90 text-amber-700',
      signalTitle: 'Watchful mode',
      signalBody: 'Your overall picture is steady, with a few signals worth keeping in closer view.',
    };
  }

  return {
    pageGlow:
      'before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_20%_0%,rgba(99,102,241,0.06),transparent_40%),radial-gradient(circle_at_100%_10%,rgba(34,211,238,0.06),transparent_24%)] before:pointer-events-none before:-z-10',
    heroTint: 'from-cyan-50/55 via-white/94 to-indigo-50/42',
    heroRingGlow: 'bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.10),transparent_65%)]',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    softCard: 'from-cyan-50/35 to-white',
    accentText: 'text-cyan-700',
    accentChip: 'border-cyan-200 bg-cyan-50/90 text-cyan-700',
    signalTitle: 'Calm mode',
    signalBody: 'Your health picture looks stable and organised, with no major friction in the care journey right now.',
  };
}

function OrbitalRing({ score, mood }: { score: number; mood: UIMood }) {
  const label = getRecoveryLabel(score);

  const badgeClasses =
    mood === 'alert'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : mood === 'watchful'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  return (
    <div className="relative flex h-[260px] w-[260px] items-center justify-center sm:h-[300px] sm:w-[300px] xl:h-[320px] xl:w-[320px]">
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400/16 via-indigo-400/12 to-fuchsia-400/16 blur-3xl"
        animate={{ scale: [1, 1.035, 1], opacity: [0.55, 0.85, 0.55] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="pointer-events-none absolute inset-[8%] rounded-full border border-cyan-300/35"
        animate={{ rotate: 360 }}
        transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="pointer-events-none absolute inset-[18%] rounded-full border border-fuchsia-300/22"
        animate={{ rotate: -360 }}
        transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
      />
      <div className="relative z-10 flex h-[67%] w-[67%] flex-col items-center justify-center rounded-full border border-white/75 bg-white/92 shadow-[0_24px_80px_rgba(59,130,246,0.10)] backdrop-blur-xl">
        <div className="text-[10px] font-medium uppercase tracking-[0.3em] text-slate-400 sm:text-[11px]">
          Recovery index
        </div>
        <div className="mt-2 bg-gradient-to-br from-slate-900 via-indigo-700 to-cyan-600 bg-clip-text text-5xl font-semibold text-transparent sm:text-6xl">
          {score}
        </div>
        <div className={cn('mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium', badgeClasses)}>
          <CheckCircle2 className="h-4 w-4" />
          {label}
        </div>
        <div className="mt-3 px-5 text-center text-[11px] leading-5 text-slate-500">
          Continuously shaped by preferred telemetry, adherence and live care signals
        </div>
      </div>
    </div>
  );
}

function GlassPanel({
  title,
  eyebrow,
  children,
  action,
  className,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(SURFACE, 'p-5 md:p-6', className)}>
      <div className="relative z-10">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {eyebrow ? (
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                {eyebrow}
              </div>
            ) : null}
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900 md:text-xl">
              {title}
            </h2>
          </div>
          {action}
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  tone = 'slate',
}: {
  icon: React.ElementType;
  title: string;
  body: string;
  action?: React.ReactNode;
  tone?: 'slate' | 'emerald' | 'indigo' | 'cyan';
}) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white text-emerald-700'
      : tone === 'indigo'
        ? 'border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white text-indigo-700'
        : tone === 'cyan'
          ? 'border-cyan-100 bg-gradient-to-br from-cyan-50/80 to-white text-cyan-700'
          : 'border-slate-200 bg-gradient-to-br from-white to-slate-50 text-slate-700';

  return (
    <div className={cn('rounded-[28px] border p-5 shadow-sm', toneClass)}>
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/72 bg-white/84 shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-base font-semibold text-slate-900">{title}</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
          {action ? <div className="mt-4">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [liveVitals, setLiveVitals] = useState<LiveVitals>(EMPTY_VITALS);

  const [nextAppointment, setNextAppointment] = useState({
    when: 'Plan next consultation',
    with: 'Your care team',
    status: 'Not scheduled',
  });
  const [deviceCount, setDeviceCount] = useState<number>(0);
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<InsightAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [meds, setMeds] = useState<MedLike[]>([]);
  const [cases, setCases] = useState<CaseLike[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        setProfileLoading(true);
        const res = await fetch('/api/profile', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));

        if (!cancelled) {
          setProfile(data?.ok === false ? null : data);
        }
      } catch {
        if (!cancelled) {
          setProfile(null);
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAlerts() {
      try {
        setAlertsLoading(true);
        setAlertsError(null);

        const res = await fetch('/api/insightcore/alerts?limit=3', { cache: 'no-store' });
        const data = await res.json().catch(() => ({ alerts: [] }));
        if (cancelled) return;

        const incoming = (data.alerts || []) as Array<Record<string, unknown>>;
        const mapped: InsightAlert[] = incoming.slice(0, 3).map((alert, idx) => ({
          id: String(alert.id || idx),
          title: String(alert.title || 'InsightCore alert'),
          message: String(alert.message || alert.note || 'A care signal is ready for review.'),
          severity: (alert.severity as AlertSeverity) || 'moderate',
          ts: String(alert.ts || alert.timestamp || new Date().toISOString()),
        }));

        setAlerts(mapped);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load patient alerts', error);
        setAlertsError(
          'InsightCore alert refresh was not completed. The dashboard is showing the current care state available to this session.',
        );
        setAlerts([]);
      } finally {
        if (!cancelled) setAlertsLoading(false);
      }
    }

    loadAlerts();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDevices() {
      try {
        const res = await fetch('/api/devices/list', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!cancelled) {
          setDeviceCount(normalizeDevicesCount(data));
        }
      } catch {
        if (!cancelled) {
          setDeviceCount(0);
        }
      }
    }

    loadDevices();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const patientId = typeof profile?.patientId === 'string' ? profile.patientId : '';
    if (!patientId) return;
    const encodedPatientId = encodeURIComponent(patientId);

    let cancelled = false;

    async function loadAppointment() {
      try {
        const res = await fetch(
          `${GATEWAY}/api/appointments?patientId=${encodedPatientId}`,
          { cache: 'no-store' },
        );

        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        const items = normalizeAppointments(data);
        const next = items[0];

        if (next) {
          setNextAppointment({
            when: formatHumanDateTime(next.startsAt),
            with: next.clinicianName || 'Your clinician',
            status: next.status,
          });
        } else {
          setNextAppointment({
            when: 'Plan next consultation',
            with: 'Your care team',
            status: 'Not scheduled',
          });
        }
      } catch {
        if (!cancelled) {
          setNextAppointment({
            when: 'Plan next consultation',
            with: 'Your care team',
            status: 'Not scheduled',
          });
        }
      }
    }

    loadAppointment();

    return () => {
      cancelled = true;
    };
  }, [profile?.patientId]);

  useEffect(() => {
    const patientId = typeof profile?.patientId === 'string' ? profile.patientId : '';
    if (!patientId) {
      setLiveVitals(EMPTY_VITALS);
      return;
    }
    const encodedPatientId = encodeURIComponent(patientId);

    let cancelled = false;

    async function loadVitals() {
      try {
        const res = await fetch(
          `/api/v1/patients/${encodedPatientId}/vitals`,
          { cache: 'no-store' },
        );
        const data = await res.json().catch(() => ({ items: [] }));
        if (cancelled) return;

        const items = Array.isArray(data?.items) ? (data.items as RawVitalRecord[]) : [];
        setLiveVitals(resolveVitals(items));
      } catch {
        if (!cancelled) {
          setLiveVitals(EMPTY_VITALS);
        }
      }
    }

    loadVitals();

    return () => {
      cancelled = true;
    };
  }, [profile?.patientId]);

  useEffect(() => {
    const patientId = typeof profile?.patientId === 'string' ? profile.patientId : '';
    if (!patientId) {
      setMeds([]);
      setCases([]);
      return;
    }
    const encodedPatientId = encodeURIComponent(patientId);

    let cancelled = false;

    async function loadPatientLists() {
      try {
        const [medicationsRes, casesRes] = await Promise.allSettled([
          fetch(`/api/medications?patientId=${encodedPatientId}`, { cache: 'no-store' }),
          fetch(`/api/cases?patientId=${encodedPatientId}`, { cache: 'no-store' }),
        ]);

        if (cancelled) return;

        if (medicationsRes.status === 'fulfilled' && medicationsRes.value.ok) {
          const medicationsJson = await medicationsRes.value.json().catch(() => ({}));
          if (!cancelled) setMeds(normalizeMedications(medicationsJson));
        } else {
          setMeds([]);
        }

        if (casesRes.status === 'fulfilled' && casesRes.value.ok) {
          const casesJson = await casesRes.value.json().catch(() => ({}));
          if (!cancelled) setCases(normalizeCases(casesJson));
        } else {
          setCases([]);
        }
      } catch {
        if (!cancelled) {
          setMeds([]);
          setCases([]);
        }
      }
    }

    loadPatientLists();

    return () => {
      cancelled = true;
    };
  }, [profile?.patientId]);

  useEffect(() => {
    let cancelled = false;

    async function loadAiGuidance() {
      try {
        const res = await fetch('/api/insightcore/analyze', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            patientName: profile?.name ?? 'patient',
            vitals: hasLiveVitalData(liveVitals)
              ? {
                  hr: liveVitals.hr,
                  bp: liveVitals.bp,
                  temp: liveVitals.temp,
                  spo2: liveVitals.spo2,
                }
              : null,
            chronicConditions: profile?.chronicConditions ?? [],
            alertCount: alerts.length,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!cancelled) {
          const msgs = normalizeAiMessages(data);
          setAiInsights(
            msgs.length > 0
              ? msgs
              : [
                  'Your care profile is ready for richer guidance as new readings and care activity are added.',
                  'Keep supported devices synced so InsightCore can provide stronger recommendations.',
                ],
          );
        }
      } catch {
        if (!cancelled) {
          setAiInsights([
            'Your care profile is ready for richer guidance as new readings and care activity are added.',
            'Keep supported devices synced so InsightCore can provide stronger recommendations.',
          ]);
        }
      }
    }

    loadAiGuidance();

    return () => {
      cancelled = true;
    };
  }, [
    profile?.name,
    profile?.chronicConditions,
    liveVitals.hr,
    liveVitals.bp,
    liveVitals.temp,
    liveVitals.spo2,
    alerts.length,
  ]);

  const patientName = useMemo(() => {
    const raw = profile?.name?.trim();
    if (!raw) return profileLoading ? 'Welcome' : 'Patient';
    return raw.split(' ')[0];
  }, [profile?.name, profileLoading]);

  const allergies: Allergy[] = useMemo(() => {
    const fromProfile = Array.isArray(profile?.allergies) ? profile.allergies : [];
    return fromProfile.map(
      (name) =>
        ({
          name,
          status: 'Active',
          severity: 'mild',
        }) as Allergy,
    );
  }, [profile?.allergies]);

  const adherencePct = useMemo(() => {
    if (!Array.isArray(meds) || meds.length === 0) return 100;
    const taken = meds.filter((m) => m?.status === 'Completed').length;
    return Math.round((taken / meds.length) * 100);
  }, [meds]);

  const adherenceSeries = useMemo(() => [82, 86, 89, 87, 91, 94, adherencePct], [adherencePct]);

  const todaysPills: Pill[] = useMemo(
    () =>
      meds.slice(0, 4).map((m, index) => ({
        id: deriveStablePillId(m, index),
        name: m.name ?? 'Medication',
        dose: m.dose ?? '',
        time: m.time ?? '',
        status: (m.status === 'Completed' ? 'Taken' : 'Pending') as Pill['status'],
      })),
    [meds],
  );

  const medicationBlockItems: MedicationBlockItem[] = useMemo(
    () =>
      meds.map((m, index) => ({
        id: deriveStablePillId(m, index),
        name: typeof m.name === 'string' && m.name.trim() ? m.name.trim() : 'Medication',
        dose: m.dose,
        status: m.status,
        orderId: m.orderId ?? null,
      })),
    [meds],
  );

  const recentCases = Array.isArray(cases) ? cases.slice(0, 3) : [];
  const recentClinicians: Clinician[] = [];

  const recoveryScore = useMemo(
    () => computeRecoveryScore(liveVitals, adherencePct, alerts.length),
    [liveVitals, adherencePct, alerts.length],
  );

  const heroNarrative = useMemo(
    () => getRecoveryNarrative(recoveryScore, liveVitals, adherencePct),
    [recoveryScore, liveVitals, adherencePct],
  );

  const priorityAction = useMemo(
    () => getPriorityAction({ alerts, adherencePct, nextAppointment }),
    [alerts, adherencePct, nextAppointment],
  );

  const uiMood = useMemo(
    () => getUIMood(liveVitals, alerts, recoveryScore),
    [liveVitals, alerts, recoveryScore],
  );

  const moodTheme = useMemo(() => getMoodTheme(uiMood), [uiMood]);

  const insightHighlights = useMemo(() => {
    const lines: string[] = [];

    lines.push(
      hasLiveVitalData(liveVitals)
        ? `${getRecoveryLabel(recoveryScore)} recovery posture`
        : 'Telemetry ready for first sync',
    );
    lines.push(`${deviceCount} active device${deviceCount === 1 ? '' : 's'}`);
    lines.push(
      nextAppointment.status === 'Not scheduled'
        ? 'Care planning ready'
        : `Next consultation ${nextAppointment.when}`,
    );

    return lines.slice(0, 3);
  }, [recoveryScore, deviceCount, nextAppointment, liveVitals]);

  const chartVitals = useMemo(
    () =>
      ({
        ...liveVitals,
        temp: liveVitals.temp > 0 ? liveVitals.temp.toFixed(1) : '',
        bpSeries: liveVitals.bpSeries,
      }) as Vitals & { bpSeries?: BpPoint[] },
    [liveVitals],
  );

  return (
    <main
      className={cn(
        'relative isolate min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.14),_transparent_24%),linear-gradient(180deg,_#f8fbff_0%,_#eef5ff_42%,_#f8faff_100%)] px-4 pb-12 pt-4 md:px-6 md:pb-14 md:pt-6 lg:px-8',
        moodTheme.pageGlow,
      )}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-50">
        <div className="absolute left-[-12%] top-[-8%] h-[420px] w-[420px] rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="absolute right-[-8%] top-[10%] h-[360px] w-[360px] rounded-full bg-fuchsia-300/15 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[18%] h-[300px] w-[300px] rounded-full bg-indigo-300/10 blur-3xl" />
      </div>

      <div className="relative z-0 mx-auto flex w-full max-w-[1600px] flex-col gap-5 md:gap-6">
        <RecentActivityStrip patientId={profile?.patientId ?? null} />

        <motion.section {...sectionMotion} className={cn(SURFACE, 'bg-gradient-to-br p-5 md:p-8 xl:p-10', moodTheme.heroTint)}>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.46),rgba(255,255,255,0.10))]" />
          <div className={cn('pointer-events-none absolute inset-0 opacity-70', moodTheme.heroRingGlow)} />
          <div className="pointer-events-none absolute right-0 top-0 h-56 w-56 rounded-full bg-cyan-300/8 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-[20%] h-56 w-56 rounded-full bg-indigo-400/8 blur-3xl" />

          <div className="relative z-10 grid gap-8 xl:grid-cols-[1.12fr_0.88fr] xl:items-center">
            <div className="relative z-10">
              <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] shadow-sm', moodTheme.badge)}>
                <ScanHeart className="h-4 w-4" />
                Ambulant+ Daily Health Brief
              </div>

              <div className="mt-5 max-w-3xl">
                <p className="text-sm font-medium uppercase tracking-[0.28em] text-slate-400">
                  {getDayPart()}
                </p>
                <h1 className="mt-3 max-w-[720px] text-[2.2rem] font-semibold leading-[0.98] tracking-[-0.04em] text-slate-900 sm:text-[2.75rem] md:text-[3.05rem] xl:text-[3.7rem]">
                  {patientName}, your care journey feels calm, connected, and under control today.
                </h1>
                <p className="mt-5 max-w-2xl text-[15px] leading-7 text-slate-500 md:text-lg">
                  {heroNarrative}
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium', moodTheme.accentChip)}>
                  <Sparkles className="h-3.5 w-3.5" />
                  {moodTheme.signalTitle}
                </div>
                <div className="text-sm text-slate-500">{moodTheme.signalBody}</div>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                <motion.div
                  whileHover={{ y: -3 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                  className="rounded-3xl border border-white/72 bg-white/90 p-4 shadow-sm"
                >
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    <Waves className="h-4 w-4 text-cyan-600" />
                    Live sync
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-slate-900">{liveVitals.lastSync}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    Latest telemetry reflected across your health overview.
                  </div>
                </motion.div>

                <motion.div
                  whileHover={{ y: -3 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                  className="rounded-3xl border border-white/68 bg-white/84 p-4 shadow-sm"
                >
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    <CalendarDays className="h-4 w-4 text-indigo-600" />
                    Next care step
                  </div>
                  <div className="mt-3 text-lg font-semibold leading-6 text-slate-900">
                    {nextAppointment.when}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">{nextAppointment.with}</div>
                </motion.div>

                <motion.div
                  whileHover={{ y: -3 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                  className={cn(
                    'rounded-3xl border bg-gradient-to-br p-4 shadow-sm',
                    toneClasses(priorityAction.tone),
                  )}
                >
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <Bell className="h-4 w-4" />
                    Priority focus
                  </div>
                  <div className="mt-3 text-lg font-semibold text-slate-900">
                    {priorityAction.title}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">{priorityAction.body}</div>
                </motion.div>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <motion.div whileHover={{ scale: 1.02, y: -2 }} transition={{ type: 'spring', stiffness: 220, damping: 18 }}>
                  <Link
                    href="/vitals"
                    className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white shadow-[0_14px_30px_rgba(15,23,42,0.18)]"
                  >
                    Open health overview
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </motion.div>

                <motion.div whileHover={{ scale: 1.01, y: -2 }} transition={{ type: 'spring', stiffness: 220, damping: 18 }}>
                  <Link
                    href="/appointments"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/92 px-5 py-3 text-sm font-medium text-slate-700 shadow-sm"
                  >
                    Manage appointments
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </motion.div>

                <motion.div whileHover={{ scale: 1.01, y: -2 }} transition={{ type: 'spring', stiffness: 220, damping: 18 }}>
                  <Link
                    href="/find-doctor"
                    className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50/90 px-5 py-3 text-sm font-medium text-cyan-700 shadow-sm"
                  >
                    Find a clinician
                    <Stethoscope className="h-4 w-4" />
                  </Link>
                </motion.div>
              </div>
            </div>

            <div className="relative z-10 flex items-center justify-center xl:justify-end">
              <div className="relative w-full max-w-[440px] rounded-[40px] border border-white/72 bg-white/74 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-6">
                <div className="pointer-events-none absolute inset-0 rounded-[40px] bg-gradient-to-b from-transparent to-slate-100/35" />
                <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent" />

                <div className="relative z-10 mb-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.24em] text-slate-400">
                  <span>Adaptive care radar</span>
                  <span>{getRecoveryLabel(recoveryScore)}</span>
                </div>

                <div className="relative z-10 flex justify-center items-center pt-2 pb-4">
                  <OrbitalRing score={recoveryScore} mood={uiMood} />
                </div>

                <div className="relative z-10 mt-1 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-white/76 bg-white/84 p-3 text-center shadow-sm">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      SpO₂
                    </div>
                    <div className="mt-2 text-xl font-semibold text-slate-900">
                      {displayVitalNumber(liveVitals.spo2, '%')}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/76 bg-white/84 p-3 text-center shadow-sm">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      Pulse
                    </div>
                    <div className="mt-2 text-xl font-semibold text-slate-900">
                      {displayVitalNumber(liveVitals.hr)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/76 bg-white/84 p-3 text-center shadow-sm">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      BP
                    </div>
                    <div className="mt-2 text-xl font-semibold text-slate-900">
                      {displayBp(liveVitals.bp)}
                    </div>
                  </div>
                </div>

                <div className="relative z-10 mt-4 rounded-[24px] border border-white/72 bg-white/82 p-4 shadow-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    InsightCore visible intelligence
                  </div>
                  <div className="mt-3 grid gap-2">
                    {insightHighlights.map((line) => (
                      <div key={line} className="flex items-start gap-2 text-sm text-slate-600">
                        <span className={cn('mt-[7px] h-1.5 w-1.5 rounded-full', uiMood === 'alert' ? 'bg-rose-500' : uiMood === 'watchful' ? 'bg-amber-500' : 'bg-cyan-500')} />
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section {...sectionMotion} transition={{ duration: 0.42, delay: 0.05 }}>
          <div className="relative z-10 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className={cn(SURFACE, 'p-5 md:p-6')}>
              <div className="relative z-10">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                      Today at a glance
                    </div>
                    <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                      Your strongest health signals right now
                    </h2>
                  </div>
                  <Link href="/insights" className="text-sm font-medium text-indigo-600">
                    View full intelligence
                  </Link>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    {
                      icon: HeartPulse,
                      label: 'Recovery index',
                      value: `${recoveryScore}/100`,
                      subtext: hasLiveVitalData(liveVitals)
                        ? 'Balanced by preferred-source vitals, adherence and live care activity'
                        : 'Currently estimated from available adherence, alerts and connected-care activity',
                    },
                    {
                      icon: TrendingUp,
                      label: 'Medication adherence',
                      value: `${adherencePct}%`,
                      subtext: 'Consistency remains one of your strongest controllable levers',
                    },
                    {
                      icon: Shield,
                      label: 'Care confidence',
                      value: alerts.length
                        ? `${alerts.length} active alert${alerts.length > 1 ? 's' : ''}`
                        : 'No active alerts',
                      subtext: 'Escalations are continuously monitored by your care rules',
                    },
                  ].map((item) => (
                    <motion.div
                      key={item.label}
                      {...hoverLift}
                      className={cn('rounded-[26px] border bg-gradient-to-br p-5 shadow-sm', uiMood === 'alert' ? 'from-rose-50/30 to-white border-white/76' : uiMood === 'watchful' ? 'from-amber-50/30 to-white border-white/76' : 'from-white to-slate-50 border-white/76')}
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 shadow-sm">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div className="mt-4 text-sm font-medium text-slate-500">{item.label}</div>
                      <div className="mt-1 text-2xl font-semibold text-slate-900">{item.value}</div>
                      <div className="mt-2 text-sm leading-6 text-slate-600">
                        {item.subtext}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            <div className={cn(SURFACE, 'p-5 md:p-6')}>
              <div className="relative z-10">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                      Immediate next step
                    </div>
                    <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                      Your guided care priority
                    </h2>
                  </div>
                  <div className="rounded-full border border-white/70 bg-white/76 px-3 py-1 text-xs font-medium text-slate-500">
                    Updated continuously
                  </div>
                </div>

                <div
                  className={cn(
                    'rounded-[28px] border bg-gradient-to-br p-5 shadow-sm',
                    toneClasses(priorityAction.tone),
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-500">Recommended now</div>
                      <div className="mt-2 text-2xl font-semibold text-slate-900">
                        {priorityAction.title}
                      </div>
                      <div className="mt-3 max-w-lg text-sm leading-6 text-slate-600">
                        {priorityAction.body}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/88 p-3 shadow-sm">
                      <Bell className="h-5 w-5 text-slate-900" />
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <motion.div whileHover={{ scale: 1.02, y: -2 }} transition={{ type: 'spring', stiffness: 220, damping: 18 }}>
                      <Link
                        href={priorityAction.href}
                        className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white"
                      >
                        Take action
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.01, y: -2 }} transition={{ type: 'spring', stiffness: 220, damping: 18 }}>
                      <Link
                        href="/myCare"
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/88 px-5 py-3 text-sm font-medium text-slate-700"
                      >
                        Open myCare
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          {...sectionMotion}
          transition={{ duration: 0.42, delay: 0.1 }}
          className="relative z-10 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]"
        >
          <GlassPanel title="Attention needed" eyebrow="InsightCore">
            <div className="space-y-3">
              {alertsLoading && alerts.length === 0 ? (
                <EmptyState
                  icon={Waves}
                  title="Refreshing care signals"
                  body="InsightCore is checking your latest thresholds and care rules for this session."
                  tone="cyan"
                />
              ) : alerts.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="Care signals are clear"
                  body="Your monitored thresholds are currently within expected ranges. Continue your routine and keep supported devices synced."
                  tone="emerald"
                />
              ) : (
                alerts.map((alert) => (
                  <motion.div
                    key={alert.id}
                    {...hoverLift}
                    className="rounded-[24px] border border-white/76 bg-white/88 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-base font-semibold text-slate-900">
                            {alert.title}
                          </div>
                          <span
                            className={cn(
                              'rounded-full border px-2.5 py-1 text-[11px] font-medium',
                              severityChip(alert.severity),
                            )}
                          >
                            {severityLabel(alert.severity)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {alert.message}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 className="h-3.5 w-3.5" />
                            {formatTimestamp(alert.ts)}
                          </span>
                          <span>Monitored by your care thresholds</span>
                        </div>
                      </div>
                      <Link
                        href="/insights"
                        className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                      >
                        Review
                      </Link>
                    </div>
                  </motion.div>
                ))
              )}

              {alertsError ? <div className="text-sm text-rose-600">{alertsError}</div> : null}
            </div>
          </GlassPanel>

          <GlassPanel title="Upcoming care" eyebrow="Continuity">
            <div className="rounded-[26px] border border-indigo-100 bg-gradient-to-br from-indigo-50/90 to-cyan-50/70 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-500">
                    Scheduled consultation
                  </div>
                  <div className="mt-2 text-2xl font-semibold leading-8 text-slate-900">
                    {nextAppointment.when}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">{nextAppointment.with}</div>
                </div>
                <div className="rounded-2xl bg-white/88 p-3 shadow-sm">
                  <CalendarDays className="h-5 w-5 text-indigo-600" />
                </div>
              </div>
              <div className="mt-4 text-sm leading-6 text-slate-600">
                {nextAppointment.status === 'Not scheduled'
                  ? 'Choose a clinician or book a consultation when you are ready to continue your care pathway.'
                  : 'Bring your latest symptoms, medication questions, and device readings to make this consultation even more useful.'}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <motion.div whileHover={{ scale: 1.02, y: -2 }} transition={{ type: 'spring', stiffness: 220, damping: 18 }}>
                  <Link
                    href="/appointments"
                    className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white"
                  >
                    {nextAppointment.status === 'Not scheduled' ? 'Book appointment' : 'View appointment'}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </motion.div>
                <motion.div whileHover={{ scale: 1.01, y: -2 }} transition={{ type: 'spring', stiffness: 220, damping: 18 }}>
                  <Link
                    href="/reports"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/88 px-5 py-3 text-sm font-medium text-slate-700"
                  >
                    Open reports
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </motion.div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/72 bg-white/82 p-4">
                <div className="text-sm font-medium text-slate-500">Connected devices</div>
                <div className="mt-2 text-xl font-semibold text-slate-900">{deviceCount} active</div>
                <div className="mt-1 text-sm text-slate-600">
                  Your latest data is flowing into Ambulant+ and shaping insights in near
                  real time.
                </div>
              </div>
              <div className="rounded-2xl border border-white/72 bg-white/82 p-4">
                <div className="text-sm font-medium text-slate-500">Care readiness</div>
                <div className="mt-2 text-xl font-semibold text-slate-900">
                  {nextAppointment.status === 'Not scheduled' ? 'Ready to plan' : 'Prepared'}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Appointments, reports, and medication history are organised for your next
                  step.
                </div>
              </div>
            </div>
          </GlassPanel>
        </motion.section>

        <motion.section
          {...sectionMotion}
          transition={{ duration: 0.42, delay: 0.15 }}
          className="relative z-10 grid gap-4 2xl:grid-cols-[0.98fr_1.06fr_0.96fr] items-start"
        >
          <GlassPanel
            title="Today’s vitals"
            eyebrow="Live telemetry"
            action={
              <Link
                href="/vitals"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/88 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm"
              >
                Check today’s vitals
                <ChevronRight className="h-4 w-4" />
              </Link>
            }
          >
            {hasLiveVitalData(liveVitals) ? (
              <>
                <div className="grid gap-4 sm:grid-cols-3 mb-4">
                  <div className="rounded-[24px] border border-white/72 bg-gradient-to-br from-white to-slate-50 p-4">
                    <MiniMeterDonut value={liveVitals.hr} max={200} unit="bpm" label="Heart rate" />
                  </div>
                  <div className="rounded-[24px] border border-white/72 bg-gradient-to-br from-white to-slate-50 p-4">
                    <MiniMeterDonut
                      value={liveVitals.temp as number}
                      max={45}
                      unit="°C"
                      label="Temperature"
                    />
                  </div>
                  <div className="rounded-[24px] border border-white/72 bg-gradient-to-br from-white to-slate-50 p-4">
                    <MiniMeterDonut value={liveVitals.spo2} max={100} unit="%" label="SpO₂" />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['Heart Rate', displayVitalNumber(liveVitals.hr, ' bpm')],
                    ['Blood Pressure', displayBp(liveVitals.bp)],
                    ['Temperature', displayTemp(liveVitals.temp)],
                    ['Oxygen Saturation', displayVitalNumber(liveVitals.spo2, '%')],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-2xl border border-white/72 bg-white/82 px-4 py-3 text-sm"
                    >
                      <span className="text-slate-500">{label}</span>
                      <span className="font-semibold text-slate-900">{value}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-100 pt-4 mt-4">
                  <div className="rounded-[28px] border border-white/72 bg-white/82 p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium text-slate-900">Seven-day trend</div>
                        <div className="text-sm text-slate-500">
                          A quick visual read of how your recent vitals are moving.
                        </div>
                      </div>
                      <Link href="/vitals" className="text-sm font-medium text-indigo-600">
                        Open full vitals view
                      </Link>
                    </div>
                    <VitalsTrendChart vitals={chartVitals} />
                  </div>
                </div>
              </>
            ) : (
              <EmptyState
                icon={ScanHeart}
                title="Vitals workspace ready"
                body="Sync a supported Health Monitor reading to activate your live telemetry, trend chart, and InsightCore vitals summary."
                tone="cyan"
                action={
                  <Link
                    href="/myCare/devices"
                    className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm"
                  >
                    Manage devices
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                }
              />
            )}
          </GlassPanel>

          <GlassPanel
            title="Medication continuity"
            eyebrow="Treatment plan"
            action={
              <Link
                href="/medications"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/88 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm"
              >
                Manage medications
                <ChevronRight className="h-4 w-4" />
              </Link>
            }
          >
            <div className="grid gap-4 lg:grid-cols-[0.82fr_1.18fr]">
              <div className={cn('rounded-[28px] border bg-gradient-to-br p-4', uiMood === 'alert' ? 'border-rose-100 from-rose-50/55 to-white' : uiMood === 'watchful' ? 'border-amber-100 from-amber-50/55 to-white' : 'border-emerald-100 from-emerald-50/75 to-white')}>
                <div className="text-sm font-medium text-slate-500">Adherence profile</div>
                <div className="mt-3 flex items-center justify-center">
                  <MeterDonut
                    value={adherencePct}
                    max={100}
                    label="Adherence"
                    color="#10B981"
                    unit="%"
                  />
                </div>
                <div className="mt-3 text-sm leading-6 text-slate-600">
                  Staying on schedule is one of the fastest ways to keep your progress
                  steady and reduce avoidable escalations.
                </div>
                <div className="mt-4 rounded-2xl border border-white/72 bg-white/84 p-3">
                  <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                    Trend
                  </div>
                  <div className="mt-2">
                    <Sparkline
                      values={adherenceSeries}
                      labels={adherenceSeries.map((_, index) => `Day ${index + 1}`)}
                      height={72}
                      color="#10B981"
                      unit="%"
                      decimals={0}
                      showArea
                      showLastValueBadge={false}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/72 bg-white/82 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-900">
                  <Syringe className="h-4 w-4 text-emerald-600" />
                  Today’s medication schedule
                </div>

                <PillRemindersWrapper pills={todaysPills} />

                <div className="mt-4 border-t border-slate-100 pt-4">
                  <MedicationsBlockWrapper initialMeds={medicationBlockItems} />
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
                  <div className="rounded-[24px] border border-white/72 bg-white/84 p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                          Vitals summary
                        </div>
                        <div className="mt-1 text-base font-semibold text-slate-900">
                          InsightCore summary
                        </div>
                      </div>
                      <div className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[10px] font-medium text-indigo-700">
                        {liveVitals.lastSync}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-3">
                        <div className="text-slate-400">Pulse</div>
                        <div className="mt-1 font-semibold text-slate-900">{displayVitalNumber(liveVitals.hr, ' bpm')}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-3">
                        <div className="text-slate-400">SpO₂</div>
                        <div className="mt-1 font-semibold text-slate-900">{displayVitalNumber(liveVitals.spo2, '%')}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-3">
                        <div className="text-slate-400">BP</div>
                        <div className="mt-1 font-semibold text-slate-900">{displayBp(liveVitals.bp)}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-3">
                        <div className="text-slate-400">Temp</div>
                        <div className="mt-1 font-semibold text-slate-900">{displayTemp(liveVitals.temp)}</div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <Link
                        href="/insights"
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm"
                      >
                        Open summary
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-indigo-100 bg-indigo-50/60 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      <Sparkles className="h-4 w-4 text-indigo-600" />
                      AI guidance
                    </div>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                      {aiInsights.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel title="Longitudinal care" eyebrow="History & safety">
            <div className="space-y-4">
              <div className="rounded-[24px] border border-white/72 bg-white/82 p-4">
                <div className="mb-3 text-sm font-medium text-slate-900">
                  Allergies and risk notes
                </div>
                {allergies.length > 0 ? (
                  <AllergiesBlockWrapper allergies={allergies} />
                ) : (
                  <EmptyState
                    icon={Shield}
                    title="Allergy profile ready"
                    body="Add confirmed allergies and intolerance notes so every consultation starts with a safer clinical context."
                    tone="indigo"
                  />
                )}
              </div>

              <div className="rounded-[24px] border border-white/72 bg-white/82 p-4">
                <div className="mb-3 text-sm font-medium text-slate-900">
                  Recent reports and intelligence
                </div>
                <ReportsBlockWrapper />
              </div>
            </div>
          </GlassPanel>
        </motion.section>

        <motion.section
          {...sectionMotion}
          transition={{ duration: 0.42, delay: 0.2 }}
          className="relative z-10"
        >
          <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
            <GlassPanel title="Recent encounters" eyebrow="Care continuity">
              {recentCases.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="Encounter timeline ready"
                  body="Completed consultations will appear here with timing, status, and follow-up direction as your care history grows."
                  tone="indigo"
                />
              ) : (
                <div className="space-y-3">
                  {recentCases.map((item, index) => (
                    <motion.div
                      key={item.id ?? index}
                      {...hoverLift}
                      className="rounded-[24px] border border-white/76 bg-white/88 p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-base font-semibold text-slate-900">
                            {item.title ?? `Encounter ${item.id ?? index + 1}`}
                          </div>
                          <div className="mt-2 text-sm text-slate-500">
                            Updated {formatTimestamp(item.updatedAt)}
                          </div>
                          {item.latestEncounter?.start ? (
                            <div className="mt-2 text-sm text-slate-600">
                              Most recent interaction:{' '}
                              {formatTimestamp(item.latestEncounter.start)}
                            </div>
                          ) : null}
                        </div>
                        <span
                          className={cn(
                            'rounded-full px-3 py-1 text-xs font-medium',
                            item.status === 'Open'
                              ? 'bg-emerald-100 text-emerald-700'
                              : item.status === 'Referred'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-700',
                          )}
                        >
                          {item.status ?? 'Updated'}
                        </span>
                      </div>
                      <div className="mt-4">
                        <Link
                          href="/encounters"
                          className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600"
                        >
                          Open encounter details
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </GlassPanel>

            <GlassPanel title="Your care network" eyebrow="People around you">
              {recentClinicians.length === 0 ? (
                <EmptyState
                  icon={Stethoscope}
                  title="Care network ready"
                  body="Linked clinicians will appear here once your care relationships are connected and active."
                  tone="cyan"
                  action={
                    <Link
                      href="/find-doctor"
                      className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm"
                    >
                      Find a clinician
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  }
                />
              ) : (
                <div className="grid gap-3">
                  {recentClinicians.map((clinician, index) => (
                    <motion.div
                      key={`${clinician.name}-${index}`}
                      {...hoverLift}
                      className="rounded-[24px] border border-white/76 bg-white/88 p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-base font-semibold text-slate-900">
                            {clinician.name}
                          </div>
                          <div className="mt-1 text-sm text-slate-500">
                            {clinician.specialty}
                          </div>
                          <div className="mt-2 text-sm text-slate-600">
                            {clinician.location}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-slate-100 p-3">
                          <Activity className="h-5 w-5 text-slate-700" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              <div className="mt-4 rounded-[24px] border border-cyan-100 bg-cyan-50/60 p-4">
                <div className="text-sm font-medium text-slate-900">
                  Care is easier when everything is connected
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-600">
                  Ambulant+ keeps your vitals, appointments, reports, alerts, and clinicians
                  in one place so every next action feels clearer.
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <motion.div whileHover={{ scale: 1.02, y: -2 }} transition={{ type: 'spring', stiffness: 220, damping: 18 }}>
                    <Link
                      href="/find-doctor"
                      className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white"
                    >
                      Find care
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.01, y: -2 }} transition={{ type: 'spring', stiffness: 220, damping: 18 }}>
                    <Link
                      href="/myCare/devices"
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/88 px-5 py-3 text-sm font-medium text-slate-700"
                    >
                      Manage devices
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </motion.div>
                </div>
              </div>
            </GlassPanel>
          </div>
        </motion.section>

        <motion.section
          {...sectionMotion}
          transition={{ duration: 0.42, delay: 0.25 }}
          className="relative z-10"
        >
          <div className="grid gap-4 md:grid-cols-4">
            {[
              {
                label: 'Auto Triage',
                body: 'Get guided symptom intake and a smarter starting point before care escalation.',
                href: '/auto-triage',
              },
              {
                label: 'myCare',
                body: 'Keep your ongoing care journey, history, notes, and follow-ups aligned.',
                href: '/myCare',
              },
              {
                label: 'Reports',
                body: 'Open the evidence behind your trends, consultations, and AI-generated observations.',
                href: '/reports',
              },
              {
                label: 'Appointments',
                body: 'Stay on time, prepared, and in control of your next clinical conversation.',
                href: '/appointments',
              },
            ].map((item) => (
              <motion.div
                key={item.label}
                whileHover={{ y: -4, scale: 1.01 }}
                transition={{ type: 'spring', stiffness: 220, damping: 18 }}
              >
                <Link
                  href={item.href}
                  className="group block rounded-[28px] border border-white/64 bg-white/78 p-5 shadow-sm backdrop-blur-xl"
                >
                  <div className="text-lg font-semibold tracking-tight text-slate-900">{item.label}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">{item.body}</div>
                  <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-indigo-600">
                    Open module
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <div className="sr-only" aria-live="polite">
          {alertsLoading ? 'Refreshing alerts' : `${alerts.length} active alerts loaded`}
        </div>
      </div>
    </main>
  );
}