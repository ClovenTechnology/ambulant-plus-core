//apps/patient-app/app/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Bell,
  BrainCircuit,
  CalendarDays,
  ChevronRight,
  HeartPulse,
  ScanHeart,
  Shield,
  Stethoscope,
  Syringe,
  TrendingUp,
  Waves,
} from 'lucide-react';

import type { BpPoint } from '../components/charts/BpChart';
import { pickPreferredVital, type VitalsType } from '@/src/lib/vitals';

type AlertSeverity = 'low' | 'moderate' | 'high' | 'critical';
type CareState = 'stable' | 'watch' | 'action_required' | 'critical' | 'insufficient';
type Freshness = 'live' | 'recent' | 'stale' | 'offline' | 'none';
type MeshState = 'live' | 'recent' | 'ready' | 'offline' | 'available' | 'processing';

type InsightAlert = {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  ts: string | null;
};

type MedLike = {
  id?: string;
  orderId?: string;
  name?: string;
  dose?: string;
  time?: string;
  status?: string;
};

type CaseLike = {
  id?: string;
  title?: string;
  status?: string;
  updatedAt?: string;
  latestEncounter?: { start?: string };
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

type AppointmentState = {
  id?: string;
  startsAt?: string;
  when: string;
  with: string;
  status: string;
};

type AdherencePoint = {
  label: string;
  value: number;
  ts?: string;
};

type VitalInterpretationStatus = 'ACTIVE' | 'SUSPECT' | 'EXCLUDED';
type VitalTimeAuthority = 'SOURCE_REPORTED' | 'SERVER_RECEIVED_FALLBACK' | 'UNSPECIFIED';

type RawVitalRecord = {
  id?: string;
  patientId?: string;
  deviceId?: string | null;
  type?: string;
  vType?: string;
  value?: number | string | null;
  valueNum?: number | string | null;
  unit?: string | null;
  t?: string | null;
  recorded_at?: string | null;
  observationId?: string | null;
  receivedAt?: string | null;
  timeAuthority?: VitalTimeAuthority | string | null;
  interpretationStatus?: VitalInterpretationStatus | string | null;
  statusReasonCode?: string | null;
  statusReasonText?: string | null;
  statusChangedAt?: string | null;
  payload?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
};

type VitalTrustSnapshot = {
  observationId: string | null;
  timeAuthority: VitalTimeAuthority | string | null;
  interpretationStatus: VitalInterpretationStatus | string | null;
  statusReasonCode: string | null;
  statusReasonText: string | null;
};

type VitalKey = 'hr' | 'spo2' | 'temp' | 'bp';

type LiveVitals = {
  hr: number;
  bp: string;
  temp: number;
  spo2: number;
  bpSeries: BpPoint[];
  latestAt: string | null;
  recordedAt: Record<VitalKey, string | null>;
  source: Record<VitalKey, string | null>;
  trust: Record<VitalKey, VitalTrustSnapshot | null>;
};

type ECGSnapshot = {
  samples: number[];
  recordedAt: string | null;
  source: string;
};

type DeviceLike = {
  id: string;
  name: string;
  status: string;
  lastSync: string | null;
  battery: number | null;
  signalQuality: string | null;
};

type CareJourneyEvent = {
  id: string;
  label: string;
  detail: string;
  ts: string | null;
  href?: string;
  kind: 'telemetry' | 'alert' | 'care' | 'appointment' | 'treatment';
};

type MeshNode = {
  id: string;
  label: string;
  detail: string;
  state: MeshState;
  href: string;
  icon: React.ElementType;
};

const EMPTY_VITALS: LiveVitals = {
  hr: 0,
  bp: '—',
  temp: 0,
  spo2: 0,
  bpSeries: [],
  latestAt: null,
  recordedAt: { hr: null, spo2: null, temp: null, bp: null },
  source: { hr: null, spo2: null, temp: null, bp: null },
  trust: { hr: null, spo2: null, temp: null, bp: null },
};

const ZA_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-ZA', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const ZA_SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('en-ZA', {
  day: '2-digit',
  month: 'short',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('en-ZA', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
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

function formatTimestamp(value?: string | null) {
  if (!value) return 'No timestamp';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No timestamp';
  return ZA_DATE_TIME_FORMATTER.format(date);
}

function formatTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return TIME_FORMATTER.format(date);
}

function formatHumanDateTime(value?: string) {
  if (!value) return 'Plan next consultation';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return ZA_DATE_TIME_FORMATTER.format(date);
}

function formatRelativeSync(value?: string | null) {
  if (!value) return 'No current data';
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return 'No current data';

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
    (typeof vitals.bp === 'string' && /^\d+\/\d+/.test(vitals.bp)) ||
    vitals.bpSeries.length > 0
  );
}

function isCurrentFreshness(freshness: Freshness) {
  return freshness === 'live' || freshness === 'recent';
}

function hasVitalValue(vitals: LiveVitals, key: VitalKey) {
  if (key === 'hr') return vitals.hr > 0;
  if (key === 'spo2') return vitals.spo2 > 0;
  if (key === 'temp') return vitals.temp > 0;
  return /^\d+\/\d+/.test(vitals.bp);
}

function isCurrentEligibleVital(vitals: LiveVitals, key: VitalKey) {
  if (!hasVitalValue(vitals, key)) return false;
  return isCurrentFreshness(resolveFreshness(vitals.recordedAt[key], true));
}

function countVitalSignals(vitals: LiveVitals) {
  return (['hr', 'spo2', 'temp', 'bp'] as VitalKey[]).filter((key) =>
    isCurrentEligibleVital(vitals, key),
  ).length;
}

function displayVitalNumber(value: number, suffix = '') {
  if (!Number.isFinite(value) || value <= 0) return '—';
  return `${value}${suffix}`;
}

function displayTemp(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '—';
  return `${value.toFixed(1)}°`;
}

function displayBp(value?: string) {
  if (!value || value === '—') return '—';
  return value;
}

function resolveFreshness(timestamp: string | null, hasData: boolean): Freshness {
  if (!hasData) return 'none';
  if (!timestamp) return 'stale';

  const ts = Date.parse(timestamp);
  if (!Number.isFinite(ts)) return 'stale';

  const ageMin = Math.max(0, (Date.now() - ts) / 60000);
  if (ageMin <= 2) return 'live';
  if (ageMin <= 60) return 'recent';
  return 'stale';
}

function freshnessLabel(freshness: Freshness) {
  switch (freshness) {
    case 'live':
      return 'LIVE';
    case 'recent':
      return 'RECENT';
    case 'stale':
      return 'STALE';
    case 'offline':
      return 'OFFLINE';
    default:
      return 'NO DATA';
  }
}

