// apps/api-gateway/app/api/devices/ingest/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as nodeCrypto from 'node:crypto';
import {
  findDeviceSecret,
  getDeviceById,
  storeVitals,
  asDeviceKey,
} from '@/src/store/devices';
import {
  getMapperByKey,
  getMapperFromLegacyVendor,
} from '@/src/devices/registry';
import { pushToRoom } from '@/src/lib/televisit-hub';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DeviceMode = 'home' | 'televisit' | 'debug';

type NormalisedVitalEvent = {
  patient_id?: string;
  device_id: string;
  t: string | Date;
  type: string;
  value: number;
  unit?: string | null;
  room_id?: string | null;
  mode: DeviceMode;
  status?: string | null;
  quality?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

type DbVitalRow = {
  patientId: string;
  deviceId: string;
  t: Date;
  vType: string;
  valueNum: number;
  unit?: string | null;
  roomId?: string | null;
  metadata?: Record<string, unknown> | null;
};

function verifyHmac(raw: Buffer, signatureHex: string, secret: string) {
  if (!signatureHex || !secret) return false;
  if (signatureHex.length % 2 !== 0) return false;

  let sig: Buffer;

  try {
    sig = Buffer.from(signatureHex, 'hex');
  } catch {
    return false;
  }

  const calc = nodeCrypto.createHmac('sha256', secret).update(raw).digest();

  if (sig.length !== calc.length) return false;

  try {
    return nodeCrypto.timingSafeEqual(sig, calc);
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const s = String(value ?? '').trim();
    if (s) return s;
  }

  return '';
}

function finiteNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }

  return null;
}

function normalizeMode(value: unknown, fallback: DeviceMode): DeviceMode {
  const raw = firstString(value).toLowerCase();

  if (raw === 'home' || raw === 'televisit' || raw === 'debug') {
    return raw;
  }

  return fallback;
}

