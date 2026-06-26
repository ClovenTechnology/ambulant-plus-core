// apps/patient-app/components/iomt/HMPane.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Bluetooth,
  CheckCircle2,
  CircleStop,
  Cpu,
  Droplets,
  HeartPulse,
  Play,
  ShieldCheck,
  Stethoscope,
  Thermometer,
  Waves,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { createHealthMonitorSession } from '@/src/devices/healthMonitorSession';
import type {
  HealthMonitorLiveEvent,
  HealthMonitorSessionState,
} from '@/src/devices/healthMonitorSession';

type VitalKind = 'bp' | 'spo2' | 'hr' | 'temp' | 'glu' | 'ecg';

type HealthMonitorMeasurementKind =
  | 'hr'
  | 'spo2'
  | 'temp'
  | 'bp'
  | 'glucose'
  | 'ecg';

type HMPaneProps = {
  embedded?: boolean;
  roomId?: string;
  patientId?: string;
  className?: string;
  onResult?: (result: HealthMonitorReading) => void;
};

type DeviceTelemetry = {
  id: string;
  name: string;
  transport: 'ble' | 'wifi' | 'usb';
  connected: boolean;
  batteryPct?: number | null;
  rssi?: number | null;
};

type HealthMonitorReading = {
  id: string;
  kind: VitalKind;
  label: string;
  primary: string;
  secondary?: string;
  unit?: string;
  at: string;
  source: 'health_monitor';
  payload: Record<string, any>;
};

type VitalMeta = {
  id: VitalKind;
  label: string;
  short: string;
  icon: LucideIcon;
  description: string;
};

const EMPTY_SESSION_STATE: HealthMonitorSessionState = {
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
};

const VITALS: VitalMeta[] = [
  {
    id: 'bp',
    label: 'Blood Pressure',
    short: 'BP',
    icon: ShieldCheck,
    description: 'Systolic / diastolic pressure',
  },
  {
    id: 'spo2',
    label: 'Blood Oxygen',
    short: 'SpO₂',
    icon: Activity,
    description: 'Oxygen saturation and pulse',
  },
  {
    id: 'hr',
    label: 'Heart Rate',
    short: 'HR',
    icon: HeartPulse,
    description: 'Pulse rate',
  },
  {
    id: 'temp',
    label: 'Temperature',
    short: 'Temp',
    icon: Thermometer,
    description: 'Body temperature',
  },
  {
    id: 'glu',
    label: 'Blood Glucose',
    short: 'Glucose',
    icon: Droplets,
    description: 'Glucose reading',
  },
  {
    id: 'ecg',
    label: 'ECG',
    short: 'ECG',
    icon: Waves,
    description: 'ECG sample summary',
  },
];

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function toSessionMeasurementKind(kind: VitalKind): HealthMonitorMeasurementKind {
  switch (kind) {
    case 'glu':
      return 'glucose';
    case 'bp':
    case 'spo2':
    case 'hr':
    case 'temp':
    case 'ecg':
      return kind;
    default:
      return 'bp';
  }
}

function getUrlValue(keys: string[]) {
  if (typeof window === 'undefined') return '';

  const url = new URL(window.location.href);

  for (const key of keys) {
    const value = url.searchParams.get(key);
    if (value && value.trim()) return value.trim();
  }

  return '';
}