function freshnessClasses(freshness: Freshness) {
  switch (freshness) {
    case 'live':
      return 'border-cyan-300/60 bg-cyan-50/80 text-cyan-800';
    case 'recent':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'stale':
      return 'border-slate-200 bg-slate-100 text-slate-600';
    case 'offline':
      return 'border-slate-300 bg-white text-slate-500';
    default:
      return 'border-slate-200 bg-transparent text-slate-400';
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

function severityClasses(severity: AlertSeverity) {
  switch (severity) {
    case 'critical':
      return 'border-red-300 bg-red-50 text-red-800';
    case 'high':
      return 'border-amber-300 bg-amber-50 text-amber-800';
    case 'moderate':
      return 'border-yellow-300 bg-yellow-50 text-yellow-800';
    default:
      return 'border-sky-200 bg-sky-50 text-sky-800';
  }
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

function normalizeDevices(payload: unknown): DeviceLike[] {
  const root = payload as
    | { items?: unknown[]; devices?: unknown[] }
    | undefined;

  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray(root?.items)
      ? root.items
      : Array.isArray(root?.devices)
        ? root.devices
        : [];

  return raw.map((item, index) => {
    const record = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const batteryRaw = toNumber(record.battery, record.batteryPct, record.batteryLevel);
    const lastSyncRaw = record.lastSync ?? record.lastSeen ?? record.updatedAt ?? record.last_seen;
    const signalRaw = record.signalQuality ?? record.signal ?? record.quality;

    return {
      id: String(record.id ?? record.deviceId ?? `device-${index}`),
      name: String(record.name ?? record.deviceName ?? record.type ?? record.model ?? `Device ${index + 1}`),
      status: String(record.status ?? record.state ?? 'unknown'),
      lastSync: lastSyncRaw == null ? null : String(lastSyncRaw),
      battery: batteryRaw == null ? null : Math.max(0, Math.min(100, Math.round(batteryRaw))),
      signalQuality: signalRaw == null ? null : String(signalRaw),
    };
  });
}

function normalizeAiMessages(payload: unknown): string[] {
  const root = payload as { messages?: unknown[] } | undefined;
  if (!Array.isArray(root?.messages)) return [];
  return root.messages.filter((m): m is string => typeof m === 'string').slice(0, 3);
}

function normalizeAdherenceSummary(payload: unknown): {
  currentPct: number | null;
  history: AdherencePoint[];
} {
  const root = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const summary =
    root.summary && typeof root.summary === 'object'
      ? (root.summary as Record<string, unknown>)
      : {};

  const currentCandidate =
    root.adherencePct ??
    root.currentPct ??
    root.percentage ??
    root.percent ??
    root.score ??
    root.current ??
    summary.weightedPct ??
    summary.adherencePct ??
    summary.currentPct;

  const currentNumber =
    typeof currentCandidate === 'number' && Number.isFinite(currentCandidate)
      ? currentCandidate
      : typeof currentCandidate === 'string' && currentCandidate.trim()
        ? Number(currentCandidate)
        : null;

  const rawHistory = Array.isArray(root.history)
    ? root.history
    : Array.isArray(root.trend)
      ? root.trend
      : Array.isArray(root.dailyTrend)
        ? root.dailyTrend
        : Array.isArray(root.series)
          ? root.series
          : Array.isArray(root.items)
            ? root.items
            : [];

  const history = rawHistory
    .map((item, index): AdherencePoint | null => {
      if (typeof item === 'number' && Number.isFinite(item)) {
        return {
          label: `Reading ${index + 1}`,
          value: Math.max(0, Math.min(100, Math.round(item))),
        };
      }

      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const valueRaw =
        record.value ??
        record.adherencePct ??
        record.weightedPct ??
        record.percentage ??
        record.percent ??
        record.score ??
        record.rate;

      const value =
        typeof valueRaw === 'number' && Number.isFinite(valueRaw)
          ? valueRaw
          : typeof valueRaw === 'string' && valueRaw.trim()
            ? Number(valueRaw)
            : NaN;

      if (!Number.isFinite(value)) return null;

      const ts = String(record.ts ?? record.date ?? record.day ?? record.recordedAt ?? '').trim();
      const label = ts
        ? (() => {
            const d = new Date(ts);
            return Number.isNaN(d.getTime()) ? ts : ZA_SHORT_DATE_FORMATTER.format(d);
          })()
        : `Reading ${index + 1}`;

      return {
        label,
        ts: ts || undefined,
        value: Math.max(0, Math.min(100, Math.round(value))),
      };
    })
    .filter((point): point is AdherencePoint => Boolean(point))
    .slice(-14);

  return {
    currentPct:
      typeof currentNumber === 'number' && Number.isFinite(currentNumber)
        ? Math.max(0, Math.min(100, Math.round(currentNumber)))
        : null,
    history,
  };
}

function normalizeMedications(payload: unknown): MedLike[] {
  const root = payload as { medications?: unknown[]; meds?: unknown[]; items?: unknown[] } | undefined;
  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray(root?.medications)
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
  const root = payload as { cases?: unknown[]; items?: unknown[] } | undefined;
  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray(root?.cases)
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
      latestEncounter:
        latestEncounter?.start == null ? undefined : { start: String(latestEncounter.start) },
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

function vitalRecordType(record: RawVitalRecord) {
  return String(record.vType ?? record.type ?? '').trim();
}

function vitalRecordTimestamp(record: RawVitalRecord) {
  const raw = record.recorded_at ?? record.t ?? null;
  if (!raw) return null;
  const value = String(raw);
  return Number.isFinite(Date.parse(value)) ? value : null;
}

function vitalRecordValue(record: RawVitalRecord) {
  return toNumber(record.valueNum, record.value, record.payload?.value);
}

function isActiveClinicalRecord(record: RawVitalRecord) {
  const status = String(record.interpretationStatus ?? '').trim().toUpperCase();
  // Legacy aggregate rows may not carry a trust field. The canonical API's
  // default GET is ACTIVE-only; an explicit non-ACTIVE status is never allowed
  // into the Home clinical projection.
  return !status || status === 'ACTIVE';
}

function trustFromRecord(record?: RawVitalRecord): VitalTrustSnapshot | null {
  if (!record) return null;

  const observationId =
    record.observationId == null ? null : String(record.observationId).trim() || null;
  const timeAuthority =
    record.timeAuthority == null ? null : String(record.timeAuthority).trim() || null;
  const interpretationStatus =
    record.interpretationStatus == null
      ? null
      : String(record.interpretationStatus).trim() || null;
  const statusReasonCode =
    record.statusReasonCode == null ? null : String(record.statusReasonCode).trim() || null;
  const statusReasonText =
    record.statusReasonText == null ? null : String(record.statusReasonText).trim() || null;

  if (
    !observationId &&
    !timeAuthority &&
    !interpretationStatus &&
    !statusReasonCode &&
    !statusReasonText
  ) {
    return null;
  }

  return {
    observationId,
    timeAuthority,
    interpretationStatus,
    statusReasonCode,
    statusReasonText,
  };
}

function withLogicalPayload(
  record: RawVitalRecord,
  type: VitalsType,
  payload: Record<string, unknown>,
): RawVitalRecord & { type: VitalsType } {
  const recordedAt = vitalRecordTimestamp(record);
  return {
    ...record,
    type,
    recorded_at: recordedAt,
    payload: {
      ...(record.payload ?? {}),
      ...payload,
    },
    meta: {
      ...(record.meta ?? {}),
      ...(record.deviceId ? { device: record.deviceId } : {}),
    },
  };
}

function normalizeClinicalVitalRecords(items: RawVitalRecord[]) {
  const active = items.filter(isActiveClinicalRecord);
  const logical: Array<RawVitalRecord & { type: VitalsType }> = [];
  const bpGroups = new Map<
    string,
    {
      systolic?: RawVitalRecord;
      diastolic?: RawVitalRecord;
    }
  >();

  for (const record of active) {
    const type = vitalRecordType(record);
    const value = vitalRecordValue(record);

    // The canonical gateway projects most measurements as scalar rows. Some
    // scalar names (heart_rate, spo2, blood_glucose) intentionally overlap the
    // legacy aggregate API names, so normalize the direct numeric field before
    // falling back to the legacy payload representation.
    if (type === 'heart_rate' && value !== null) {
      const payloadValue = toNumber(
        record.payload?.bpm,
        record.payload?.value,
        record.payload?.hr,
      );
      logical.push(
        payloadValue !== null
          ? ({
              ...record,
              type: 'heart_rate',
              recorded_at: vitalRecordTimestamp(record),
            } as RawVitalRecord & { type: VitalsType })
          : withLogicalPayload(record, 'heart_rate', { bpm: value, value }),
      );
      continue;
    }

    if (type === 'spo2' && value !== null) {
      const payloadValue = toNumber(
        record.payload?.pct,
        record.payload?.value,
        record.payload?.spo2,
      );
      logical.push(
        payloadValue !== null
          ? ({
              ...record,
              type: 'spo2',
              recorded_at: vitalRecordTimestamp(record),
            } as RawVitalRecord & { type: VitalsType })
          : withLogicalPayload(record, 'spo2', { pct: value, spo2: value, value }),
      );
      continue;
    }

    if (type === 'blood_glucose' && value !== null) {
      const payloadValue = toNumber(
        record.payload?.mgDl,
        record.payload?.mg_dl,
        record.payload?.glucose,
        record.payload?.value,
      );
      logical.push(
        payloadValue !== null
          ? ({
              ...record,
              type: 'blood_glucose',
              recorded_at: vitalRecordTimestamp(record),
            } as RawVitalRecord & { type: VitalsType })
          : withLogicalPayload(record, 'blood_glucose', { glucose: value, value }),
      );
      continue;
    }

    if (type === 'temperature_celsius' && value !== null) {
      logical.push(withLogicalPayload(record, 'temperature', { celsius: value, value }));
      continue;
    }

    if (type === 'blood_pressure_systolic' || type === 'blood_pressure_diastolic') {
      if (value === null) continue;
      const observationId =
        record.observationId == null ? '' : String(record.observationId).trim();
      const recordedAt = vitalRecordTimestamp(record);
      const key = observationId
        ? `observation:${observationId}`
        : `legacy:${record.deviceId ?? ''}:${recordedAt ?? ''}`;

      const group = bpGroups.get(key) ?? {};
      if (type === 'blood_pressure_systolic') group.systolic = record;
      if (type === 'blood_pressure_diastolic') group.diastolic = record;
      bpGroups.set(key, group);
      continue;
    }

    if (isVitalsType(type)) {
      logical.push({
        ...record,
        type,
        recorded_at: vitalRecordTimestamp(record),
      } as RawVitalRecord & { type: VitalsType });
    }
  }

  for (const group of bpGroups.values()) {
    if (!group.systolic || !group.diastolic) continue;

    const systolic = vitalRecordValue(group.systolic);
    const diastolic = vitalRecordValue(group.diastolic);
    if (systolic === null || diastolic === null) continue;

    const source =
      Date.parse(vitalRecordTimestamp(group.systolic) ?? '') >=
      Date.parse(vitalRecordTimestamp(group.diastolic) ?? '')
        ? group.systolic
        : group.diastolic;

    logical.push(
      withLogicalPayload(source, 'blood_pressure', {
        systolic,
        diastolic,
        sys: systolic,
        dia: diastolic,
      }),
    );
  }

  return logical;
}

function latestTimestamp(values: Array<string | null>) {
  return (
    values
      .filter((value): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value)))
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null
  );
}

function mergeVitals(primary: LiveVitals, fallback: LiveVitals | null): LiveVitals {
  if (!fallback) return primary;

  const hasPrimaryHr = primary.hr > 0;
  const hasPrimarySpo2 = primary.spo2 > 0;
  const hasPrimaryTemp = primary.temp > 0;
  const hasPrimaryBp = /^\d+\/\d+/.test(primary.bp);

  const recordedAt = {
    hr: hasPrimaryHr ? primary.recordedAt.hr : fallback.recordedAt.hr,
    spo2: hasPrimarySpo2 ? primary.recordedAt.spo2 : fallback.recordedAt.spo2,
    temp: hasPrimaryTemp ? primary.recordedAt.temp : fallback.recordedAt.temp,
    bp: hasPrimaryBp ? primary.recordedAt.bp : fallback.recordedAt.bp,
  };

  return {
    hr: hasPrimaryHr ? primary.hr : fallback.hr,
    spo2: hasPrimarySpo2 ? primary.spo2 : fallback.spo2,
    temp: hasPrimaryTemp ? primary.temp : fallback.temp,
    bp: hasPrimaryBp ? primary.bp : fallback.bp,
    bpSeries: primary.bpSeries.length ? primary.bpSeries : fallback.bpSeries,
    latestAt: latestTimestamp(Object.values(recordedAt)),
    recordedAt,
    source: {
      hr: hasPrimaryHr ? primary.source.hr : fallback.source.hr,
      spo2: hasPrimarySpo2 ? primary.source.spo2 : fallback.source.spo2,
      temp: hasPrimaryTemp ? primary.source.temp : fallback.source.temp,
      bp: hasPrimaryBp ? primary.source.bp : fallback.source.bp,
    },
    trust: {
      hr: hasPrimaryHr ? primary.trust.hr : fallback.trust.hr,
      spo2: hasPrimarySpo2 ? primary.trust.spo2 : fallback.trust.spo2,
      temp: hasPrimaryTemp ? primary.trust.temp : fallback.trust.temp,
      bp: hasPrimaryBp ? primary.trust.bp : fallback.trust.bp,
    },
  };
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
    return { systolic: toNumber(s), diastolic: toNumber(d) };
  }

  return { systolic, diastolic };
}

function sourceFromRecord(record?: RawVitalRecord) {
  if (!record) return null;
  const payload = record.payload ?? {};
  const meta = record.meta ?? {};
  const source =
    meta.source ??
    meta.deviceName ??
    meta.device ??
    payload.source ??
    payload.deviceName ??
    payload.device ??
    payload.model ??
    record.deviceId;
  return source == null ? null : String(source);
}

function resolveVitals(items: RawVitalRecord[]): LiveVitals {
  if (!Array.isArray(items) || items.length === 0) return EMPTY_VITALS;

  const logicalItems = normalizeClinicalVitalRecords(items);
  if (logicalItems.length === 0) return EMPTY_VITALS;

  const latestByType = new Map<VitalsType, RawVitalRecord & { type: VitalsType }>();

  for (const item of logicalItems) {
    const existing = latestByType.get(item.type);
    const preferred = pickPreferredVital(existing, item);
    if (preferred) latestByType.set(item.type, preferred as RawVitalRecord & { type: VitalsType });
  }

  const hrRecord = latestByType.get('heart_rate');
  const spo2Record = latestByType.get('spo2');
  const tempRecord = latestByType.get('temperature');
  const bpRecord = latestByType.get('blood_pressure');

  const hr = toNumber(hrRecord?.payload?.bpm, hrRecord?.payload?.value, hrRecord?.payload?.hr) ?? 0;
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

  // Clinical truth rule: historical BP points are only shown when both values and a real timestamp exist.
  const bpSeries: BpPoint[] = logicalItems
    .reduce<BpPoint[]>((acc, item) => {
      if (item.type !== 'blood_pressure' || !item.recorded_at) return acc;
      const { systolic, diastolic } = parseBloodPressure(item);
      if (typeof systolic !== 'number' || typeof diastolic !== 'number') return acc;
      acc.push({
        ts: item.recorded_at,
        sys: Math.round(systolic),
        dia: Math.round(diastolic),
      });
      return acc;
    }, [])
    .sort((a, b) => Date.parse(String(a.ts)) - Date.parse(String(b.ts)))
    .slice(-14);

  const timestamps = [hrRecord, spo2Record, tempRecord, bpRecord]
    .map((record) => record?.recorded_at ?? null)
    .filter(
      (value): value is string =>
        typeof value === 'string' &&
        Number.isFinite(Date.parse(value)),
    )
    .sort((a, b) => Date.parse(b) - Date.parse(a));

  return {
    hr: Math.round(hr),
    spo2: Math.round(spo2),
    temp: Number(temp.toFixed(1)),
    bp,
    bpSeries,
    latestAt: timestamps[0] ?? null,
    recordedAt: {
      hr: hrRecord?.recorded_at ?? null,
      spo2: spo2Record?.recorded_at ?? null,
      temp: tempRecord?.recorded_at ?? null,
      bp: bpRecord?.recorded_at ?? null,
    },
    source: {
      hr: sourceFromRecord(hrRecord),
      spo2: sourceFromRecord(spo2Record),
      temp: sourceFromRecord(tempRecord),
      bp: sourceFromRecord(bpRecord),
    },
    trust: {
      hr: trustFromRecord(hrRecord),
      spo2: trustFromRecord(spo2Record),
      temp: trustFromRecord(tempRecord),
      bp: trustFromRecord(bpRecord),
    },
  };
}

function resolveSummaryVitals(payload: unknown): LiveVitals | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, any>;
  if (root.ok === false) return null;

  const bpNow = root.bpNow;
  const bpFromObject =
    bpNow && typeof bpNow === 'object'
      ? `${bpNow.s ?? bpNow.sys ?? bpNow.systolic ?? '—'}/${bpNow.d ?? bpNow.dia ?? bpNow.diastolic ?? '—'}`
      : null;

  const bp =
    typeof root.bp === 'string' && root.bp.trim()
      ? root.bp.trim()
      : typeof bpNow === 'string' && bpNow.trim()
        ? bpNow.trim()
        : bpFromObject && /^\d+\/\d+/.test(bpFromObject)
          ? bpFromObject
          : '—';

  const hr = toNumber(root.hr, root.hrNow, root.heartRate, root.pulse) ?? 0;
  const spo2 = toNumber(root.spo2, root.spo2Now, root.oxygenSaturation) ?? 0;
  const temp = toNumber(root.temp, root.tempNow, root.temperature, root.temperatureC) ?? 0;
  const latestAtRaw = root.lastSync ?? root.generatedAtISO ?? root.updatedAt ?? null;
  const latestAt = latestAtRaw == null ? null : String(latestAtRaw);

  if (hr <= 0 && spo2 <= 0 && temp <= 0 && bp === '—') return null;

  // Do not synthesize timestamps or missing diastolic values from summary arrays.
  return {
    hr: Math.round(hr),
    spo2: Math.round(spo2),
    temp: Number(temp.toFixed(1)),
    bp,
    bpSeries: [],
    latestAt,
    recordedAt: {
      hr: latestAt,
      spo2: latestAt,
      temp: latestAt,
      bp: latestAt,
    },
    source: {
      hr: root.source ? String(root.source) : null,
      spo2: root.source ? String(root.source) : null,
      temp: root.source ? String(root.source) : null,
      bp: root.source ? String(root.source) : null,
    },
    // /api/vitals/summary is derived from /api/reports/vitals, which in turn
    // reads the canonical ACTIVE-only vitals projection. It is retained only
    // as a value fallback and does not invent per-observation trust metadata.
    trust: { hr: null, spo2: null, temp: null, bp: null },
  };
}

function extractNumericArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((sample) => {
      if (typeof sample === 'number' && Number.isFinite(sample)) return sample;
      if (typeof sample === 'string' && sample.trim()) {
        const parsed = Number(sample);
        return Number.isFinite(parsed) ? parsed : null;
      }
      if (sample && typeof sample === 'object') {
        const record = sample as Record<string, unknown>;
        return toNumber(record.value, record.mv, record.amplitude, record.y);
      }
      return null;
    })
    .filter((sample): sample is number => typeof sample === 'number' && Number.isFinite(sample));
}

function resolveEcg(items: RawVitalRecord[]): ECGSnapshot | null {
  const candidates = items
    .filter((item) => item.type === 'ecg' && isActiveClinicalRecord(item))
    .sort((a, b) => Date.parse(b.recorded_at ?? '') - Date.parse(a.recorded_at ?? ''));

  for (const item of candidates) {
    const payload = item.payload ?? {};
    const samples = [payload.samples, payload.waveform, payload.values, payload.data, payload.ecg]
      .map(extractNumericArray)
      .find((arr) => arr.length >= 8);

    if (samples && samples.length >= 8) {
      return {
        samples: samples.slice(-500),
        recordedAt: item.recorded_at ?? null,
        source: sourceFromRecord(item) ?? 'Health Monitor',
      };
    }
  }

  return null;
}

