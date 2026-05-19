'use client';

import type { RingCommandResult, RingMetric } from './nexring-types';

export type Metrics = {
  ts?: number;
  hr?: number;
  spo2?: number;
  rr?: number;
  hrv?: number;
  rhr?: number;
  steps?: number;
  calories?: number;
  distanceMeters?: number;
  readiness?: number;
  sleepScore?: number;
  stress?: number;
  tempC?: number;
  batteryPct?: number;
  sleepStages?: { rem?: number; deep?: number; light?: number; awake?: number };

  sleepAvgHr?: number;
  nightSpo2?: number;
  historyHr?: number;
  historyRr?: number;
  signalSource?: 'live' | 'history' | 'mixed';
};

export type HrPoint = {
  ts: number;
  value: number;
  mode?: string;
};

export type StressPoint = {
  ts: number;
  value: number;
};

export type TempPoint = {
  ts: number;
  value: number;
};

export type SleepSession = {
  id: string;
  startTs: number;
  endTs: number;
  totalMinutes: number;
  score?: number;
  stages: {
    awake?: number;
    rem?: number;
    light?: number;
    deep?: number;
  };
};

export type PersistStampMap = Partial<Record<'health' | 'temperature', number>>;

export const MAX_HR_POINTS = 120;
export const MAX_STRESS_POINTS = 96;
export const MAX_TEMP_POINTS = 96;

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function num(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value)
    ? String(Math.round(value))
    : '—';
}

