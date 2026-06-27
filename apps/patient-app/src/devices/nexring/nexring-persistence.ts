//apps/patient-app/src/devices/nexring/nexring-persistence.ts
'use client';

import { emitVital, type EmitVitalInput } from '@/src/lib/vitals';
import type { RingMetric } from './nexring-types';

export type PersistNexRingMetricOptions = {
  patientId: string;
  deviceId?: string;
  deviceLabel?: string;
  source?: string;
  firmware?: string;
  model?: string;
  persistTemperature?: boolean;
  temperatureMode?: 'skin' | 'body' | 'unknown';
  onStoredSummary?: (summary: NexRingPersistenceResult) => void;
};

export type NexRingPersistenceResult = {
  ok: boolean;
  attempted: number;
  stored: number;
  skipped: Array<{
    reason:
      | 'missing_patient'
      | 'unsupported_metric_kind'
      | 'no_supported_vital_mapping'
      | 'temperature_not_allowed'
      | 'temperature_missing_mode'
      | 'temperature_not_clinically_normalized'
      | 'missing_value';
    kind: RingMetric['kind'];
    detail?: string;
  }>;
  results: Array<{
    type: EmitVitalInput['type'];
    ok: boolean;
    response?: unknown;
    error?: unknown;
  }>;
};

function isoFromTs(ts?: number) {
  return new Date(typeof ts === 'number' && Number.isFinite(ts) ? ts : Date.now()).toISOString();
}