function deriveCareState(vitals: LiveVitals): CareState {
  const activeSignalCount = countVitalSignals(vitals);

  const currentHr = isCurrentEligibleVital(vitals, 'hr') ? vitals.hr : 0;
  const currentSpo2 = isCurrentEligibleVital(vitals, 'spo2') ? vitals.spo2 : 0;
  const currentBp = isCurrentEligibleVital(vitals, 'bp') ? vitals.bp : '—';
  const systolic = /^\d+\/\d+/.test(currentBp) ? Number(currentBp.split('/')[0]) : 0;

  // Temporary client-side fallback mirrors the previous home-page thresholds,
  // but only CURRENT, ACTIVE-eligible telemetry may enter the calculation.
  // InsightCore alerts remain visible and actionable separately until alert
  // lineage can prove whether an alert still depends on an excluded observation.
  // The long-term source of truth remains a governed backend care-state/protocol service.
  const thresholdBreach =
    (currentSpo2 > 0 && currentSpo2 < 94) ||
    (currentHr > 0 && (currentHr > 112 || currentHr < 52)) ||
    (systolic > 0 && systolic > 145);

  if (thresholdBreach) return 'action_required';

  const watchSignal =
    (currentSpo2 > 0 && currentSpo2 < 96) ||
    (currentHr > 0 && (currentHr > 96 || currentHr < 58));

  if (watchSignal) return 'watch';
  if (activeSignalCount >= 3) return 'stable';
  return 'insufficient';
}

function careStateMeta(state: CareState) {
  switch (state) {
    case 'critical':
      return {
        label: 'Critical alert',
        headline: 'Immediate attention is required',
        description: 'A critical care signal is active. Follow the action shown below.',
        badge: 'border-red-300 bg-red-50 text-red-800',
        accent: 'text-red-700',
      };
    case 'action_required':
      return {
        label: 'Action required',
        headline: 'A monitored signal needs attention',
        description: 'Review the current signal and the recommended next action.',
        badge: 'border-amber-300 bg-amber-50 text-amber-800',
        accent: 'text-amber-700',
      };
    case 'watch':
      return {
        label: 'Watch',
        headline: 'Your care state is being watched more closely',
        description: 'Most information remains available, with one or more signals worth reviewing.',
        badge: 'border-yellow-300 bg-yellow-50 text-yellow-800',
        accent: 'text-yellow-700',
      };
    case 'stable':
      return {
        label: 'Stable',
        headline: 'Your monitored care state is stable',
        description: 'Available signals and current alerts do not indicate an active escalation.',
        badge: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        accent: 'text-emerald-700',
      };
    default:
      return {
        label: 'Insufficient current data',
        headline: 'More current data is needed',
        description: 'Sync supported measurements to build a reliable current care picture.',
        badge: 'border-slate-200 bg-slate-100 text-slate-700',
        accent: 'text-slate-600',
      };
  }
}

function atmosphereClasses(state: CareState) {
  if (state === 'critical') {
    return 'bg-white text-slate-950';
  }
  if (state === 'action_required') {
    return 'bg-[radial-gradient(circle_at_100%_0%,rgba(245,158,11,0.09),transparent_32%),linear-gradient(180deg,#fbfbfa_0%,#f5f7f8_100%)]';
  }
  if (state === 'watch') {
    return 'bg-[radial-gradient(circle_at_90%_0%,rgba(234,179,8,0.06),transparent_30%),linear-gradient(180deg,#fafbfb_0%,#f2f6f7_100%)]';
  }
  const evening = new Date().getHours() >= 18 || new Date().getHours() < 6;
  return evening
    ? 'bg-[radial-gradient(circle_at_12%_0%,rgba(14,165,233,0.04),transparent_28%),linear-gradient(180deg,#f7f6f3_0%,#f2f4f5_100%)]'
    : 'bg-[radial-gradient(circle_at_12%_0%,rgba(6,182,212,0.055),transparent_28%),linear-gradient(180deg,#f8fafb_0%,#f1f5f6_100%)]';
}

function derivePriorityAction(args: {
  careState: CareState;
  alerts: InsightAlert[];
  adherencePct: number | null;
  nextAppointment: AppointmentState;
}) {
  const highestAlert = args.alerts.find(
    (alert) => alert.severity === 'critical' || alert.severity === 'high',
  );

  if (highestAlert) {
    return {
      eyebrow: 'Care Now',
      title: highestAlert.title,
      body: highestAlert.message,
      href: '/insights',
      cta: 'Review alert',
      severity: highestAlert.severity,
    };
  }

  if (args.careState === 'action_required' || args.careState === 'watch') {
    return {
      eyebrow: 'Care Now',
      title: 'Review current measurements',
      body: 'One or more current signals deserve review before the rest of your care journey.',
      href: '/vitals',
      cta: 'Open live body',
      severity: args.careState === 'action_required' ? ('high' as const) : ('moderate' as const),
    };
  }

  if (args.adherencePct !== null && args.adherencePct < 85) {
    return {
      eyebrow: 'Care Now',
      title: 'Review today’s treatment schedule',
      body: `Recorded medication adherence is ${args.adherencePct}%.`,
      href: '/medications',
      cta: 'Open medications',
      severity: 'moderate' as const,
    };
  }

  if (args.nextAppointment.status !== 'Not scheduled') {
    return {
      eyebrow: 'Care Now',
      title: 'Prepare for your next consultation',
      body: `${args.nextAppointment.with} · ${args.nextAppointment.when}`,
      href: '/appointments',
      cta: 'Prepare for consultation',
      severity: 'low' as const,
    };
  }

  return {
    eyebrow: 'Care Now',
    title: 'Your care space is ready',
    body: 'Book care when you need it or keep supported devices synced for your next clinical interaction.',
    href: '/clinicians?class=doctor',
    cta: 'Find a clinician',
    severity: 'low' as const,
  };
}

function deriveMedicationAdherence(meds: MedLike[]) {
  if (!Array.isArray(meds) || meds.length === 0) return null;

  const assessable = meds.filter((med) => {
    const status = String(med.status ?? '').toLowerCase();
    return (
      status.includes('taken') ||
      status.includes('completed') ||
      status.includes('administered') ||
      status.includes('missed') ||
      status.includes('skipped') ||
      status.includes('pending') ||
      status.includes('due')
    );
  });

  if (assessable.length === 0) return null;

  const taken = assessable.filter((med) => {
    const status = String(med.status ?? '').toLowerCase();
    return status.includes('taken') || status.includes('completed') || status.includes('administered');
  }).length;

  return Math.round((taken / assessable.length) * 100);
}

function bpTrajectory(bpSeries: BpPoint[]) {
  if (bpSeries.length < 2) return { label: 'No trend yet', symbol: '—' };
  const first = bpSeries[0]?.sys;
  const last = bpSeries[bpSeries.length - 1]?.sys;
  if (!Number.isFinite(first) || !Number.isFinite(last)) return { label: 'No trend yet', symbol: '—' };
  const delta = Number(last) - Number(first);
  if (Math.abs(delta) <= 3) return { label: 'Steady across recorded readings', symbol: '→' };
  if (delta > 0) return { label: `+${Math.round(delta)} systolic across recorded readings`, symbol: '↗' };
  return { label: `${Math.round(delta)} systolic across recorded readings`, symbol: '↘' };
}

