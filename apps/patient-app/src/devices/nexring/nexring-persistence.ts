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
 * Maps only safe shared-vital-compatible metrics into emitVital:
 * - health.hr   -> heart_rate
 * - health.spo2 -> spo2
 * - temperature -> temperature (only when explicitly allowed)
 *
 * Everything else stays out of shared vitals:
 * - sleep
 * - readiness
 * - stress
 * - activity
 * - HRV
 * - RR
 * - battery
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

    if (!pushes.length) {
      result.skipped.push({
        reason: 'no_supported_vital_mapping',
        kind: metric.kind,
        detail: 'health metric had no mappable heart rate or SpO₂ value',
      });
    }
  } else if (metric.kind === 'temperature') {
    const celsius = finiteNumber(metric.celsius);

    if (typeof celsius !== 'number') {
      result.skipped.push({
        reason: 'missing_value',
        kind: metric.kind,
        detail: 'temperature metric missing celsius value',
      });
    } else if (!opts.persistTemperature) {
      result.skipped.push({
        reason: 'temperature_not_allowed',
        kind: metric.kind,
        detail: 'persistTemperature is false',
      });
    } else if (!opts.temperatureMode) {
      result.skipped.push({
        reason: 'temperature_missing_mode',
        kind: metric.kind,
        detail: 'temperatureMode must be explicit for NexRing temperature',
      });
    } else if (opts.temperatureMode !== 'body') {
      result.skipped.push({
        reason: 'temperature_not_clinically_normalized',
        kind: metric.kind,
        detail: `temperatureMode=${opts.temperatureMode}; only body-normalized values should go to shared vitals`,
      });
    } else {
      pushes.push({
        patientId: opts.patientId,
        type: 'temperature',
        deviceId: opts.deviceId,
        recorded_at: isoFromTs(metric.ts),
        payload: {
          celsius,
        },
        meta: baseMeta(metric, opts, {
          origin: 'continuous_wearable',
          subkind: 'temperature',
          temperatureMode: opts.temperatureMode,
        }),
      });
    }
    } else if (
    metric.kind === 'sleep' ||
    metric.kind === 'activity' ||
    metric.kind === 'battery'
  ) {
    result.skipped.push({
      reason: 'unsupported_metric_kind',
      kind: metric.kind,
      detail: 'This metric belongs in wearable summaries/device metrics, not shared vitals',
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