function safeDate(value: unknown) {
  const d = value ? new Date(value as any) : new Date();
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

function toDbRow(e: NormalisedVitalEvent & { patient_id: string }): DbVitalRow {
  return {
    patientId: e.patient_id,
    deviceId: e.device_id,
    t: safeDate(e.t),
    vType: e.type,
    valueNum: Number(e.value),
    unit: e.unit ?? null,
    roomId: e.room_id ?? null,
    metadata: e.metadata ?? null,
  };
}

function eventFromRaw(
  raw: any,
  deviceId: string,
  fallbackMode: DeviceMode = 'home',
): NormalisedVitalEvent | null {
  if (!raw || typeof raw !== 'object') return null;

  const type = firstString(
    raw.type,
    raw.vType,
    raw.metric,
    raw.metricType,
    raw.name,
  );

  const value = finiteNumber(
    raw.value,
    raw.valueNum,
    raw.numericValue,
    raw.measurement,
  );

  if (!type || value == null) return null;

  const roomId = firstString(raw.room_id, raw.roomId) || null;
  const mode = normalizeMode(raw.mode, roomId ? 'televisit' : fallbackMode);

  return {
    patient_id: firstString(raw.patient_id, raw.patientId, raw.patient),
    device_id: firstString(raw.device_id, raw.deviceId, deviceId),
    t: raw.t ?? raw.ts ?? raw.timestamp ?? raw.createdAt ?? new Date().toISOString(),
    type,
    value,
    unit: raw.unit ?? null,
    room_id: roomId,
    mode,
    status: firstString(raw.status) || null,
    quality: isRecord(raw.quality) ? raw.quality : null,
  };
}

function pushVital(
  out: NormalisedVitalEvent[],
  payload: any,
  deviceId: string,
  type: string,
  value: unknown,
  unit?: string,
) {
  const n = Number(value);
  if (!Number.isFinite(n)) return;

  const roomId = firstString(payload.room_id, payload.roomId) || null;
  const mode = normalizeMode(payload.mode, roomId ? 'televisit' : 'home');

  out.push({
    patient_id: firstString(payload.patient_id, payload.patientId, payload.patient),
    device_id: firstString(payload.device_id, payload.deviceId, deviceId),
    t: payload.t ?? payload.ts ?? payload.timestamp ?? new Date().toISOString(),
    type,
    value: n,
    unit: unit ?? null,
    room_id: roomId,
    mode,
    status: firstString(payload.status) || null,
    quality: isRecord(payload.quality) ? payload.quality : null,
  });
}

function eventsFromVitalsObject(payload: any, deviceId: string): NormalisedVitalEvent[] {
  const source =
    payload?.vitals && typeof payload.vitals === 'object'
      ? payload.vitals
      : payload;

  const out: NormalisedVitalEvent[] = [];

  pushVital(out, payload, deviceId, 'heart_rate', source.heartRate ?? source.hr, 'bpm');
  pushVital(out, payload, deviceId, 'spo2', source.spo2 ?? source.SpO2 ?? source.oxygenSaturation, '%');
  pushVital(out, payload, deviceId, 'temperature', source.temperature ?? source.temp, '°C');
  pushVital(out, payload, deviceId, 'blood_glucose', source.bloodGlucose ?? source.glucose, 'mmol/L');
  pushVital(out, payload, deviceId, 'ecg', source.ecg ?? source.ecgValue, 'mV');

  pushVital(
    out,
    payload,
    deviceId,
    'blood_pressure_systolic',
    source.systolic ?? source.bpSystolic ?? source.bloodPressureSystolic,
    'mmHg',
  );

  pushVital(
    out,
    payload,
    deviceId,
    'blood_pressure_diastolic',
    source.diastolic ?? source.bpDiastolic ?? source.bloodPressureDiastolic,
    'mmHg',
  );

  return out;
}

function unitFor(unitMap: Record<string, unknown>, key: string, fallback: string) {
  return firstString(unitMap[key], fallback);
}

function pushAdpValue(
  out: NormalisedVitalEvent[],
  base: Omit<NormalisedVitalEvent, 'type' | 'value' | 'unit'>,
  type: string,
  value: unknown,
  unit: string,
) {
  const n = Number(value);
  if (!Number.isFinite(n)) return;

  out.push({
    ...base,
    type,
    value: n,
    unit,
  });
}

function eventsFromAdpReading(reading: any, fallbackDeviceId: string): NormalisedVitalEvent[] {
  if (!isRecord(reading)) return [];
  if (reading.protocolVersion !== 'ADP-1') return [];

  const status = firstString(reading.status) || 'complete';

  if (
    status !== 'complete' &&
    status !== 'partial'
  ) {
    return [];
  }

  const values = isRecord(reading.values) ? reading.values : {};
  const unitMap = isRecord(reading.unitMap) ? reading.unitMap : {};
  const roomId = firstString(reading.roomId, reading.room_id) || null;
  const mode = normalizeMode(reading.mode, roomId ? 'televisit' : 'home');

  const base: Omit<NormalisedVitalEvent, 'type' | 'value' | 'unit'> = {
    patient_id: firstString(reading.patientId, reading.patient_id),
    device_id: firstString(reading.deviceId, reading.device_id, fallbackDeviceId),
    t: firstString(reading.recordedAt, reading.t, reading.timestamp, new Date().toISOString()),
    room_id: roomId,
    mode,
    status,
    quality: isRecord(reading.quality) ? reading.quality : null,
    metadata: {
      source_protocol: 'ADP-1',
      adp: reading,
      measurement: firstString(reading.measurement) || null,
      source: firstString(reading.source) || null,
      deviceKind: firstString(reading.deviceKind) || null,
      vendor: firstString(reading.vendor) || null,
    },
  };

  const out: NormalisedVitalEvent[] = [];
  const measurement = firstString(reading.measurement);

  switch (measurement) {
    case 'blood_pressure': {
      pushAdpValue(out, base, 'blood_pressure_systolic', values.systolic, unitFor(unitMap, 'systolic', 'mmHg'));
      pushAdpValue(out, base, 'blood_pressure_diastolic', values.diastolic, unitFor(unitMap, 'diastolic', 'mmHg'));
      pushAdpValue(out, base, 'mean_arterial_pressure', values.map, unitFor(unitMap, 'map', 'mmHg'));
      pushAdpValue(out, base, 'heart_rate', values.pulse ?? values.hr ?? values.heartRate, unitFor(unitMap, 'pulse', 'bpm'));
      break;
    }

    case 'spo2': {
      pushAdpValue(out, base, 'spo2', values.spo2 ?? values.SpO2 ?? values.oxygenSaturation, unitFor(unitMap, 'spo2', '%'));
      pushAdpValue(out, base, 'heart_rate', values.pulse ?? values.hr ?? values.heartRate, unitFor(unitMap, 'pulse', 'bpm'));
      break;
    }

    case 'temperature': {
      pushAdpValue(out, base, 'temperature', values.celsius ?? values.temperature ?? values.temp, unitFor(unitMap, 'celsius', '°C'));
      break;
    }

    case 'heart_rate': {
      pushAdpValue(out, base, 'heart_rate', values.hr ?? values.heartRate ?? values.pulse, unitFor(unitMap, 'hr', 'bpm'));
      break;
    }

    case 'glucose': {
      pushAdpValue(out, base, 'blood_glucose', values.glucose ?? values.bloodGlucose, unitFor(unitMap, 'glucose', 'mmol/L'));
      break;
    }

    case 'ecg': {
      pushAdpValue(out, base, 'heart_rate', values.hr ?? values.heartRate, unitFor(unitMap, 'heartRate', 'bpm'));
      break;
    }

    default:
      break;
  }

  return out;
}

function eventsFromAdpPayload(payload: any, fallbackDeviceId: string): NormalisedVitalEvent[] {
  if (!isRecord(payload)) return [];

  const readings = Array.isArray(payload.readings)
    ? payload.readings
    : payload.protocolVersion === 'ADP-1'
      ? [payload]
      : [];

  return readings.flatMap((reading) => eventsFromAdpReading(reading, fallbackDeviceId));
}

function normalizeEvents(mapped: any, originalPayload: any, deviceId: string): NormalisedVitalEvent[] {
  const adpEvents = eventsFromAdpPayload(originalPayload, deviceId);
  if (adpEvents.length > 0) return adpEvents;

  const candidates = [
    mapped,
    mapped?.events,
    mapped?.samples,
    mapped?.vitals,
    originalPayload?.events,
    originalPayload?.samples,
    originalPayload?.vitals,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const events = candidate
        .map((item) => eventFromRaw(item, deviceId))
        .filter(Boolean) as NormalisedVitalEvent[];

      if (events.length > 0) return events;
    }
  }

  const single = eventFromRaw(mapped, deviceId) ?? eventFromRaw(originalPayload, deviceId);
  if (single) return [single];

  return eventsFromVitalsObject(originalPayload, deviceId);
}