export function capitalize(value?: string | null) {
  if (!value) return 'Idle';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatClock(ts?: number | null) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function relativeTime(ts?: number | null) {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  if (diff < 5_000) return 'just now';
  if (diff < 60_000) return `${Math.max(1, Math.round(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.max(1, Math.round(diff / 60_000))}m ago`;
  return `${Math.max(1, Math.round(diff / 3_600_000))}h ago`;
}

export function formatSigned(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const rounded = Math.round(value * 10) / 10;
  if (rounded > 0) return `+${rounded}`;
  return String(rounded);
}

export function rangeMin(points: Array<{ value: number }>) {
  if (!points.length) return '—';
  return String(Math.round(Math.min(...points.map((p) => p.value))));
}

export function rangeMax(points: Array<{ value: number }>) {
  if (!points.length) return '—';
  return String(Math.round(Math.max(...points.map((p) => p.value))));
}

export function pushBounded<T>(arr: T[], item: T, max: number) {
  const next = [...arr, item];
  return next.length <= max ? next : next.slice(next.length - max);
}

export function sleepTotalFromStages(stages?: Metrics['sleepStages']) {
  return (
    (stages?.rem ?? 0) +
    (stages?.deep ?? 0) +
    (stages?.light ?? 0) +
    (stages?.awake ?? 0)
  );
}

export function shouldPersistMetric(metric: RingMetric, stamps: PersistStampMap) {
  const now = metric.ts || Date.now();

  if (metric.kind === 'health') {
    const last = stamps.health ?? 0;
    return now - last >= 60_000;
  }

  if (metric.kind === 'temperature') {
    const last = stamps.temperature ?? 0;
    return now - last >= 5 * 60_000;
  }

  return false;
}

export function mergeMetric(prev: Metrics, metric: RingMetric): Metrics {
  switch (metric.kind) {
    case 'health': {
      const sourceMode = metric.sourceMode ?? 'live';
      const signalSource: Metrics['signalSource'] =
        sourceMode === 'sdk_calculated' ? 'history' : sourceMode;

      const nextSignalSource: Metrics['signalSource'] =
        prev.signalSource && prev.signalSource !== signalSource
          ? 'mixed'
          : signalSource;

      return {
        ...prev,
        ts: metric.ts,

        // live hr should own the main HR tile
        hr:
          sourceMode === 'live'
            ? metric.hr ?? prev.hr
            : prev.hr ?? metric.hr,

        // keep history-derived hr separately too
        historyHr:
          sourceMode !== 'live'
            ? metric.hr ?? prev.historyHr
            : prev.historyHr,

        // generic spo2 stays as best current, but preserve nightSpo2 separately
        spo2:
          metric.spo2 ?? prev.spo2,

        nightSpo2:
          metric.nightSpo2 ??
          (sourceMode !== 'live' ? metric.spo2 ?? prev.nightSpo2 : prev.nightSpo2),

        rr:
          sourceMode === 'live'
            ? metric.rr ?? prev.rr
            : prev.rr ?? metric.rr,

        historyRr:
          sourceMode !== 'live'
            ? metric.rr ?? prev.historyRr
            : prev.historyRr,

        hrv: metric.hrv ?? prev.hrv,
        readiness: metric.readiness ?? prev.readiness,
        stress: metric.stress ?? prev.stress,
        rhr: metric.rhr ?? prev.rhr,
        sleepAvgHr: metric.sleepAvgHr ?? prev.sleepAvgHr,
        signalSource: nextSignalSource,
      };
    }
    case 'battery':
      return {
        ...prev,
        ts: metric.ts,
        batteryPct: metric.pct ?? prev.batteryPct,
      };
    case 'temperature':
      return {
        ...prev,
        ts: metric.ts,
        tempC: metric.celsius ?? prev.tempC,
      };
    case 'sleep':
      return {
        ...prev,
        ts: metric.ts,
        sleepScore: metric.score ?? prev.sleepScore,
        sleepStages: {
          rem: metric.remMinutes ?? prev.sleepStages?.rem,
          deep: metric.deepMinutes ?? prev.sleepStages?.deep,
          light: metric.lightMinutes ?? prev.sleepStages?.light,
          awake: metric.awakeMinutes ?? prev.sleepStages?.awake,
        },
        signalSource:
          prev.signalSource && prev.signalSource !== (metric.sourceMode ?? 'history')
            ? 'mixed'
            : ((metric.sourceMode ?? 'history') as 'history' | 'mixed'),
      };
    case 'activity':
      return {
        ...prev,
        ts: metric.ts,
        steps: metric.steps ?? prev.steps,
        calories: metric.calories ?? prev.calories,
        distanceMeters: metric.distanceMeters ?? prev.distanceMeters,
      };
    default:
      return prev;
  }
}

export function inferLiveMode(metric: Extract<RingMetric, { kind: 'health' }>) {
  if (typeof metric.spo2 === 'number') return 'oxygen / health';
  if (typeof metric.rr === 'number') return 'sleep / recovery';
  return 'health stream';
}

export function inferHeroModeLabel(phase?: string, lastCmd?: RingCommandResult | null) {
  if (phase === 'ready' || phase === 'connected') {
    if (lastCmd?.code === 'start_health_sent') return 'Health stream active';
    if (lastCmd?.code === 'openHealth') return 'Health stream active';
    if (lastCmd?.code === 'start_single_health_sent') return 'Single health active';
    if (lastCmd?.code === 'openSingleHealth') return 'Single health active';
    return 'Passive history sync';
  }
  if (phase === 'connecting') return 'Connecting to ring';
  if (phase === 'scanning') return 'Discovering ring';
  return 'Awaiting live stream';
}

export function preferredRecoveryHr(metrics: Metrics) {
  return metrics.rhr ?? metrics.sleepAvgHr ?? metrics.historyHr;
}

export function preferredSleepRespiratoryRate(metrics: Metrics) {
  return metrics.historyRr ?? metrics.rr;
}

export function preferredNightSpo2(metrics: Metrics) {
  return metrics.nightSpo2 ?? metrics.spo2;
}

export function readinessNarrative(value?: number | null) {
  if (typeof value !== 'number') {
    return 'No readiness summary yet. Sync historical data to populate recovery guidance.';
  }
  if (value >= 85) return 'Recovery looks strong. Suitable for heavier training or a demanding day.';
  if (value >= 70) return 'Recovery is good. A normal workload should be well tolerated.';
  if (value >= 50) return 'Recovery is moderate. Consider a lighter day or extra recovery time.';
  return 'Recovery is low. Prioritize rest, hydration, and lighter activity.';
}

export function sleepNarrative(score?: number | null, readiness?: number | null) {
  if (typeof score !== 'number') {
    return 'No decoded sleep summary yet.';
  }
  if (score >= 85) {
    return typeof readiness === 'number' && readiness < 60
      ? 'Sleep looked strong, but readiness still suggests incomplete recovery.'
      : 'Sleep quality was strong with a high overnight recovery signal.';
  }
  if (score >= 70) return 'Sleep quality was decent, though there may have been interruptions or reduced deep/REM balance.';
  if (score >= 50) return 'Sleep quality was mixed. Check stage balance, interruptions, and total sleep volume.';
  return 'Sleep quality was low. Overnight recovery likely needs more support.';
}

export function stressNarrative(value?: number | null) {
  if (typeof value !== 'number') {
    return 'No daytime stress summary yet. Start health mode or sync history to populate this.';
  }
  if (value >= 75) return 'Stress trend is elevated. This should be read as a trend surface, not a single diagnostic event.';
  if (value >= 45) return 'Stress trend is moderate. Watch movement context and time-of-day patterns.';
  return 'Stress trend is relatively calm in the current visible window.';
}

export function upsertSleepSession(
  prev: SleepSession[],
  metric: Extract<RingMetric, { kind: 'sleep' }>,
): SleepSession[] {
  const stageTotal =
    (metric.awakeMinutes ?? 0) +
    (metric.remMinutes ?? 0) +
    (metric.lightMinutes ?? 0) +
    (metric.deepMinutes ?? 0);

  const total =
    typeof metric.totalMinutes === 'number' && Number.isFinite(metric.totalMinutes)
      ? metric.totalMinutes
      : stageTotal;

  const endTs = metric.endTs ?? metric.ts ?? Date.now();
  const startTs =
    metric.startTs ??
    (typeof total === 'number' && total > 0
      ? endTs - total * 60_000
      : metric.ts ?? Date.now());

  const session: SleepSession = {
    id: String(metric.startTs ?? metric.endTs ?? metric.ts ?? Date.now()),
    startTs,
    endTs,
    totalMinutes: total,
    score: metric.score,
    stages: {
      awake: metric.awakeMinutes,
      rem: metric.remMinutes,
      light: metric.lightMinutes,
      deep: metric.deepMinutes,
    },
  };

  if (prev.length === 0) return [session];

  const last = prev[prev.length - 1];
  if (
    Math.abs(last.endTs - session.endTs) < 10 * 60_000 ||
    Math.abs(last.startTs - session.startTs) < 10 * 60_000
  ) {
    return [...prev.slice(0, -1), session];
  }

  return [...prev, session].slice(-6);
}

export function normalizePoints(
  points: Array<{ ts: number; value: number }>,
  minY: number,
  maxY: number,
  innerW: number,
  innerH: number,
  padX: number,
  padTop: number,
) {
  if (points.length === 0) return [];
  const span = Math.max(1, points.length - 1);

  return points.map((p, i) => {
    const x = padX + (i / span) * innerW;
    const norm =
      1 - (clamp(p.value, minY, maxY) - minY) / Math.max(1, maxY - minY);
    const y = padTop + norm * innerH;
    return { ...p, x, y };
  });
}