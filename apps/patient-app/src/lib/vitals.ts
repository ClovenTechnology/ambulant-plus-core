// apps/patient-app/src/lib/vitals.ts

export type VitalsType =
  | 'blood_pressure'
  | 'spo2'
  | 'temperature'
  | 'heart_rate'
  | 'blood_glucose'
  | 'ecg';

export type VitalSource =
  | 'health_monitor'
  | 'nexring'
  | 'manual'
  | 'other';

export type DeviceClass =
  | 'medical'
  | 'wellness'
  | 'manual'
  | 'unknown';

export type EmitVitalInput = {
  patientId: string;
  type: VitalsType;
  payload: any;
  deviceId?: string;
  recorded_at?: string;
  meta?: Record<string, any>;
};

export type EmitDeviceVitalInput = Omit<EmitVitalInput, 'meta'> & {
  source: VitalSource;
  device_class?: DeviceClass;
  meta?: Record<string, any>;
};

export type StoredVitalLike = {
  type: VitalsType;
  recorded_at?: string | null;
  meta?: Record<string, any> | null;
};

const MEDICAL_PRIORITY = 100;
const WELLNESS_PRIORITY = 50;
const MANUAL_PRIORITY = 80;
const DEFAULT_PRIORITY = 10;

export function getVitalSourcePriority(
  source: VitalSource,
  deviceClass?: DeviceClass,
): number {
  if (source === 'health_monitor') return MEDICAL_PRIORITY;
  if (source === 'manual') return MANUAL_PRIORITY;
  if (source === 'nexring') return WELLNESS_PRIORITY;

  if (deviceClass === 'medical') return MEDICAL_PRIORITY;
  if (deviceClass === 'manual') return MANUAL_PRIORITY;
  if (deviceClass === 'wellness') return WELLNESS_PRIORITY;

  return DEFAULT_PRIORITY;
}

export function buildVitalMeta(input: {
  source: VitalSource;
  deviceId?: string;
  deviceClass?: DeviceClass;
  meta?: Record<string, any>;
}) {
  const device_class = input.deviceClass ?? inferDeviceClass(input.source);
  const source_priority = getVitalSourcePriority(input.source, device_class);

  return {
    source: input.source,
    device_class,
    source_priority,
    device_id: input.deviceId ?? null,
    ...(input.meta ?? {}),
  };
}

function inferDeviceClass(source: VitalSource): DeviceClass {
  switch (source) {
    case 'health_monitor':
      return 'medical';
    case 'nexring':
      return 'wellness';
    case 'manual':
      return 'manual';
    default:
      return 'unknown';
  }
}

export function shouldPreferIncomingVital(
  existing: StoredVitalLike | null | undefined,
  incoming: {
    type: VitalsType;
    source: VitalSource;
    deviceClass?: DeviceClass;
    recorded_at?: string;
  },
): boolean {
  if (!existing) return true;

  const existingPriority = Number(existing.meta?.source_priority ?? DEFAULT_PRIORITY);
  const incomingPriority = getVitalSourcePriority(
    incoming.source,
    incoming.deviceClass ?? inferDeviceClass(incoming.source),
  );

  if (incomingPriority !== existingPriority) {
    return incomingPriority > existingPriority;
  }

  const existingTs = existing.recorded_at ? Date.parse(existing.recorded_at) : 0;
  const incomingTs = incoming.recorded_at ? Date.parse(incoming.recorded_at) : Date.now();

  return incomingTs >= existingTs;
}

/**
 * Use this when rendering a "best available current vital" view.
 * Health Monitor should override NexRing for overlapping vital types.
 */
export function pickPreferredVital<T extends StoredVitalLike>(
  existing: T | null | undefined,
  incoming: T | null | undefined,
): T | null {
  if (!existing && !incoming) return null;
  if (!existing) return incoming ?? null;
  if (!incoming) return existing;

  const existingPriority = Number(existing.meta?.source_priority ?? DEFAULT_PRIORITY);
  const incomingPriority = Number(incoming.meta?.source_priority ?? DEFAULT_PRIORITY);

  if (incomingPriority !== existingPriority) {
    return incomingPriority > existingPriority ? incoming : existing;
  }

  const existingTs = existing.recorded_at ? Date.parse(existing.recorded_at) : 0;
  const incomingTs = incoming.recorded_at ? Date.parse(incoming.recorded_at) : 0;

  return incomingTs >= existingTs ? incoming : existing;
}