function finiteNumber(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function isTrustedNightSpo2(metric: RingMetric, value: number) {
  if (!Number.isFinite(value)) return false;
  if (value < 80 || value > 100) return false;

  if (metric.kind === 'health' && metric.sourceMode === 'live') {
    return false;
  }

  return true;
}

function baseMeta(
  metric: RingMetric,
  opts: PersistNexRingMetricOptions,
  extra?: Record<string, unknown>,
) {
  return {
    source: opts.source ?? 'nexring',
    vendor: 'duecare',
    deviceFamily: 'smart-ring',
    deviceLabel: opts.deviceLabel ?? 'NexRing',
    firmware: opts.firmware,
    model: opts.model,
    metricKind: metric.kind,
    capturedAt: isoFromTs(metric.ts),
    ...extra,
  };
}

async function postVital(input: EmitVitalInput) {
  try {
    const response = await emitVital(input);
    const ok =
      !!response &&
      typeof response === 'object' &&
      ('ok' in response ? Boolean((response as any).ok) : true);

    return { ok, response };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * Thin NexRing-only adapter.
 *
 * Maps NexRing wearable metrics into the shared persisted vitals stream.
 * NexRing remains tagged as a wellness source.
 *
 * Important:
 * - NexRing temperature is temperature deviation / variation.
 * - Never persist NexRing temperature as body temperature.
 */
export async function persistNexRingMetric(
  metric: RingMetric,
  opts: PersistNexRingMetricOptions,
): Promise<NexRingPersistenceResult> {
  const result: NexRingPersistenceResult = {
    ok: true,
    attempted: 0,
    stored: 0,
    skipped: [],
    results: [],
  };

  if (!opts.patientId) {
    result.ok = false;
    result.skipped.push({
      reason: 'missing_patient',
      kind: metric.kind,
      detail: 'patientId is required',
    });
    opts.onStoredSummary?.(result);
    return result;
  }

  const pushes: EmitVitalInput[] = [];

  if (metric.kind === 'health') {
    const hr = finiteNumber(metric.hr);
    const spo2 = finiteNumber(metric.spo2);

    if (typeof hr === 'number') {
      pushes.push({
        patientId: opts.patientId,
        type: 'heart_rate',
        deviceId: opts.deviceId,
        recorded_at: isoFromTs(metric.ts),
        payload: {
          bpm: hr,
        },
        meta: baseMeta(metric, opts, {
          origin: 'continuous_wearable',
          subkind: 'heart_rate',
          hrv: finiteNumber(metric.hrv),
          rr: finiteNumber(metric.rr),
          rhr: finiteNumber(metric.rhr),
          stress: finiteNumber(metric.stress),
          readiness: finiteNumber(metric.readiness),
        }),
      });
    }

    if (typeof spo2 === 'number') {
      pushes.push({
        patientId: opts.patientId,
        type: 'spo2',
        deviceId: opts.deviceId,
        recorded_at: isoFromTs(metric.ts),
        payload: {
          spo2,
        },
        meta: baseMeta(metric, opts, {
          origin: 'continuous_wearable',
          subkind: 'spo2',
          hrv: finiteNumber(metric.hrv),
          rr: finiteNumber(metric.rr),
          rhr: finiteNumber(metric.rhr),
          stress: finiteNumber(metric.stress),
          readiness: finiteNumber(metric.readiness),
        }),
      });
    }

    const hrv = finiteNumber(metric.hrv);
    if (typeof hrv === 'number') {
      pushes.push({
        patientId: opts.patientId,
        type: 'hrv',
        deviceId: opts.deviceId,
        recorded_at: isoFromTs(metric.ts),
        payload: { ms: hrv },
        meta: baseMeta(metric, opts, {
          origin: 'continuous_wearable',
          subkind: 'hrv',
          rhr: finiteNumber(metric.rhr),
          stress: finiteNumber(metric.stress),
          readiness: finiteNumber(metric.readiness),
        }),
      });
    }

    const rr = finiteNumber(metric.rr);
    if (typeof rr === 'number') {
      pushes.push({
        patientId: opts.patientId,
        type: 'respiratory_rate',
        deviceId: opts.deviceId,
        recorded_at: isoFromTs(metric.ts),
        payload: { rpm: rr },
        meta: baseMeta(metric, opts, {
          origin: 'continuous_wearable',
          subkind: 'respiratory_rate',
          rhr: finiteNumber(metric.rhr),
          sleepAvgHr: finiteNumber(metric.sleepAvgHr),
        }),
      });
    }

    const readiness = finiteNumber(metric.readiness);
    if (typeof readiness === 'number') {
      pushes.push({
        patientId: opts.patientId,
        type: 'readiness',
        deviceId: opts.deviceId,
        recorded_at: isoFromTs(metric.ts),
        payload: { score: readiness },
        meta: baseMeta(metric, opts, {
          origin: 'continuous_wearable',
          subkind: 'readiness',
          hrv,
          rhr: finiteNumber(metric.rhr),
          stress: finiteNumber(metric.stress),
        }),
      });
    }

    const nightSpo2 = finiteNumber(metric.nightSpo2);
    if (typeof nightSpo2 === 'number' && isTrustedNightSpo2(metric, nightSpo2)) {
      pushes.push({
        patientId: opts.patientId,
        type: 'night_spo2',
        deviceId: opts.deviceId,
        recorded_at: isoFromTs(metric.ts),
        payload: { pct: nightSpo2 },
        meta: baseMeta(metric, opts, {
          origin: 'continuous_wearable',
          subkind: 'night_spo2',
          quality: 'trusted_nightly_history',
          minAcceptedPct: 80,
          maxAcceptedPct: 100,
          sourceMode: metric.sourceMode,
          sleepAvgHr: finiteNumber(metric.sleepAvgHr),
        }),
      });
    } else if (typeof nightSpo2 === 'number') {
      result.skipped.push({
        reason: 'missing_value',
        kind: metric.kind,
        detail: `night_spo2 ${nightSpo2}% excluded by wearable quality gate`,
      });
    }

    if (!pushes.length) {
      result.skipped.push({
        reason: 'no_supported_vital_mapping',
        kind: metric.kind,
        detail: 'health metric had no mappable heart rate or SpO₂ value',
      });
    }
  } else if (metric.kind === 'temperature') {
    const deltaC = finiteNumber(metric.celsius);

    if (typeof deltaC !== 'number') {
      result.skipped.push({
        reason: 'missing_value',
        kind: metric.kind,
        detail: 'temperature metric missing deviation value',
      });
    } else {
      pushes.push({
        patientId: opts.patientId,
        type: 'temperature_deviation',
        deviceId: opts.deviceId,
        recorded_at: isoFromTs(metric.ts),
        payload: {
          delta_c: deltaC,
        },
        meta: baseMeta(metric, opts, {
          origin: 'continuous_wearable',
          subkind: 'temperature_deviation',
          valueSemantics: 'variation_not_body_temperature',
          fertility_signal: true,
          unit: 'Δ°C',
        }),
      });
    }

  } else if (metric.kind === 'sleep') {
    const before = pushes.length;
    const totalHours =
      typeof finiteNumber(metric.totalMinutes) === 'number'
        ? Math.round((finiteNumber(metric.totalMinutes)! / 60) * 100) / 100
        : null;
    const deepHours =
      typeof finiteNumber(metric.deepMinutes) === 'number'
        ? Math.round((finiteNumber(metric.deepMinutes)! / 60) * 100) / 100
        : null;
    const lightHours =
      typeof finiteNumber(metric.lightMinutes) === 'number'
        ? Math.round((finiteNumber(metric.lightMinutes)! / 60) * 100) / 100
        : null;
    const remHours =
      typeof finiteNumber(metric.remMinutes) === 'number'
        ? Math.round((finiteNumber(metric.remMinutes)! / 60) * 100) / 100
        : null;
    const awakeHours =
      typeof finiteNumber(metric.awakeMinutes) === 'number'
        ? Math.round((finiteNumber(metric.awakeMinutes)! / 60) * 100) / 100
        : null;

    if (
      typeof totalHours === 'number' ||
      typeof deepHours === 'number' ||
      typeof lightHours === 'number' ||
      typeof remHours === 'number'
    ) {
      pushes.push({
        patientId: opts.patientId,
        type: 'sleep',
        deviceId: opts.deviceId,
        recorded_at: isoFromTs(metric.ts),
        payload: {
          total_hours: totalHours,
          deep_hours: deepHours,
          light_hours: lightHours,
          rem_hours: remHours,
          awake_hours: awakeHours,
          startTs: metric.startTs ?? null,
          endTs: metric.endTs ?? null,
        },
        meta: baseMeta(metric, opts, {
          origin: 'continuous_wearable',
          subkind: 'sleep',
          sourceMode: metric.sourceMode,
        }),
      });
    }

    const score = finiteNumber(metric.score);
    if (typeof score === 'number') {
      pushes.push({
        patientId: opts.patientId,
        type: 'sleep_score',
        deviceId: opts.deviceId,
        recorded_at: isoFromTs(metric.ts),
        payload: { score },
        meta: baseMeta(metric, opts, {
          origin: 'continuous_wearable',
          subkind: 'sleep_score',
          sourceMode: metric.sourceMode,
        }),
      });
    }

    if (pushes.length === before) {
      result.skipped.push({
        reason: 'missing_value',
        kind: metric.kind,
        detail: 'sleep metric had no mappable sleep duration or score',
      });
    }
  } else if (metric.kind === 'activity') {
    const before = pushes.length;
    const steps = finiteNumber(metric.steps);
    const calories = finiteNumber(metric.calories);
    const distanceMeters = finiteNumber(metric.distanceMeters);

    if (
      typeof steps === 'number' ||
      typeof calories === 'number' ||
      typeof distanceMeters === 'number'
    ) {
      pushes.push({
        patientId: opts.patientId,
        type: 'activity',
        deviceId: opts.deviceId,
        recorded_at: isoFromTs(metric.ts),
        payload: {
          steps,
          calories,
          distance_km:
            typeof distanceMeters === 'number'
              ? Math.round((distanceMeters / 1000) * 1000) / 1000
              : null,
          distance_meters: distanceMeters,
        },
        meta: baseMeta(metric, opts, {
          origin: 'continuous_wearable',
          subkind: 'activity',
        }),
      });
    }

    if (pushes.length === before) {
      result.skipped.push({
        reason: 'missing_value',
        kind: metric.kind,
        detail: 'activity metric had no mappable steps, calories, or distance',
      });
    }
  } else if (metric.kind === 'battery') {
    result.skipped.push({
      reason: 'unsupported_metric_kind',
      kind: metric.kind,
      detail: 'battery belongs in device telemetry, not shared vitals',
    });
  }

  result.attempted = pushes.length;

  for (const input of pushes) {
    const posted = await postVital(input);
    result.results.push({
      type: input.type,
      ok: posted.ok,
      response: posted.response,
      error: posted.error,
    });

    if (posted.ok) {
      result.stored += 1;
    } else {
      result.ok = false;
    }
  }

  if (pushes.length === 0 && result.skipped.length > 0) {
    result.ok = false;
  }

  opts.onStoredSummary?.(result);
  return result;
}

/**
 * Optional helper for easy session wiring.
 */
export function createNexRingMetricPersister(opts: PersistNexRingMetricOptions) {
  return async (metric: RingMetric) => persistNexRingMetric(metric, opts);
}