function runMapper(mapper: any, payload: any, deviceId: string) {
  if (!mapper) return payload;

  if (typeof mapper === 'function') {
    return mapper(payload, deviceId);
  }

  if (typeof mapper.map === 'function') {
    return mapper.map(payload, deviceId);
  }

  if (typeof mapper.parse === 'function') {
    return mapper.parse(payload, deviceId);
  }

  if (typeof mapper.normalizePayload === 'function') {
    return mapper.normalizePayload(payload, deviceId);
  }

  return payload;
}

function mapperLookupKey(key: any, device: any, deviceId: string) {
  return firstString(
    key?.model,
    key?.category,
    key?.vendor,
    device?.model,
    device?.category,
    device?.vendor,
    deviceId,
  );
}

export async function POST(req: NextRequest) {
  const clone = req.clone();
  const rawAb = await req.arrayBuffer();
  const raw = Buffer.from(rawAb);

  const deviceId = req.headers.get('x-device-id') || '';
  const signatureHex = req.headers.get('x-signature') || '';

  if (!deviceId) {
    return NextResponse.json({ error: 'missing_device_id' }, { status: 400 });
  }

  const secret = await findDeviceSecret(deviceId);

  if (!secret) {
    return NextResponse.json({ error: 'unknown_device' }, { status: 401 });
  }

  if (!verifyHmac(raw, signatureHex, secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  const device = await getDeviceById(deviceId);
  const key = asDeviceKey(device);
  const lookupKey = mapperLookupKey(key, device, deviceId);

  const mapper =
    lookupKey
      ? ((getMapperByKey as any)(lookupKey) ??
          (getMapperFromLegacyVendor as any)(device?.vendor, device?.model))
      : (getMapperFromLegacyVendor as any)(device?.vendor, device?.model);

  const ct = (req.headers.get('content-type') || '').toLowerCase();
  let payload: any = null;

  if (ct.includes('application/json')) {
    try {
      payload = JSON.parse(raw.toString('utf8'));
    } catch {
      return NextResponse.json({ error: 'bad_json' }, { status: 400 });
    }
  } else if (ct.includes('multipart/form-data')) {
    try {
      const form = await clone.formData();
      const meta = form.get('meta');

      if (typeof meta === 'string') {
        payload = JSON.parse(meta);
      } else if (meta instanceof Blob) {
        payload = JSON.parse(await meta.text());
      } else {
        payload = {};
      }
    } catch (e) {
      return NextResponse.json(
        {
          error: 'bad_formdata',
          details: (e as Error).message,
        },
        { status: 400 },
      );
    }
  } else {
    return NextResponse.json(
      { error: 'unsupported_content_type' },
      { status: 415 },
    );
  }

  const mapped = runMapper(mapper, payload, deviceId);
  const events = normalizeEvents(mapped, payload, deviceId);

  const dbRows = events
    .filter(
      (e): e is NormalisedVitalEvent & { patient_id: string } =>
        e.mode !== 'debug' &&
        typeof e.patient_id === 'string' &&
        e.patient_id.trim().length > 0 &&
        typeof e.value === 'number' &&
        Number.isFinite(e.value),
    )
    .map((e) =>
      toDbRow({
        ...e,
        patient_id: e.patient_id,
      }),
    );

  if (dbRows.length > 0) {
    await storeVitals(dbRows);
  }

  for (const e of events) {
    if (e.mode === 'televisit' && e.room_id) {
      await pushToRoom(e.room_id, {
        t: e.t,
        type: e.type,
        value: e.value,
        unit: e.unit,
        device_id: e.device_id,
        mode: e.mode,
        status: e.status ?? undefined,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    count: events.length,
    stored: dbRows.length,
    mode_counts: {
      home: events.filter((e) => e.mode === 'home').length,
      televisit: events.filter((e) => e.mode === 'televisit').length,
      debug: events.filter((e) => e.mode === 'debug').length,
    },
  });
}