export async function emitVital(input: EmitVitalInput) {
  try {
    const r = await fetch(
      `/api/v1/patients/${encodeURIComponent(input.patientId)}/vitals`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: input.type,
          payload: input.payload,
          deviceId: input.deviceId,
          recorded_at: input.recorded_at ?? new Date().toISOString(),
          meta: input.meta ?? {},
        }),
      },
    );

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      console.warn('[emitVital] request failed', {
        status: r.status,
        text,
        input,
      });
      return { ok: false, status: r.status, text };
    }

    return r.json().catch(() => ({ ok: true }));
  } catch (err) {
    console.warn('[emitVital] fetch failed', {
      input,
      err,
    });
    return { ok: false, status: 0, error: String(err) };
  }
}

export async function emitDeviceVital(input: EmitDeviceVitalInput) {
  return emitVital({
    patientId: input.patientId,
    type: input.type,
    payload: input.payload,
    deviceId: input.deviceId,
    recorded_at: input.recorded_at,
    meta: buildVitalMeta({
      source: input.source,
      deviceId: input.deviceId,
      deviceClass: input.device_class,
      meta: input.meta,
    }),
  });
}

export async function emitHealthMonitorVital(
  input: Omit<EmitDeviceVitalInput, 'source' | 'device_class'>,
) {
  return emitDeviceVital({
    ...input,
    source: 'health_monitor',
    device_class: 'medical',
  });
}

export async function emitNexRingVital(
  input: Omit<EmitDeviceVitalInput, 'source' | 'device_class'>,
) {
  return emitDeviceVital({
    ...input,
    source: 'nexring',
    device_class: 'wellness',
  });
}

/**
 * Optional helper for NexRing-to-vitals mapping once richer ring metrics are stable.
 * Keep wearable-derived values clearly tagged as wellness priority.
 */
export async function emitNexRingMetricSet(input: {
  patientId: string;
  deviceId?: string;
  recorded_at?: string;
  heart_rate?: number;
  spo2?: number;
  temperature?: number;
  meta?: Record<string, any>;
}) {
  const out: Array<Promise<any>> = [];

  if (typeof input.heart_rate === 'number') {
    out.push(
      emitNexRingVital({
        patientId: input.patientId,
        type: 'heart_rate',
        payload: { bpm: input.heart_rate },
        deviceId: input.deviceId,
        recorded_at: input.recorded_at,
        meta: input.meta,
      }),
    );
  }

  if (typeof input.spo2 === 'number') {
    out.push(
      emitNexRingVital({
        patientId: input.patientId,
        type: 'spo2',
        payload: { pct: input.spo2 },
        deviceId: input.deviceId,
        recorded_at: input.recorded_at,
        meta: input.meta,
      }),
    );
  }

  if (typeof input.temperature === 'number') {
    out.push(
      emitNexRingVital({
        patientId: input.patientId,
        type: 'temperature',
        payload: { celsius: input.temperature },
        deviceId: input.deviceId,
        recorded_at: input.recorded_at,
        meta: input.meta,
      }),
    );
  }

  return Promise.all(out);
}

/**
 * Example wiring rule:
 * - If Health Monitor and NexRing both report HR / SpO2 / Temperature,
 *   Health Monitor should win when selecting the preferred current value.
 * - NexRing values should still be stored, but tagged with lower priority.
 */
export function explainVitalPriorityRule() {
  return {
    overlapping_types: ['heart_rate', 'spo2', 'temperature'],
    preferred_source: 'health_monitor',
    fallback_source: 'nexring',
    rationale:
      'Health Monitor is treated as a medical-grade device; NexRing is treated as a wellness device.',
  };
}