function ecgPath(samples: number[], width = 1000, height = 180) {
  if (samples.length < 2) return '';
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const range = max - min || 1;
  return samples
    .map((sample, index) => {
      const x = (index / (samples.length - 1)) * width;
      const y = height - ((sample - min) / range) * (height * 0.68) - height * 0.16;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

function stateDotClass(state: MeshState) {
  switch (state) {
    case 'live':
      return 'bg-cyan-500';
    case 'recent':
      return 'bg-emerald-500';
    case 'processing':
      return 'bg-violet-500';
    case 'ready':
      return 'bg-sky-500';
    case 'offline':
      return 'bg-slate-400';
    default:
      return 'bg-slate-300';
  }
}

function meshStateLabel(state: MeshState) {
  switch (state) {
    case 'live':
      return 'Live';
    case 'recent':
      return 'Recent';
    case 'processing':
      return 'Processing';
    case 'ready':
      return 'Ready';
    case 'offline':
      return 'Offline';
    default:
      return 'Available';
  }
}

function matchDevice(devices: DeviceLike[], patterns: RegExp[]) {
  return devices.find((device) => patterns.some((pattern) => pattern.test(device.name.toLowerCase())));
}

function deviceMeshState(device?: DeviceLike, fallbackFreshness?: Freshness): MeshState {
  if (fallbackFreshness === 'live') return 'live';
  if (fallbackFreshness === 'recent') return 'recent';
  if (!device) return 'available';

  const status = device.status.toLowerCase();
  if (status.includes('offline') || status.includes('disconnected')) return 'offline';
  if (status.includes('online') || status.includes('connected') || status.includes('active')) return 'ready';
  return 'available';
}

function CompactFreshness({ freshness, timestamp }: { freshness: Freshness; timestamp: string | null }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em]',
        freshnessClasses(freshness),
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          freshness === 'live'
            ? 'animate-pulse bg-cyan-500'
            : freshness === 'recent'
              ? 'bg-emerald-500'
              : 'bg-slate-400',
        )}
      />
      {freshnessLabel(freshness)}
      {timestamp ? <span className="font-normal tracking-normal opacity-70">· {formatRelativeSync(timestamp)}</span> : null}
    </span>
  );
}

function measurementTrustLabel(trust: VitalTrustSnapshot | null) {
  if (!trust) return 'Included in ACTIVE-only clinical projection';

  const status = String(trust.interpretationStatus ?? 'ACTIVE').toUpperCase();
  const authority = String(trust.timeAuthority ?? '').toUpperCase();

  if (status !== 'ACTIVE') return 'Not eligible for current interpretation';
  if (authority === 'SOURCE_REPORTED') return 'Included in active trends · source-reported time';
  if (authority === 'UNSPECIFIED') return 'Included in active trends · historical time provenance';
  return 'Included in active trends';
}

