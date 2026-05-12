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

type NormalisedVitalEvent = {
  patient_id?: string;
  device_id: string;
  t: string | Date;
  type: string;
  value: number;
  unit?: string | null;
  room_id?: string | null;
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

  const calc = nodeCrypto
    .createHmac('sha256', secret)
    .update(raw)
    .digest();

  if (sig.length !== calc.length) return false;

  try {
    return nodeCrypto.timingSafeEqual(sig, calc);
  } catch {
    return false;
  }
}

type DbVitalRow = {
  patientId: string;
  deviceId: string;
  t: Date;
  vType: string;
  valueNum: number;
  unit?: string | null;
  roomId?: string | null;
};

function toDbRow(e: NormalisedVitalEvent & { patient_id: string }): DbVitalRow {
  return {
    patientId: e.patient_id,
    deviceId: e.device_id,
    t: new Date(e.t),
    vType: e.type,
    valueNum: Number(e.value),
    unit: e.unit ?? null,
    roomId: e.room_id ?? null,
  };
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const s = String(value ?? '').trim();
    if (s) return s;
  }

  return '';
}

function eventFromRaw(raw: any, deviceId: string): NormalisedVitalEvent | null {
  if (!raw || typeof raw !== 'object') return null;

  const type = firstString(
    raw.type,
    raw.vType,
    raw.metric,
    raw.metricType,
    raw.name,
  );

  const value = Number(
    raw.value ??
      raw.valueNum ??
      raw.numericValue ??
      raw.measurement,
  );

  if (!type || !Number.isFinite(value)) return null;

  return {
    patient_id: firstString(raw.patient_id, raw.patientId, raw.patient),
    device_id: firstString(raw.device_id, raw.deviceId, deviceId),
    t: raw.t ?? raw.ts ?? raw.timestamp ?? raw.createdAt ?? new Date().toISOString(),
    type,
    value,
    unit: raw.unit ?? null,
    room_id: firstString(raw.room_id, raw.roomId) || null,
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

  out.push({
    patient_id: firstString(payload.patient_id, payload.patientId, payload.patient),
    device_id: firstString(payload.device_id, payload.deviceId, deviceId),
    t: payload.t ?? payload.ts ?? payload.timestamp ?? new Date().toISOString(),
    type,
    value: n,
    unit: unit ?? null,
    room_id: firstString(payload.room_id, payload.roomId) || null,
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

function normalizeEvents(mapped: any, originalPayload: any, deviceId: string): NormalisedVitalEvent[] {
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
    if (e.room_id) {
      await pushToRoom(e.room_id, {
        t: e.t,
        type: e.type,
        value: e.value,
        unit: e.unit,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    count: events.length,
    stored: dbRows.length,
  });
}