import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_TYPES = new Set([
  'blood_pressure',
  'spo2',
  'heart_rate',
  'temperature',
  'blood_glucose',
  'glucose',
  'ecg',
  'activity',
  'sleep',
  'respiratory_rate',
  'hrv',
  'readiness',
  'sleep_score',
  'night_spo2',
  'temperature_deviation',
]);

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers':
      'content-type,authorization,cookie,x-uid,x-role,x-org-id,x-ambulant-identity',
    'cache-control': 'no-store',
  };
}

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders() });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function asObj(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function recordedAt(value: unknown) {
  const raw = clean(value, 80);
  const d = raw ? new Date(raw) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function unitFor(vType: string, payload: Record<string, any>, fallback?: string | null) {
  const explicit = clean(payload.unit || fallback, 32);
  if (explicit) return explicit;

  if (vType.includes('blood_pressure')) return 'mmHg';
  if (vType.includes('pulse') || vType === 'heart_rate') return 'bpm';
  if (vType === 'temperature_deviation') return 'Δ°C';
  if (vType.includes('temperature')) return 'C';
  if (vType.includes('spo2')) return '%';
  if (vType.includes('glucose')) return 'mg/dL';
  if (vType === 'steps') return 'steps';
  if (vType === 'calories') return 'kcal';
  if (vType === 'distance_km') return 'km';
  if (vType.startsWith('sleep_')) return 'h';
  if (vType === 'respiratory_rate') return 'rpm';
  if (vType === 'hrv') return 'ms';
  if (vType === 'readiness' || vType === 'sleep_score') return 'score';
  if (vType === 'night_spo2') return '%';

  return null;
}

function pushMetric(
  rows: Array<{ vType: string; valueNum: number; unit?: string | null }>,
  vType: string,
  value: unknown,
  payload: Record<string, any>,
  fallbackUnit?: string | null,
) {
  const valueNum = asNumber(value);
  if (valueNum === null) return;

  rows.push({
    vType,
    valueNum,
    unit: unitFor(vType, payload, fallbackUnit),
  });
}

function metricRows(type: string, payload: Record<string, any>) {
  const rows: Array<{ vType: string; valueNum: number; unit?: string | null }> = [];

  switch (type) {
    case 'blood_pressure':
      pushMetric(rows, 'blood_pressure_systolic', payload.systolic ?? payload.sys, payload, 'mmHg');
      pushMetric(rows, 'blood_pressure_diastolic', payload.diastolic ?? payload.dia, payload, 'mmHg');
      pushMetric(rows, 'blood_pressure_map', payload.map, payload, 'mmHg');
      pushMetric(rows, 'blood_pressure_pulse', payload.pulse ?? payload.hr, payload, 'bpm');
      break;

    case 'spo2':
      pushMetric(rows, 'spo2', payload.spo2 ?? payload.pct ?? payload.value, payload, '%');
      pushMetric(rows, 'spo2_pulse', payload.pulse ?? payload.hr, payload, 'bpm');
      pushMetric(rows, 'spo2_pi', payload.pi, payload, null);
      break;

    case 'heart_rate':
      pushMetric(rows, 'heart_rate', payload.hr ?? payload.pulse ?? payload.value, payload, 'bpm');
      break;

    case 'temperature':
      pushMetric(rows, 'temperature_celsius', payload.celsius ?? payload.value, payload, 'C');
      pushMetric(rows, 'temperature_fahrenheit', payload.fahrenheit, payload, 'F');
      break;

    case 'blood_glucose':
    case 'glucose':
      pushMetric(
        rows,
        'blood_glucose',
        payload.glucose ?? payload.mgDl ?? payload.mg_dl ?? payload.value ?? payload.mmol,
        payload,
        payload.unit || 'mg/dL',
      );
      break;

    case 'ecg':
      pushMetric(rows, 'ecg_signal_quality', payload.signalQuality ?? payload.quality, payload, null);
      pushMetric(rows, 'ecg_sample_count', payload.sampleCount ?? payload.samples, payload, 'samples');
      break;

    case 'activity':
      pushMetric(rows, 'steps', payload.steps, payload, 'steps');
      pushMetric(rows, 'calories', payload.calories ?? payload.kcal, payload, 'kcal');
      pushMetric(rows, 'distance_km', payload.distance_km ?? payload.distanceKm ?? payload.distance, payload, 'km');
      break;

    case 'sleep':
      pushMetric(rows, 'sleep_total', payload.total_hours ?? payload.totalHours ?? payload.total, payload, 'h');
      pushMetric(rows, 'sleep_deep', payload.deep_hours ?? payload.deepHours ?? payload.deep, payload, 'h');
      pushMetric(rows, 'sleep_light', payload.light_hours ?? payload.lightHours ?? payload.light, payload, 'h');
      pushMetric(rows, 'sleep_rem', payload.rem_hours ?? payload.remHours ?? payload.rem, payload, 'h');
      break;

    case 'respiratory_rate':
      pushMetric(rows, 'respiratory_rate', payload.rpm ?? payload.value ?? payload.respiratoryRate, payload, 'rpm');
      break;

    case 'hrv':
      pushMetric(rows, 'hrv', payload.ms ?? payload.value ?? payload.hrv, payload, 'ms');
      break;

    case 'readiness':
      pushMetric(rows, 'readiness', payload.score ?? payload.value ?? payload.readiness, payload, 'score');
      break;

    case 'sleep_score':
      pushMetric(rows, 'sleep_score', payload.score ?? payload.value ?? payload.sleepScore, payload, 'score');
      break;

    case 'night_spo2':
      pushMetric(rows, 'night_spo2', payload.pct ?? payload.value ?? payload.spo2, payload, '%');
      break;

    case 'temperature_deviation':
      pushMetric(
        rows,
        'temperature_deviation',
        payload.delta_c ?? payload.deltaC ?? payload.value ?? payload.tempDeviation ?? payload.temperatureDeviation,
        payload,
        'Δ°C',
      );
      break;
  }

  return rows;
}

function shape(row: any) {
  return {
    id: row.id,
    patientId: row.patientId,
    deviceId: row.deviceId,
    type: row.vType,
    vType: row.vType,
    value: row.valueNum,
    valueNum: row.valueNum,
    unit: row.unit,
    roomId: row.roomId,
    t: row.t instanceof Date ? row.t.toISOString() : row.t,
    recorded_at: row.t instanceof Date ? row.t.toISOString() : row.t,
  };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const patientId = clean(params?.id, 180);

  if (!patientId) {
    return json({ ok: false, error: 'patient_id_required', items: [] }, 400);
  }

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 250);
  const type = clean(url.searchParams.get('type'), 120);
  const roomId = clean(url.searchParams.get('roomId'), 180);

  const where: any = { patientId };

  if (roomId) where.roomId = roomId;

  if (type) {
    if (type === 'blood_pressure') {
      where.vType = { in: ['blood_pressure_systolic', 'blood_pressure_diastolic', 'blood_pressure_map', 'blood_pressure_pulse'] };
    } else if (type === 'spo2') {
      where.vType = { in: ['spo2', 'spo2_pulse', 'spo2_pi'] };
    } else if (type === 'temperature') {
      where.vType = { in: ['temperature_celsius', 'temperature_fahrenheit'] };
    } else if (type === 'blood_glucose' || type === 'glucose') {
      where.vType = 'blood_glucose';
    } else {
      where.vType = type;
    }
  }

  const rows = await prisma.vitalSample.findMany({
    where,
    orderBy: { t: 'desc' },
    take: limit,
  });

  return json({ ok: true, items: rows.map(shape) });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const patientId = clean(params?.id, 180);

  if (!patientId) {
    return json({ ok: false, error: 'patient_id_required' }, 400);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const type = clean(body?.type || body?.vType, 120);
  if (!ALLOWED_TYPES.has(type)) {
    return json({ ok: false, error: 'unsupported_vital_type', type }, 400);
  }

  const payload = asObj(body?.payload);
  const deviceId =
    clean(body?.deviceId || body?.device_id || payload.deviceId || payload.device_id, 180) ||
    'duecare-health-monitor';

  const meta = asObj(body?.meta);
  const roomId = clean(body?.roomId || body?.room_id || meta.room_id || meta.roomId || payload.roomId, 180) || null;
  const t = recordedAt(body?.recorded_at || body?.recordedAt || body?.t || payload.recorded_at);

  const metrics = metricRows(type, payload);

  if (metrics.length === 0) {
    return json({ ok: false, error: 'no_numeric_vital_values', type }, 400);
  }

  const created = await prisma.$transaction(
    metrics.map((metric) =>
      prisma.vitalSample.create({
        data: {
          patientId,
          deviceId,
          t,
          vType: metric.vType,
          valueNum: metric.valueNum,
          unit: metric.unit || null,
          roomId,
          metadata: meta,
        },
      }),
    ),
  );

  return json(
    {
      ok: true,
      item: shape(created[0]),
      items: created.map(shape),
      count: created.length,
    },
    201,
  );
}