function VitalCell({
  label,
  value,
  unit,
  timestamp,
  source,
  trust,
  trend,
  href = '/vitals',
}: {
  label: string;
  value: string;
  unit?: string;
  timestamp: string | null;
  source: string | null;
  trust?: VitalTrustSnapshot | null;
  trend?: { symbol: string; label: string };
  href?: string;
}) {
  const hasValue = value !== '—';
  const freshness = resolveFreshness(timestamp, hasValue);

  return (
    <Link
      href={href}
      className={cn(
        'group relative min-w-0 rounded-2xl border px-3.5 py-3.5 transition-colors sm:px-4 sm:py-4',
        freshness === 'live'
          ? 'border-cyan-200/80 bg-white shadow-[0_0_0_1px_rgba(6,182,212,0.05)]'
          : freshness === 'stale'
            ? 'border-slate-200 bg-slate-50/70'
            : 'border-slate-200/80 bg-white/90',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</span>
        <span
          className={cn(
            'mt-0.5 h-2 w-2 shrink-0 rounded-full',
            freshness === 'live'
              ? 'animate-pulse bg-cyan-500'
              : freshness === 'recent'
                ? 'bg-emerald-500'
                : 'bg-slate-300',
          )}
        />
      </div>

      <div className="mt-3 flex min-w-0 items-end gap-1.5">
        <span className="truncate text-[1.55rem] font-semibold leading-none tracking-[-0.04em] text-slate-950 [font-variant-numeric:tabular-nums] sm:text-[1.8rem]">
          {value}
        </span>
        {unit && hasValue ? <span className="pb-0.5 text-[11px] font-medium text-slate-400">{unit}</span> : null}
      </div>

      <div className="mt-3 min-h-[34px] text-[11px] leading-4 text-slate-500">
        {trend ? (
          <div className="font-medium text-slate-700">
            <span className="mr-1 text-sm">{trend.symbol}</span>
            {trend.label}
          </div>
        ) : (
          <div>{timestamp ? formatRelativeSync(timestamp) : 'No current reading'}</div>
        )}
        <div className="mt-0.5 truncate">{source ?? 'Source not supplied'}</div>
        {hasValue ? <div className="mt-0.5 text-[10px] text-slate-400">{measurementTrustLabel(trust ?? null)}</div> : null}
      </div>
    </Link>
  );
}

function ClinicalEcgStrip({ ecg }: { ecg: ECGSnapshot | null }) {
  const reducedMotion = useReducedMotion();
  const path = useMemo(() => (ecg ? ecgPath(ecg.samples) : ''), [ecg]);
  const freshness = resolveFreshness(ecg?.recordedAt ?? null, Boolean(ecg));
  const isLive = freshness === 'live';

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#071017] text-white shadow-[0_16px_40px_rgba(2,8,23,0.14)]">
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(34,211,238,0.10)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.10)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="relative z-10 flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/70">Health Monitor ECG</div>
          <div className="mt-0.5 text-sm font-medium text-white">
            {ecg ? `${ecg.source} · ${formatTimestamp(ecg.recordedAt)}` : 'ECG-capable · no current trace'}
          </div>
        </div>
        <CompactFreshness freshness={freshness} timestamp={ecg?.recordedAt ?? null} />
      </div>

      <div className="relative z-10 h-[118px] sm:h-[148px]">
        {ecg && path ? (
          <svg viewBox="0 0 1000 180" className="h-full w-full" preserveAspectRatio="none" aria-label="Recorded ECG trace">
            {isLive && !reducedMotion ? (
              <motion.path
                d={path}
                fill="none"
                stroke="rgb(34 211 238)"
                strokeWidth="2.6"
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0, opacity: 0.45 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.4, ease: 'linear' }}
              />
            ) : (
              <path
                d={path}
                fill="none"
                stroke="rgb(34 211 238)"
                strokeWidth="2.4"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
        ) : (
          <div className="flex h-full items-center justify-center px-5 text-center">
            <div>
              <Activity className="mx-auto h-5 w-5 text-cyan-300" />
              <div className="mt-2 text-sm font-medium text-white">No ECG trace available in this session</div>
              <div className="mt-1 text-xs leading-5 text-slate-400">
                A real Health Monitor ECG will appear here when the API supplies waveform samples. No simulated waveform is shown.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MeshNodeCard({ node }: { node: MeshNode }) {
  const Icon = node.icon;
  return (
    <Link
      href={node.href}
      className="group flex min-w-[152px] flex-1 items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/88 px-3.5 py-3 transition-colors hover:border-slate-300 sm:min-w-0"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-900">{node.label}</div>
        <div className="mt-0.5 truncate text-[11px] text-slate-500">{node.detail}</div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          <span className={cn('h-1.5 w-1.5 rounded-full', stateDotClass(node.state))} />
          {meshStateLabel(node.state)}
        </div>
      </div>
    </Link>
  );
}

function JourneyRow({ event }: { event: CareJourneyEvent }) {
  const icon =
    event.kind === 'alert'
      ? Bell
      : event.kind === 'appointment'
        ? CalendarDays
        : event.kind === 'treatment'
          ? Syringe
          : event.kind === 'care'
            ? Stethoscope
            : Waves;
  const Icon = icon;

  const content = (
    <div className="flex items-start gap-3 py-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900">{event.label}</div>
          <div className="shrink-0 text-[11px] font-medium text-slate-400">
            {event.ts ? formatTime(event.ts) : '—'}
          </div>
        </div>
        <div className="mt-1 text-xs leading-5 text-slate-500">{event.detail}</div>
      </div>
    </div>
  );

  if (!event.href) return content;
  return <Link href={event.href}>{content}</Link>;
}

export default function HomePage() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [liveVitals, setLiveVitals] = useState<LiveVitals>(EMPTY_VITALS);
  const [ecg, setEcg] = useState<ECGSnapshot | null>(null);
  const [nextAppointment, setNextAppointment] = useState<AppointmentState>({
    when: 'Plan next consultation',
    with: 'Your care team',
    status: 'Not scheduled',
  });
  const [devices, setDevices] = useState<DeviceLike[]>([]);
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<InsightAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [meds, setMeds] = useState<MedLike[]>([]);
  const [cases, setCases] = useState<CaseLike[]>([]);
  const [adherenceOverride, setAdherenceOverride] = useState<number | null>(null);
  const [adherenceHistory, setAdherenceHistory] = useState<AdherencePoint[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      try {
        setProfileLoading(true);
        const res = await fetch('/api/profile', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setProfile(data?.ok === false ? null : data);
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    }
    void loadProfile();
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
        setAlerts(
          incoming.slice(0, 3).map((alert, idx) => ({
            id: String(alert.id || idx),
            title: String(alert.title || 'InsightCore alert'),
            message: String(alert.message || alert.note || 'A care signal is ready for review.'),
            severity: (alert.severity as AlertSeverity) || 'moderate',
            ts: alert.ts != null ? String(alert.ts) : alert.timestamp != null ? String(alert.timestamp) : null,
          })),
        );
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load patient alerts', error);
        setAlertsError('InsightCore alert refresh could not be completed.');
        setAlerts([]);
      } finally {
        if (!cancelled) setAlertsLoading(false);
      }
    }
    void loadAlerts();
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
        if (!cancelled) setDevices(normalizeDevices(data));
      } catch {
        if (!cancelled) setDevices([]);
      }
    }
    void loadDevices();
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
        const res = await fetch(`/api/appointments?patientId=${encodedPatientId}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        const items = normalizeAppointments(data);
        const next = items[0];
        if (next) {
          setNextAppointment({
            id: next.id,
            startsAt: next.startsAt,
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

    void loadAppointment();
    return () => {
      cancelled = true;
    };
  }, [profile?.patientId]);

  useEffect(() => {
    const patientId = typeof profile?.patientId === 'string' ? profile.patientId : '';
    if (!patientId) {
      setLiveVitals(EMPTY_VITALS);
      setEcg(null);
      return;
    }

    const encodedPatientId = encodeURIComponent(patientId);
    let cancelled = false;

    async function loadVitals() {
      try {
        const [recordsRes, summaryRes] = await Promise.allSettled([
          fetch(`/api/v1/patients/${encodedPatientId}/vitals`, { cache: 'no-store' }),
          fetch('/api/vitals/summary', { cache: 'no-store' }),
        ]);

        if (cancelled) return;

        const recordsData =
          recordsRes.status === 'fulfilled'
            ? await recordsRes.value.json().catch(() => ({ items: [] }))
            : { items: [] };
        const summaryData =
          summaryRes.status === 'fulfilled'
            ? await summaryRes.value.json().catch(() => null)
            : null;

        const items = Array.isArray(recordsData?.items) ? (recordsData.items as RawVitalRecord[]) : [];
        const recordVitals = resolveVitals(items);
        const summaryVitals = resolveSummaryVitals(summaryData);

        // Canonical records are authoritative for observation trust. The summary
        // route is ACTIVE-only and may fill a missing core value, but it never
        // fabricates per-observation trust metadata.
        setLiveVitals(mergeVitals(recordVitals, summaryVitals));
        setEcg(resolveEcg(items));
      } catch {
        if (!cancelled) {
          setLiveVitals(EMPTY_VITALS);
          setEcg(null);
        }
      }
    }

    void loadVitals();
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
          const data = await medicationsRes.value.json().catch(() => ({}));
          if (!cancelled) setMeds(normalizeMedications(data));
        } else {
          setMeds([]);
        }

        if (casesRes.status === 'fulfilled' && casesRes.value.ok) {
          const data = await casesRes.value.json().catch(() => ({}));
          if (!cancelled) setCases(normalizeCases(data));
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

    void loadPatientLists();
    return () => {
      cancelled = true;
    };
  }, [profile?.patientId]);

  useEffect(() => {
    const patientId = typeof profile?.patientId === 'string' ? profile.patientId : '';
    if (!patientId) {
      setAdherenceOverride(null);
      setAdherenceHistory([]);
      return;
    }

    const encodedPatientId = encodeURIComponent(patientId);
    let cancelled = false;

    async function loadAdherenceSummary() {
      try {
        const res = await fetch(`/api/patient/adherence-summary?patientId=${encodedPatientId}`, {
          cache: 'no-store',
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled || !res.ok) return;
        const parsed = normalizeAdherenceSummary(data);
        setAdherenceOverride(parsed.currentPct);
        setAdherenceHistory(parsed.history);
      } catch {
        if (!cancelled) {
          setAdherenceOverride(null);
          setAdherenceHistory([]);
        }
      }
    }

    void loadAdherenceSummary();
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
            vitals: countVitalSignals(liveVitals) > 0
              ? {
                  hr: isCurrentEligibleVital(liveVitals, 'hr') ? liveVitals.hr : null,
                  bp: isCurrentEligibleVital(liveVitals, 'bp') ? liveVitals.bp : null,
                  temp: isCurrentEligibleVital(liveVitals, 'temp') ? liveVitals.temp : null,
                  spo2: isCurrentEligibleVital(liveVitals, 'spo2') ? liveVitals.spo2 : null,
                }
              : null,
            chronicConditions: profile?.chronicConditions ?? [],
            alertCount: alerts.length,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!cancelled) setAiInsights(normalizeAiMessages(data));
      } catch {
        if (!cancelled) setAiInsights([]);
      }
    }

    void loadAiGuidance();
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

  const careState = useMemo(() => deriveCareState(liveVitals), [liveVitals]);
  const careMeta = useMemo(() => careStateMeta(careState), [careState]);
  const medicationDerivedAdherence = useMemo(() => deriveMedicationAdherence(meds), [meds]);
  const adherencePct = adherenceOverride ?? medicationDerivedAdherence;
  const priorityAction = useMemo(
    () => derivePriorityAction({ careState, alerts, adherencePct, nextAppointment }),
    [careState, alerts, adherencePct, nextAppointment],
  );
  const signalCount = useMemo(() => countVitalSignals(liveVitals), [liveVitals]);
  const overallFreshness = useMemo(
    () => resolveFreshness(liveVitals.latestAt, hasLiveVitalData(liveVitals)),
    [liveVitals],
  );
  const bpTrend = useMemo(() => bpTrajectory(liveVitals.bpSeries), [liveVitals.bpSeries]);

  const meshNodes = useMemo<MeshNode[]>(() => {
    const healthMonitor = matchDevice(devices, [/health monitor/, /monitor/, /hm\b/]);
    const nexRing = matchDevice(devices, [/nexring/, /ring/]);
    const stethoscope = matchDevice(devices, [/steth/]);
    const otoscope = matchDevice(devices, [/otoscope/, /oto/]);
    const monitorFreshness = resolveFreshness(liveVitals.latestAt, hasLiveVitalData(liveVitals) || Boolean(ecg));

    return [
      {
        id: 'health-monitor',
        label: 'Health Monitor',
        detail: ecg ? 'Vitals + ECG' : 'Vitals + ECG capable',
        state: deviceMeshState(healthMonitor, monitorFreshness),
        href: '/myCare/devices',
        icon: HeartPulse,
      },
      {
        id: 'nexring',
        label: 'NexRing',
        detail: nexRing?.battery !== null && nexRing?.battery !== undefined ? `${nexRing.battery}% battery` : 'Wearable telemetry',
        state: deviceMeshState(nexRing),
        href: '/myCare/devices',
        icon: Activity,
      },
      {
        id: 'stethoscope',
        label: 'Digital Stethoscope',
        detail: stethoscope?.signalQuality ?? 'Remote auscultation',
        state: deviceMeshState(stethoscope),
        href: '/myCare/devices',
        icon: Stethoscope,
      },
      {
        id: 'otoscope',
        label: 'HD Otoscope',
        detail: otoscope?.signalQuality ?? 'Remote visual exam',
        state: deviceMeshState(otoscope),
        href: '/myCare/devices',
        icon: ScanHeart,
      },
      {
        id: 'insightcore',
        label: 'InsightCore',
        detail: alertsLoading ? 'Refreshing intelligence' : alerts.length ? `${alerts.length} active signal${alerts.length > 1 ? 's' : ''}` : 'Care intelligence ready',
        state: alertsLoading ? 'processing' : aiInsights.length || alerts.length ? 'ready' : 'available',
        href: '/insights',
        icon: BrainCircuit,
      },
      {
        id: 'clinician',
        label: 'Care Team',
        detail: nextAppointment.status === 'Not scheduled' ? 'Available when needed' : nextAppointment.with,
        state: nextAppointment.status === 'Not scheduled' ? 'available' : 'ready',
        href: '/clinicians?class=doctor',
        icon: Stethoscope,
      },
    ];
  }, [devices, liveVitals, ecg, alertsLoading, alerts.length, aiInsights.length, nextAppointment]);

  const journeyEvents = useMemo<CareJourneyEvent[]>(() => {
    const events: CareJourneyEvent[] = [];

    if (liveVitals.latestAt) {
      events.push({
        id: 'latest-telemetry',
        label: 'Telemetry received',
        detail: `${signalCount} supported signal${signalCount === 1 ? '' : 's'} reflected in your current care state.`,
        ts: liveVitals.latestAt,
        href: '/vitals',
        kind: 'telemetry',
      });
    }

    alerts.forEach((alert) => {
      events.push({
        id: `alert-${alert.id}`,
        label: alert.title,
        detail: `${severityLabel(alert.severity)} InsightCore signal`,
        ts: alert.ts,
        href: '/insights',
        kind: 'alert',
      });
    });

    cases.slice(0, 3).forEach((item, index) => {
      const ts = item.latestEncounter?.start ?? item.updatedAt ?? null;
      events.push({
        id: `case-${item.id ?? index}`,
        label: item.title ?? 'Care encounter',
        detail: item.status ? `Encounter status: ${item.status}` : 'Care encounter updated',
        ts,
        href: '/encounters',
        kind: 'care',
      });
    });

    if (nextAppointment.status !== 'Not scheduled') {
      events.push({
        id: `appointment-${nextAppointment.id ?? 'next'}`,
        label: 'Upcoming consultation',
        detail: `${nextAppointment.with} · ${nextAppointment.when}`,
        ts: nextAppointment.startsAt ?? null,
        href: '/appointments',
        kind: 'appointment',
      });
    }

    return events
      .sort((a, b) => {
        const aTs = a.ts ? Date.parse(a.ts) : 0;
        const bTs = b.ts ? Date.parse(b.ts) : 0;
        return bTs - aTs;
      })
      .slice(0, 5);
  }, [liveVitals.latestAt, signalCount, alerts, cases, nextAppointment]);

  const allergyNames = Array.isArray(profile?.allergies) ? profile.allergies.filter(Boolean) : [];
  const hasAdherenceHistory = adherenceHistory.length >= 2;
  const safetyOverride = careState === 'critical' || careState === 'action_required';

  return (
    <main
      data-p-ui="patient-home-page-v2"
      className={cn(
        'relative min-h-screen overflow-x-hidden px-3 pb-10 pt-3 text-slate-950 transition-colors duration-500 sm:px-4 md:px-6 md:pb-14 md:pt-5 lg:px-8',
        atmosphereClasses(careState),
      )}
    >
      {!safetyOverride ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute left-[-12rem] top-[-14rem] h-[30rem] w-[30rem] rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="absolute right-[-12rem] top-[8rem] h-[26rem] w-[26rem] rounded-full bg-indigo-300/8 blur-3xl" />
        </div>
      ) : null}

      <div className="relative mx-auto w-full max-w-[1540px]">
        <section className="sticky top-0 z-30 -mx-3 border-b border-slate-200/70 bg-white/88 px-3 py-2.5 backdrop-blur-xl sm:-mx-4 sm:px-4 md:static md:mx-0 md:rounded-2xl md:border md:px-4 md:shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-900">
              <span className={cn('h-2 w-2 rounded-full', overallFreshness === 'live' ? 'animate-pulse bg-cyan-500' : overallFreshness === 'recent' ? 'bg-emerald-500' : 'bg-slate-400')} />
              Live Care
            </div>
            <div className="h-4 w-px shrink-0 bg-slate-200" />
            <div className="shrink-0 text-xs text-slate-600">{devices.length} linked device{devices.length === 1 ? '' : 's'}</div>
            <div className="shrink-0 text-xs text-slate-600">Latest signal {formatRelativeSync(liveVitals.latestAt)}</div>
            <div className="shrink-0 text-xs text-slate-600">{alerts.length ? `${alerts.length} active alert${alerts.length > 1 ? 's' : ''}` : 'No active alerts'}</div>
            <div className="ml-auto hidden shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500 md:flex">
              <Shield className="h-3.5 w-3.5" />
              Patient care space
            </div>
          </div>
        </section>

        <div className="mt-3 grid gap-3 md:mt-4 md:gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.85fr)]">
          <section
            className={cn(
              'relative overflow-hidden rounded-[24px] border p-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-5 md:rounded-[28px] md:p-7',
              safetyOverride ? 'border-slate-300 bg-white' : 'border-white/80 bg-white/88',
            )}
          >
            {!safetyOverride ? (
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
            ) : null}

            <div className="relative z-10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-slate-500">{getDayPart()}, {patientName}</div>
                  <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Care State</div>
                </div>
                <span className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold', careMeta.badge)}>
                  <span className={cn('h-2 w-2 rounded-full', careState === 'critical' ? 'animate-pulse bg-red-600' : careState === 'action_required' ? 'bg-amber-500' : careState === 'watch' ? 'bg-yellow-500' : careState === 'stable' ? 'bg-emerald-500' : 'bg-slate-400')} />
                  {careMeta.label}
                </span>
              </div>

              <div className="mt-4 md:mt-6">
                <h1 className="max-w-4xl text-[1.8rem] font-semibold leading-[1.04] tracking-[-0.045em] text-slate-950 sm:text-[2.25rem] md:text-[3rem] xl:text-[3.45rem]">
                  {careMeta.headline}
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 md:text-[15px]">{careMeta.description}</p>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2.5 text-xs text-slate-600">
                <span className="rounded-full bg-slate-950 px-3 py-1.5 font-semibold text-white">{signalCount} / 4 current signals eligible</span>
                <CompactFreshness freshness={overallFreshness} timestamp={liveVitals.latestAt} />
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium">{alerts.length ? `${alerts.length} care signal${alerts.length > 1 ? 's' : ''}` : 'No escalation signal'}</span>
              </div>

              <details className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 text-sm">
                <summary className="cursor-pointer font-semibold text-slate-800">Why this care state?</summary>
                <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-600 sm:grid-cols-2">
                  <div>Current eligible telemetry: {signalCount} of 4 core signals.</div>
                  <div>InsightCore alerts shown separately: {alerts.length}.</div>
                  <div>Latest ACTIVE telemetry: {formatTimestamp(liveVitals.latestAt)}.</div>
                  <div>Care State uses current ACTIVE telemetry only. Alerts remain visible separately until observation lineage can be reconciled after exclusions.</div>
                </div>
              </details>

              <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
                <VitalCell
                  label="Heart rate"
                  value={displayVitalNumber(liveVitals.hr)}
                  unit="bpm"
                  timestamp={liveVitals.recordedAt.hr}
                  source={liveVitals.source.hr}
                  trust={liveVitals.trust.hr}
                />
                <VitalCell
                  label="SpO₂"
                  value={displayVitalNumber(liveVitals.spo2)}
                  unit="%"
                  timestamp={liveVitals.recordedAt.spo2}
                  source={liveVitals.source.spo2}
                  trust={liveVitals.trust.spo2}
                />
                <VitalCell
                  label="Blood pressure"
                  value={displayBp(liveVitals.bp)}
                  unit="mmHg"
                  timestamp={liveVitals.recordedAt.bp}
                  source={liveVitals.source.bp}
                  trust={liveVitals.trust.bp}
                  trend={liveVitals.bpSeries.length >= 2 ? bpTrend : undefined}
                />
                <VitalCell
                  label="Temperature"
                  value={displayTemp(liveVitals.temp)}
                  unit="C"
                  timestamp={liveVitals.recordedAt.temp}
                  source={liveVitals.source.temp}
                  trust={liveVitals.trust.temp}
                />
              </div>

              <div className="mt-3">
                <ClinicalEcgStrip ecg={ecg} />
              </div>
            </div>
          </section>

          <section
            className={cn(
              'relative overflow-hidden rounded-[24px] border p-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-5 md:rounded-[28px] md:p-6',
              careState === 'critical'
                ? 'border-red-300 bg-white'
                : careState === 'action_required'
                  ? 'border-amber-300 bg-white'
                  : 'border-slate-900 bg-slate-950 text-white',
            )}
          >
            <div className="relative z-10 flex h-full flex-col">
              <div className={cn('text-[11px] font-semibold uppercase tracking-[0.18em]', safetyOverride ? 'text-slate-500' : 'text-cyan-200/70')}>
                {priorityAction.eyebrow}
              </div>
              <h2 className={cn('mt-3 text-[1.55rem] font-semibold leading-tight tracking-[-0.035em] sm:text-[1.8rem]', safetyOverride ? 'text-slate-950' : 'text-white')}>
                {priorityAction.title}
              </h2>
              <p className={cn('mt-3 text-sm leading-6', safetyOverride ? 'text-slate-600' : 'text-slate-300')}>
                {priorityAction.body}
              </p>

              {nextAppointment.status !== 'Not scheduled' ? (
                <div className={cn('mt-5 rounded-2xl border p-4', safetyOverride ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/5')}>
                  <div className={cn('text-[10px] font-semibold uppercase tracking-[0.16em]', safetyOverride ? 'text-slate-400' : 'text-slate-400')}>Next consultation</div>
                  <div className={cn('mt-2 text-lg font-semibold', safetyOverride ? 'text-slate-950' : 'text-white')}>{nextAppointment.when}</div>
                  <div className={cn('mt-1 text-sm', safetyOverride ? 'text-slate-600' : 'text-slate-400')}>{nextAppointment.with}</div>
                </div>
              ) : null}

              <div className="mt-auto pt-6">
                <Link
                  href={priorityAction.href}
                  className={cn(
                    'inline-flex min-h-11 w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition-colors',
                    safetyOverride
                      ? 'bg-slate-950 text-white hover:bg-slate-800'
                      : 'bg-white text-slate-950 hover:bg-cyan-50',
                  )}
                >
                  {priorityAction.cta}
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link
                    href="/clinicians?class=doctor"
                    className={cn('inline-flex min-h-11 items-center justify-center rounded-xl border px-3 text-center text-xs font-semibold', safetyOverride ? 'border-slate-200 bg-white text-slate-800' : 'border-white/15 bg-white/5 text-white')}
                  >
                    Find a clinician
                  </Link>
                  <Link
                    href="/appointments"
                    className={cn('inline-flex min-h-11 items-center justify-center rounded-xl border px-3 text-center text-xs font-semibold', safetyOverride ? 'border-slate-200 bg-white text-slate-800' : 'border-white/15 bg-white/5 text-white')}
                  >
                    Appointments
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>

        {!safetyOverride ? (
          <>
            <section className="mt-3 rounded-[24px] border border-white/80 bg-white/82 p-4 shadow-[0_16px_46px_rgba(15,23,42,0.045)] md:mt-4 md:rounded-[28px] md:p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Care Mesh</div>
                  <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-slate-950 md:text-2xl">Your connected Contactless Medicine environment</h2>
                </div>
                <Link href="/myCare/devices" className="hidden items-center gap-1.5 text-sm font-semibold text-slate-700 sm:inline-flex">
                  Manage devices <ChevronRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex min-w-max gap-2.5 sm:grid sm:min-w-0 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
                  {meshNodes.map((node) => <MeshNodeCard key={node.id} node={node} />)}
                </div>
              </div>
            </section>

            <div className="mt-3 grid gap-3 md:mt-4 md:gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
              <section className="rounded-[24px] border border-white/80 bg-white/84 p-4 shadow-[0_16px_46px_rgba(15,23,42,0.045)] md:rounded-[28px] md:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Care Journey</div>
                    <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-slate-950 md:text-2xl">What moved through your care space</h2>
                  </div>
                  <Link href="/encounters" className="hidden text-sm font-semibold text-slate-700 sm:block">Open history</Link>
                </div>

                <div className="mt-3 divide-y divide-slate-100">
                  {journeyEvents.length > 0 ? (
                    journeyEvents.map((event) => <JourneyRow key={event.id} event={event} />)
                  ) : (
                    <div className="py-6 text-sm text-slate-500">No recent care events are available yet.</div>
                  )}
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-900 bg-slate-950 p-4 text-white shadow-[0_20px_60px_rgba(2,8,23,0.14)] md:rounded-[28px] md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200/70">InsightCore</div>
                    <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-white md:text-2xl">Intelligence, without the noise</h2>
                  </div>
                  <BrainCircuit className="h-5 w-5 text-violet-300" />
                </div>

                <div className="mt-5 space-y-3">
                  {alertsLoading ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">Refreshing current care intelligence…</div>
                  ) : aiInsights.length > 0 ? (
                    aiInsights.map((insight, index) => (
                      <div key={`${insight}-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-start gap-3">
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet-400" />
                          <div className="text-sm leading-6 text-slate-200">{insight}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
                      No new InsightCore interpretation is available in this session. Your raw care state remains visible above.
                    </div>
                  )}
                </div>

                {alerts.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {alerts.map((alert) => (
                      <Link key={alert.id} href="/insights" className="block rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="truncate text-sm font-semibold text-white">{alert.title}</div>
                          <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold', severityClasses(alert.severity))}>{severityLabel(alert.severity)}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : null}

                {alertsError ? <div className="mt-4 text-xs text-amber-200">{alertsError}</div> : null}

                <Link href="/insights" className="mt-5 inline-flex min-h-11 w-full items-center justify-between rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950">
                  Open InsightCore
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </section>
            </div>

            <section className="mt-3 grid gap-3 md:mt-4 md:grid-cols-2 md:gap-4">
              <div className="rounded-[24px] border border-white/80 bg-white/84 p-4 shadow-[0_16px_46px_rgba(15,23,42,0.045)] md:rounded-[28px] md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Treatment</div>
                    <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-slate-950">Medication continuity</h2>
                  </div>
                  <Syringe className="h-5 w-5 text-emerald-600" />
                </div>

                <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-4 rounded-2xl bg-slate-950 p-4 text-white">
                  <div className="text-[2.25rem] font-semibold tracking-[-0.05em] [font-variant-numeric:tabular-nums]">
                    {adherencePct === null ? '—' : `${adherencePct}%`}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{adherencePct === null ? 'No adherence score available' : 'Recorded adherence'}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-400">
                      {meds.length === 0
                        ? 'No active medication schedule is represented as 100% adherence.'
                        : hasAdherenceHistory
                          ? 'Longitudinal adherence history is available.'
                          : 'A trend will appear when sufficient medication history exists.'}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {meds.slice(0, 3).map((med, index) => (
                    <span key={med.id ?? index} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700">
                      {med.name ?? 'Medication'}{med.time ? ` · ${med.time}` : ''}
                    </span>
                  ))}
                  {meds.length === 0 ? <span className="text-sm text-slate-500">No medication schedule loaded.</span> : null}
                </div>

                <Link href="/medications" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-900">
                  Open medications <ChevronRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="rounded-[24px] border border-white/80 bg-white/84 p-4 shadow-[0_16px_46px_rgba(15,23,42,0.045)] md:rounded-[28px] md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">History & Safety</div>
                    <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-slate-950">Longitudinal record</h2>
                  </div>
                  <Shield className="h-5 w-5 text-slate-700" />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Allergies recorded</div>
                    <div className="mt-2 text-xl font-semibold text-slate-950">{allergyNames.length}</div>
                    <div className="mt-2 text-xs leading-5 text-slate-500">
                      {allergyNames.length ? allergyNames.slice(0, 2).join(' · ') : 'No allergy entries returned by the profile API.'}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Recent encounters</div>
                    <div className="mt-2 text-xl font-semibold text-slate-950">{cases.length}</div>
                    <div className="mt-2 text-xs leading-5 text-slate-500">Clinical history remains available through your care record.</div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/reports" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white">Reports <ArrowRight className="h-4 w-4" /></Link>
                  <Link href="/myCare" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800">Open myCare <ChevronRight className="h-4 w-4" /></Link>
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="mt-3 rounded-[24px] border border-slate-300 bg-white p-4 md:mt-4 md:rounded-[28px] md:p-6">
            <div className="flex items-start gap-4">
              <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', careState === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-950">Safety override active</div>
                <div className="mt-1 text-sm leading-6 text-slate-600">Secondary visual layers are deliberately reduced while a higher-priority care state is active. Resolve the current action before returning to the full care environment.</div>
              </div>
            </div>
          </section>
        )}

        <section className="mt-3 grid grid-cols-2 gap-2.5 md:mt-4 md:grid-cols-4 md:gap-3">
          {[
            { label: 'Auto Triage', href: '/auto-triage', icon: Activity },
            { label: 'myCare', href: '/myCare', icon: HeartPulse },
            { label: 'Reports', href: '/reports', icon: TrendingUp },
            { label: 'Appointments', href: '/appointments', icon: CalendarDays },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.label} href={item.href} className="group flex min-h-[76px] items-center justify-between rounded-2xl border border-white/80 bg-white/82 px-4 py-3 shadow-[0_12px_34px_rgba(15,23,42,0.04)]">
                <div>
                  <div className="text-sm font-semibold text-slate-950">{item.label}</div>
                  <div className="mt-1 text-[11px] font-medium text-slate-400">Open module</div>
                </div>
                <Icon className="h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </section>

        <div className="sr-only" aria-live="polite">
          {alertsLoading ? 'Refreshing alerts' : `${alerts.length} active alerts loaded`}
        </div>
      </div>
    </main>
  );
}