function createReadingId(kind: VitalKind, at: string) {
  return `hm-${kind}-${Date.parse(at) || Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function getVitalMeta(kind: VitalKind) {
  return VITALS.find((item) => item.id === kind) || VITALS[0];
}

function getSourceRoom(roomId?: string) {
  return (
    String(roomId || '').trim() || getUrlValue(['roomId', 'room', 'visitId'])
  );
}

function getSourcePatient(patientId?: string) {
  return (
    String(patientId || '').trim() ||
    getUrlValue(['patientId', 'subjectPatientId', 'patient', 'id'])
  );
}

function localStorageKeys(args: { roomId?: string; patientId?: string }) {
  const keys: string[] = [];

  if (args.roomId) {
    keys.push(`latestVitals:${args.roomId}`);
    keys.push(`vitals:${args.roomId}`);
    keys.push(`patient-lobby-vitals:${args.roomId}`);
    keys.push(`health-monitor-history:${args.roomId}`);
  }

  if (args.patientId) {
    keys.push(`latestVitals:${args.patientId}`);
    keys.push(`vitals:${args.patientId}`);
    keys.push(`health-monitor-history:${args.patientId}`);
  }

  return keys;
}

function writeLatestSnapshot(args: {
  roomId?: string;
  patientId?: string;
  patch: Record<string, any>;
}) {
  if (typeof window === 'undefined') return;

  const keys = localStorageKeys({
    roomId: args.roomId,
    patientId: args.patientId,
  }).filter((key) => !key.includes('history'));

  const next = {
    ts: Date.now(),
    source: 'health_monitor',
    ...args.patch,
  };

  for (const key of keys) {
    try {
      const previous = JSON.parse(window.localStorage.getItem(key) || '{}');
      window.localStorage.setItem(key, JSON.stringify({ ...previous, ...next }));
    } catch {
      window.localStorage.setItem(key, JSON.stringify(next));
    }
  }
}

function readHistory(args: { roomId?: string; patientId?: string }) {
  if (typeof window === 'undefined') return [];

  const keys = localStorageKeys({
    roomId: args.roomId,
    patientId: args.patientId,
  }).filter((key) => key.includes('history'));

  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as HealthMonitorReading[];
    } catch {
      // Ignore malformed local history.
    }
  }

  return [];
}

function writeHistory(args: {
  roomId?: string;
  patientId?: string;
  history: HealthMonitorReading[];
}) {
  if (typeof window === 'undefined') return;

  const keys = localStorageKeys({
    roomId: args.roomId,
    patientId: args.patientId,
  }).filter((key) => key.includes('history'));

  for (const key of keys) {
    try {
      window.localStorage.setItem(key, JSON.stringify(args.history.slice(0, 30)));
    } catch {
      // Storage may be unavailable in some browser modes.
    }
  }
}

async function postVital(args: {
  patientId?: string;
  kind: VitalKind;
  payload: Record<string, any>;
  recordedAt: string;
  roomId?: string;
}) {
  if (!args.patientId) return { ok: true, skipped: true };

  const typeMap: Record<VitalKind, string> = {
    bp: 'blood_pressure',
    spo2: 'spo2',
    hr: 'heart_rate',
    temp: 'temperature',
    glu: 'blood_glucose',
    ecg: 'ecg',
  };

  try {
    const res = await fetch(
      `/api/v1/patients/${encodeURIComponent(args.patientId)}/vitals`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: typeMap[args.kind],
          payload: args.payload,
          deviceId: 'duecare-health-monitor',
          recorded_at: args.recordedAt,
          meta: {
            source: 'health_monitor',
            device_class: 'medical',
            source_priority: 100,
            device_id: 'duecare-health-monitor',
            capture_surface: 'televisit_health_monitor',
            room_id: args.roomId || null,
          },
        }),
      },
    );

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: await res.text().catch(() => ''),
      };
    }

    return res.json().catch(() => ({ ok: true }));
  } catch (err: any) {
    return { ok: false, error: err?.message || 'vital_post_failed' };
  }
}

function readingFromEvent(evt: HealthMonitorLiveEvent): HealthMonitorReading | null {
  const detail: any = evt.detail || {};
  const at = String(detail.recordedAt || detail.at || new Date().toISOString());

  if (evt.type === 'bp_result') {
    return {
      id: createReadingId('bp', at),
      kind: 'bp',
      label: 'Blood Pressure',
      primary: `${detail.systolic ?? '—'}/${detail.diastolic ?? '—'}`,
      secondary:
        detail.pulse != null ? `Pulse ${detail.pulse} bpm` : 'Pressure captured',
      unit: 'mmHg',
      at,
      source: 'health_monitor',
      payload: {
        systolic: detail.systolic ?? null,
        diastolic: detail.diastolic ?? null,
        pulse: detail.pulse ?? null,
      },
    };
  }

  if (evt.type === 'spo2_result') {
    return {
      id: createReadingId('spo2', at),
      kind: 'spo2',
      label: 'Blood Oxygen',
      primary: detail.spo2 != null ? String(detail.spo2) : '—',
      secondary:
        detail.pulse != null
          ? `Pulse ${detail.pulse} bpm`
          : detail.pi != null
            ? `PI ${detail.pi}`
            : 'Oxygen reading captured',
      unit: '%',
      at,
      source: 'health_monitor',
      payload: {
        pct: detail.spo2 ?? null,
        spo2: detail.spo2 ?? null,
        pulse: detail.pulse ?? null,
        pi: detail.pi ?? null,
      },
    };
  }

  if (evt.type === 'temp_result') {
    return {
      id: createReadingId('temp', at),
      kind: 'temp',
      label: 'Temperature',
      primary:
        detail.celsius != null
          ? Number(detail.celsius).toFixed(1)
          : detail.temp != null
            ? Number(detail.temp).toFixed(1)
            : '—',
      secondary:
        detail.fahrenheit != null
          ? `${Number(detail.fahrenheit).toFixed(1)} °F`
          : 'Temperature captured',
      unit: '°C',
      at,
      source: 'health_monitor',
      payload: {
        celsius: detail.celsius ?? detail.temp ?? null,
        fahrenheit: detail.fahrenheit ?? null,
      },
    };
  }

  if (evt.type === 'glucose_result') {
    return {
      id: createReadingId('glu', at),
      kind: 'glu',
      label: 'Blood Glucose',
      primary: detail.glucose != null ? String(detail.glucose) : '—',
      secondary: 'Glucose reading captured',
      unit: detail.unit || 'mmol/L',
      at,
      source: 'health_monitor',
      payload: {
        glucose: detail.glucose ?? null,
        unit: detail.unit || 'mmol/L',
      },
    };
  }

  if (evt.type === 'ecg_cycle_complete') {
    const heartRate = typeof detail.heartRate === 'number' ? Math.round(detail.heartRate) : null;
    const sampleCount = typeof detail.sampleCount === 'number' ? detail.sampleCount : null;
    const signalQuality =
      typeof detail.signalQuality === 'number' ? Math.round(detail.signalQuality) : null;
    const durationSec =
      typeof detail.durationSec === 'number' && Number.isFinite(detail.durationSec)
        ? detail.durationSec
        : null;

    const secondary = [
      sampleCount != null ? `${sampleCount} samples` : null,
      signalQuality != null ? `Signal quality ${signalQuality}` : null,
      durationSec != null ? `${durationSec}s` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    return {
      id: createReadingId('ecg', at),
      kind: 'ecg',
      label: 'ECG',
      primary: heartRate != null ? String(heartRate) : sampleCount != null ? String(sampleCount) : '—',
      secondary:
        secondary ||
        detail.conclusion ||
        (detail.reason ? String(detail.reason).replace(/_/g, ' ') : 'ECG session completed'),
      unit: heartRate != null ? 'bpm' : 'samples',
      at,
      source: 'health_monitor',
      payload: {
        sampleCount,
        signalQuality,
        sampleHz: detail.sampleHz ?? null,
        durationSec,
        heartRate,
        conclusion: detail.conclusion ?? null,
        reason: detail.reason ?? null,
        waveformPreview: Array.isArray(detail.waveformPreview) ? detail.waveformPreview : [],
        summary: {
          conclusion: detail.conclusion ?? null,
          heartRate,
          signalQuality,
          sampleCount,
          durationSec,
        },
      },
    };
  }

  return null;
}

function readingFromState(
  kind: VitalKind,
  state: HealthMonitorSessionState,
): HealthMonitorReading | null {
  const now = new Date().toISOString();

  if (kind === 'bp' && state.lastBpResult) {
    const r: any = state.lastBpResult;
    const at = String(r.recordedAt || now);

    return {
      id: createReadingId('bp', at),
      kind: 'bp',
      label: 'Blood Pressure',
      primary: `${r.systolic ?? '—'}/${r.diastolic ?? '—'}`,
      secondary: r.pulse != null ? `Pulse ${r.pulse} bpm` : 'Pressure captured',
      unit: 'mmHg',
      at,
      source: 'health_monitor',
      payload: {
        systolic: r.systolic ?? null,
        diastolic: r.diastolic ?? null,
        pulse: r.pulse ?? null,
      },
    };
  }

  if (kind === 'spo2' && state.lastSpo2Result) {
    const r: any = state.lastSpo2Result;
    const at = String(r.recordedAt || now);

    return {
      id: createReadingId('spo2', at),
      kind: 'spo2',
      label: 'Blood Oxygen',
      primary: r.spo2 != null ? String(r.spo2) : '—',
      secondary: r.pulse != null ? `Pulse ${r.pulse} bpm` : 'Oxygen captured',
      unit: '%',
      at,
      source: 'health_monitor',
      payload: {
        pct: r.spo2 ?? null,
        spo2: r.spo2 ?? null,
        pulse: r.pulse ?? null,
        pi: r.pi ?? null,
      },
    };
  }

  if (kind === 'hr') {
    const pulse =
      (state.lastSpo2Result as any)?.pulse ??
      (state.lastBpResult as any)?.pulse ??
      null;

    const at =
      (state.lastSpo2Result as any)?.recordedAt ||
      (state.lastBpResult as any)?.recordedAt ||
      now;

    if (pulse == null) return null;

    return {
      id: createReadingId('hr', String(at)),
      kind: 'hr',
      label: 'Heart Rate',
      primary: String(pulse),
      secondary:
        (state.lastSpo2Result as any)?.spo2 != null
          ? `SpO₂ ${(state.lastSpo2Result as any).spo2}%`
          : 'Pulse captured',
      unit: 'bpm',
      at: String(at),
      source: 'health_monitor',
      payload: {
        bpm: pulse,
        spo2: (state.lastSpo2Result as any)?.spo2 ?? null,
      },
    };
  }

  if (kind === 'temp' && state.lastTempResult) {
    const r: any = state.lastTempResult;
    const at = String(r.recordedAt || now);

    return {
      id: createReadingId('temp', at),
      kind: 'temp',
      label: 'Temperature',
      primary: r.celsius != null ? Number(r.celsius).toFixed(1) : '—',
      secondary:
        r.fahrenheit != null
          ? `${Number(r.fahrenheit).toFixed(1)} °F`
          : 'Temperature captured',
      unit: '°C',
      at,
      source: 'health_monitor',
      payload: {
        celsius: r.celsius ?? null,
        fahrenheit: r.fahrenheit ?? null,
      },
    };
  }

  if (kind === 'glu' && state.lastGlucoseResult) {
    const r: any = state.lastGlucoseResult;
    const at = String(r.recordedAt || now);

    return {
      id: createReadingId('glu', at),
      kind: 'glu',
      label: 'Blood Glucose',
      primary: r.glucose != null ? String(r.glucose) : '—',
      secondary: 'Glucose captured',
      unit: r.unit || 'mmol/L',
      at,
      source: 'health_monitor',
      payload: {
        glucose: r.glucose ?? null,
        unit: r.unit || 'mmol/L',
      },
    };
  }

  if (kind === 'ecg' && state.lastEcgCycleComplete) {
    const r: any = state.lastEcgCycleComplete;
    const at = String(r.recordedAt || now);
    const heartRate = typeof r.heartRate === 'number' ? Math.round(r.heartRate) : null;
    const sampleCount = typeof r.sampleCount === 'number' ? r.sampleCount : null;
    const signalQuality =
      typeof r.signalQuality === 'number' ? Math.round(r.signalQuality) : null;
    const durationSec =
      typeof r.durationSec === 'number' && Number.isFinite(r.durationSec)
        ? r.durationSec
        : null;

    const secondary = [
      sampleCount != null ? `${sampleCount} samples` : null,
      signalQuality != null ? `Signal quality ${signalQuality}` : null,
      durationSec != null ? `${durationSec}s` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    return {
      id: createReadingId('ecg', at),
      kind: 'ecg',
      label: 'ECG',
      primary: heartRate != null ? String(heartRate) : sampleCount != null ? String(sampleCount) : '—',
      secondary: secondary || r.conclusion || 'ECG session completed',
      unit: heartRate != null ? 'bpm' : 'samples',
      at,
      source: 'health_monitor',
      payload: {
        sampleCount,
        signalQuality,
        sampleHz: r.sampleHz ?? null,
        durationSec,
        heartRate,
        conclusion: r.conclusion ?? null,
        reason: r.reason ?? null,
        waveformPreview: Array.isArray(r.waveformPreview) ? r.waveformPreview : [],
        summary: {
          conclusion: r.conclusion ?? null,
          heartRate,
          signalQuality,
          sampleCount,
          durationSec,
        },
      },
    };
  }

  return null;
}

function snapshotPatchFromReading(reading: HealthMonitorReading) {
  if (reading.kind === 'bp') {
    return {
      sys: reading.payload.systolic ?? null,
      dia: reading.payload.diastolic ?? null,
      hr: reading.payload.pulse ?? undefined,
    };
  }

  if (reading.kind === 'spo2') {
    return {
      spo2: reading.payload.spo2 ?? reading.payload.pct ?? null,
      hr: reading.payload.pulse ?? undefined,
    };
  }

  if (reading.kind === 'hr') {
    return {
      hr: reading.payload.bpm ?? null,
      spo2: reading.payload.spo2 ?? undefined,
    };
  }

  if (reading.kind === 'temp') {
    return {
      tempC: reading.payload.celsius ?? null,
    };
  }

  if (reading.kind === 'glu') {
    return {
      glucose: reading.payload.glucose ?? null,
      glucoseUnit: reading.payload.unit ?? null,
    };
  }

  if (reading.kind === 'ecg') {
    return {
      ecgSampleCount: reading.payload.sampleCount ?? null,
      ecgSignalQuality: reading.payload.signalQuality ?? null,
      ecgHeartRate: reading.payload.heartRate ?? null,
      ecgDurationSec: reading.payload.durationSec ?? null,
      ecgConclusion: reading.payload.conclusion ?? null,
    };
  }

  return {};
}

function formatTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Waveform({
  kind,
  samples,
  active,
}: {
  kind: VitalKind;
  samples: number[];
  active: boolean;
}) {
  const points = useMemo(() => {
    const clean = samples.slice(-80);

    if (clean.length >= 2) {
      const min = Math.min(...clean);
      const max = Math.max(...clean);
      const span = Math.max(1, max - min);

      return clean
        .map((value, index) => {
          const x = (index / Math.max(1, clean.length - 1)) * 100;
          const y = 50 - ((value - min) / span - 0.5) * 62;
          return `${x.toFixed(2)},${Math.max(8, Math.min(92, y)).toFixed(2)}`;
        })
        .join(' ');
    }

    if (kind === 'ecg') {
      return '0,55 8,55 12,25 16,85 20,55 34,55 42,55 46,35 50,75 54,55 68,55 80,55 84,28 88,82 92,55 100,55';
    }

    return '0,55 8,46 16,54 24,43 32,58 40,46 48,55 56,44 64,58 72,47 80,56 88,43 100,52';
  }, [kind, samples]);

  if (!['spo2', 'hr', 'ecg'].includes(kind)) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px] opacity-30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.22),transparent_45%)]" />
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className={cn(
          'absolute inset-x-0 top-1/2 h-28 w-full -translate-y-1/2',
          active ? 'animate-pulse' : '',
        )}
      >
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-cyan-500"
        />
      </svg>
    </div>
  );
}

function ResultScreen({
  selected,
  latest,
  streaming,
  samples,
  state,
}: {
  selected: VitalKind;
  latest: HealthMonitorReading | null;
  streaming: boolean;
  samples: number[];
  state: HealthMonitorSessionState;
}) {
  const meta = getVitalMeta(selected);
  const Icon = meta.icon;

  const standbyText =
    selected === 'ecg'
      ? 'Start ECG to capture a sample summary.'
      : selected === 'spo2' || selected === 'hr'
        ? 'Start reading to view live pulse waveform and result.'
        : 'Start reading when the patient is ready.';

  return (
    <div className="relative min-h-[240px] overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-cyan-50/50 p-5">
      <Waveform kind={selected} samples={samples} active={streaming} />

      <div className="relative z-10 flex min-h-[210px] flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
              <Icon className="h-3.5 w-3.5 text-cyan-700" />
              {meta.label}
            </div>

            <h3 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
              {streaming
                ? 'Reading...'
                : latest?.kind === selected
                  ? latest.primary
                  : 'Ready'}
              {latest?.kind === selected && latest.unit ? (
                <span className="ml-2 text-base font-medium text-slate-500">
                  {latest.unit}
                </span>
              ) : null}
            </h3>

            <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
              {streaming
                ? selected === 'spo2' || selected === 'hr'
                  ? `Live pulse samples: ${samples.length}`
                  : selected === 'ecg'
                    ? `Live ECG samples: ${samples.length}`
                    : 'Waiting for a stable device result.'
                : latest?.kind === selected
                  ? latest.secondary || 'Result captured'
                  : standbyText}
            </p>
          </div>

          <div
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-semibold',
              streaming
                ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
                : latest?.kind === selected
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-600',
            )}
          >
            {streaming
              ? 'Live'
              : latest?.kind === selected
                ? 'Captured'
                : state.connected
                  ? 'Standby'
                  : 'Offline'}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/80 bg-white/80 p-3 shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
              Device
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {state.connected
                ? 'Connected'
                : state.connecting
                  ? 'Connecting'
                  : 'Not connected'}
            </div>
          </div>

          <div className="rounded-2xl border border-white/80 bg-white/80 p-3 shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
              Module
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {meta.short}
            </div>
          </div>

          <div className="rounded-2xl border border-white/80 bg-white/80 p-3 shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
              Latest
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {latest?.kind === selected ? formatTime(latest.at) : '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryList({
  history,
  selected,
}: {
  history: HealthMonitorReading[];
  selected: VitalKind;
}) {
  const filtered = history.filter((item) => item.kind === selected).slice(0, 6);

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-950">
            Historic readings
          </div>
          <div className="text-xs text-slate-500">
            Latest saved readings for this vital.
          </div>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
          {filtered.length}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
          No historic reading yet.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((reading) => (
            <div
              key={reading.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {reading.primary}
                  {reading.unit ? (
                    <span className="ml-1 text-xs font-medium text-slate-500">
                      {reading.unit}
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-slate-500">
                  {reading.secondary || reading.label}
                </div>
              </div>

              <div className="text-xs text-slate-500">{formatTime(reading.at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HMPane({
  embedded = false,
  roomId,
  patientId,
  className,
  onResult,
}: HMPaneProps) {
  const resolvedRoomId = getSourceRoom(roomId);
  const directPatientId = getSourcePatient(patientId);
  const [profilePatientId, setProfilePatientId] = useState('');
  const resolvedPatientId = directPatientId || profilePatientId;

  const [selected, setSelected] = useState<VitalKind>('bp');
  const [sessionState, setSessionState] =
    useState<HealthMonitorSessionState>(EMPTY_SESSION_STATE);
  const [device, setDevice] = useState<DeviceTelemetry | null>(null);
  const [history, setHistory] = useState<HealthMonitorReading[]>([]);
  const [latest, setLatest] = useState<HealthMonitorReading | null>(null);
  const [actionNote, setActionNote] = useState<string | null>(null);
  const [liveEcgSamples, setLiveEcgSamples] = useState<number[]>([]);
  const [livePpgSamples, setLivePpgSamples] = useState<number[]>([]);

  const sessionRef = useRef<ReturnType<typeof createHealthMonitorSession> | null>(
    null,
  );

  const selectedMeta = getVitalMeta(selected);
  const selectedSessionKind = toSessionMeasurementKind(selected);

  const selectedStreaming =
    sessionState.streaming &&
    (sessionState.mode === selectedSessionKind ||
      (selected === 'hr' && sessionState.mode === 'spo2'));

  const selectedSamples =
    selected === 'ecg'
      ? liveEcgSamples
      : selected === 'spo2' || selected === 'hr'
        ? livePpgSamples
        : [];

  useEffect(() => {
    if (directPatientId) {
      setProfilePatientId('');
      return;
    }

    let cancelled = false;

    async function loadProfilePatientId() {
      try {
        const res = await fetch('/api/profile', { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (cancelled || !res.ok || data?.ok === false) return;

        const profile = data?.profile || data || {};
        const nextPatientId = String(
          profile.patientId || profile.id || profile.subjectPatientId || '',
        ).trim();

        if (!cancelled) setProfilePatientId(nextPatientId);
      } catch {
        if (!cancelled) setProfilePatientId('');
      }
    }

    void loadProfilePatientId();

    return () => {
      cancelled = true;
    };
  }, [directPatientId]);


  const latestForSelected = useMemo(() => {
    if (latest?.kind === selected) return latest;

    return (
      history.find((item) => item.kind === selected) ||
      readingFromState(selected, sessionState)
    );
  }, [history, latest, selected, sessionState]);

  function recordReading(reading: HealthMonitorReading) {
    setLatest(reading);

    const patch = snapshotPatchFromReading(reading);

    writeLatestSnapshot({
      roomId: resolvedRoomId,
      patientId: resolvedPatientId,
      patch,
    });

    setHistory((prev) => {
      const next = [reading, ...prev.filter((item) => item.id !== reading.id)].slice(
        0,
        30,
      );

      writeHistory({
        roomId: resolvedRoomId,
        patientId: resolvedPatientId,
        history: next,
      });

      return next;
    });

    onResult?.(reading);

    void postVital({
      patientId: resolvedPatientId,
      kind: reading.kind,
      payload: reading.payload,
      recordedAt: reading.at,
      roomId: resolvedRoomId,
    });

    setActionNote(`${reading.label} captured.`);
  }

  useEffect(() => {
    setHistory(
      readHistory({
        roomId: resolvedRoomId,
        patientId: resolvedPatientId,
      }),
    );
  }, [resolvedPatientId, resolvedRoomId]);

  useEffect(() => {
    const session = createHealthMonitorSession({
      patientId: resolvedPatientId || 'unassigned',
      onState: (state) => {
        setSessionState(state);
      },
      onLiveEvent: (evt: HealthMonitorLiveEvent) => {
        if (evt.type === 'ecg') {
          const samples = Array.isArray((evt as any).detail?.samples)
            ? (evt as any).detail.samples
            : [];

          setLiveEcgSamples((prev) => [...prev, ...samples].slice(-480));
        }

        if (evt.type === 'ppg') {
          const samples = Array.isArray((evt as any).detail?.samples)
            ? (evt as any).detail.samples
            : [];

          setLivePpgSamples((prev) => [...prev, ...samples].slice(-320));
        }

        const reading = readingFromEvent(evt);
        if (reading) {
          recordReading(reading);
        }
      },
    });

    sessionRef.current = session;

    const onTelemetry = (event: Event) => {
      const detail = (event as CustomEvent).detail as DeviceTelemetry | undefined;
      if (!detail?.id || detail.id !== 'duecare-health-monitor') return;
      setDevice(detail);
    };

    window.addEventListener('iomt:telemetry', onTelemetry as EventListener);

    return () => {
      window.removeEventListener('iomt:telemetry', onTelemetry as EventListener);
      const current = sessionRef.current;
      sessionRef.current = null;
      void current?.disconnect().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedPatientId]);

  async function connect() {
    try {
      if (sessionState.connected || sessionState.connecting) return;

      setActionNote('Connecting Health Monitor...');
      await sessionRef.current?.connect();
      setActionNote('Health Monitor connected.');
    } catch (err: any) {
      setActionNote(err?.message || 'Could not connect Health Monitor.');
    }
  }

  async function disconnect() {
    try {
      await sessionRef.current?.disconnect();
      setLiveEcgSamples([]);
      setLivePpgSamples([]);
      setActionNote('Health Monitor disconnected.');
    } catch (err: any) {
      setActionNote(err?.message || 'Could not disconnect Health Monitor.');
    }
  }

  async function start() {
    try {
      if (!sessionState.connected) {
        await connect();
      }

      if (selected === 'ecg') setLiveEcgSamples([]);
      if (selected === 'spo2' || selected === 'hr') setLivePpgSamples([]);

      setActionNote(`Starting ${selectedMeta.label}...`);
      await sessionRef.current?.startMeasurement(
        toSessionMeasurementKind(selected),
      );
    } catch (err: any) {
      setActionNote(err?.message || `Could not start ${selectedMeta.label}.`);
    }
  }

  async function stop() {
    try {
      await sessionRef.current?.stopMeasurement();

      const reading = readingFromState(selected, sessionState);
      if (reading) recordReading(reading);

      setActionNote('Measurement stopped.');
    } catch (err: any) {
      setActionNote(err?.message || 'Could not stop measurement.');
    }
  }

  return (
    <section
      className={cn(
        'rounded-[30px] border border-slate-200 bg-white p-4 shadow-sm',
        embedded ? 'w-full' : 'mx-auto max-w-4xl',
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700">
            <Stethoscope className="h-3.5 w-3.5" />
            Health Monitor
          </div>

          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
            Quick vitals capture
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Select one vital, start the reading, then stop when complete. Results
            are saved for the consultation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium',
              sessionState.connected
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : sessionState.connecting
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-slate-200 bg-slate-50 text-slate-600',
            )}
          >
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                sessionState.connected
                  ? 'bg-emerald-500'
                  : sessionState.connecting
                    ? 'bg-amber-500'
                    : 'bg-slate-400',
              )}
            />
            {sessionState.connected
              ? 'Connected'
              : sessionState.connecting
                ? 'Connecting'
                : 'Standby'}
          </span>

          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
            <Bluetooth className="h-3.5 w-3.5" />
            {device?.transport?.toUpperCase() || 'BLE'}
          </span>

          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
            <Cpu className="h-3.5 w-3.5" />
            {typeof (device?.batteryPct ?? sessionState.batteryPct) === 'number'
              ? `${device?.batteryPct ?? sessionState.batteryPct}%`
              : 'Battery —'}
          </span>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 md:grid-cols-6">
        {VITALS.map((vital) => {
          const Icon = vital.icon;
          const active = selected === vital.id;

          return (
            <button
              key={vital.id}
              type="button"
              onClick={() => setSelected(vital.id)}
              className={cn(
                'rounded-2xl border px-3 py-3 text-center transition',
                active
                  ? 'border-cyan-200 bg-cyan-50 text-cyan-800 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              <Icon
                className={cn(
                  'mx-auto h-5 w-5',
                  active ? 'text-cyan-700' : 'text-slate-500',
                )}
              />
              <div className="mt-2 text-xs font-semibold">{vital.short}</div>
            </button>
          );
        })}
      </div>

      <ResultScreen
        selected={selected}
        latest={latestForSelected}
        streaming={selectedStreaming}
        samples={selectedSamples}
        state={sessionState}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={connect}
          disabled={sessionState.connected || sessionState.connecting}
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition',
            sessionState.connected
              ? 'cursor-default border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60',
          )}
        >
          <CheckCircle2 className="h-4 w-4" />
          {sessionState.connected
            ? 'Connected'
            : sessionState.connecting
              ? 'Connecting...'
              : 'Connect'}
        </button>

        {!selectedStreaming ? (
          <button
            type="button"
            onClick={start}
            disabled={sessionState.connecting}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Play className="h-4 w-4" />
            Start {selectedMeta.short}
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500"
          >
            <CircleStop className="h-4 w-4" />
            Stop reading
          </button>
        )}

        <button
          type="button"
          onClick={disconnect}
          disabled={!sessionState.connected && !sessionState.connecting}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Disconnect
        </button>
      </div>

      {(actionNote || sessionState.error) && (
        <div
          className={cn(
            'mt-4 rounded-2xl border px-4 py-3 text-sm',
            sessionState.error
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-slate-200 bg-slate-50 text-slate-700',
          )}
        >
          {sessionState.error || actionNote}
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-950">
                Current result
              </div>
              <div className="text-xs text-slate-500">
                General result screen for the selected vital.
              </div>
            </div>

            <span className="rounded-full border border-white bg-white px-3 py-1 text-xs font-medium text-slate-600">
              {selectedMeta.label}
            </span>
          </div>

          {latestForSelected ? (
            <div className="rounded-2xl border border-white bg-white p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
                {latestForSelected.label}
              </div>
              <div className="mt-2 text-3xl font-semibold text-slate-950">
                {latestForSelected.primary}
                {latestForSelected.unit ? (
                  <span className="ml-2 text-base font-medium text-slate-500">
                    {latestForSelected.unit}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 text-sm text-slate-600">
                {latestForSelected.secondary || 'Captured reading'}
              </div>
              <div className="mt-3 text-xs text-slate-500">
                {new Date(latestForSelected.at).toLocaleString()}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              No result yet. Select a vital and press Start.
            </div>
          )}
        </div>

        <HistoryList history={history} selected={selected} />
      </div>
    </section>
  );
}