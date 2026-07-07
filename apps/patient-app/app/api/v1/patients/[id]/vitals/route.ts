// apps/patient-app/app/api/v1/patients/[id]/vitals/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CANONICAL_API_GATEWAY_URL = '';

const ALLOWED_VITAL_TYPES = new Set([
  'blood_pressure',
  'spo2',
  'temperature',
  'heart_rate',
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

function trimSlash(value: string) {
  return String(value || '').replace(/\/+$/, '');
}

function gatewayBase(): string {
  const configured =
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    process.env.APIGW_ORIGIN ||
    process.env.API_GATEWAY_ORIGIN ||
    '';

  const base = trimSlash(configured);
  if (!base) throw new Error('APIGW_BASE_required');
  return base;
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

function forwardHeaders(req: NextRequest, includeJson = false) {
  const headers = new Headers();

  for (const key of [
    'authorization',
    'cookie',
    'x-ambulant-identity',
    'x-ambulant-user-id',
    'x-ambulant-patient-id',
    'x-ambulant-org-id',
    'x-ambulant-role',
    'x-user-id',
    'x-patient-id',
    'x-uid',
    'x-role',
    'x-email',
    'x-name',
    'x-display-name',
    'x-correlation-id',
    'x-request-id',
    'idempotency-key',
    'x-idempotency-key',
  ]) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  headers.set('accept', 'application/json');
  if (!headers.has('x-role')) headers.set('x-role', 'patient');
  if (includeJson) headers.set('content-type', 'application/json');

  return headers;
}

async function readPayload(res: Response) {
  const text = await res.text().catch(() => '');
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function upstreamUrl(req: NextRequest, patientId: string) {
  const base = gatewayBase();
  const src = new URL(req.url);
  const upstream = new URL(
    `${base}/api/v1/patients/${encodeURIComponent(patientId)}/vitals`,
  );

  src.searchParams.forEach((value, key) => {
    upstream.searchParams.set(key, value);
  });

  return upstream;
}

function normalizeRecordedAt(value: unknown) {
  const raw = String(value || '').trim();
  const parsed = raw ? new Date(raw) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function cleanPayload(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeBody(body: any) {
  const type = String(body?.type || '').trim();

  if (!ALLOWED_VITAL_TYPES.has(type)) {
    return {
      ok: false as const,
      error: 'unsupported_vital_type',
      message: 'A supported vital type is required.',
    };
  }

  const payload = cleanPayload(body?.payload);
  const recordedAt = normalizeRecordedAt(body?.recorded_at ?? body?.recordedAt ?? body?.ts);
  const meta = cleanPayload(body?.meta);

  return {
    ok: true as const,
    body: {
      type,
      payload,
      deviceId:
        typeof body?.deviceId === 'string' && body.deviceId.trim()
          ? body.deviceId.trim()
          : undefined,
      recorded_at: recordedAt,
      meta,
    },
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const patientId = String(params?.id || '').trim();

  if (!patientId) {
    return json({ ok: false, error: 'patient_id_required', items: [] }, 400);
  }

  try {
    const res = await fetch(upstreamUrl(req, patientId), {
      method: 'GET',
      cache: 'no-store',
      headers: forwardHeaders(req),
    });

    const data = await readPayload(res);

    if (!res.ok) {
      return json(
        {
          ok: false,
          error: 'vitals_gateway_unavailable',
          status: res.status,
          upstream: data,
          items: [],
        },
        res.status === 404 ? 404 : 502,
      );
    }

    if (Array.isArray(data)) {
      return json({ ok: true, items: data });
    }

    if (data && typeof data === 'object') {
      const root = data as Record<string, unknown>;
      const items = Array.isArray(root.items)
        ? root.items
        : Array.isArray(root.vitals)
          ? root.vitals
          : Array.isArray(root.data)
            ? root.data
            : [];

      return json({
        ...root,
        ok: root.ok !== false,
        items,
      });
    }

    return json({ ok: true, items: [] });
  } catch (err: any) {
    return json(
      {
        ok: false,
        error: 'vitals_gateway_request_failed',
        message: err?.message || 'Unable to load vitals.',
        items: [],
      },
      502,
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const patientId = String(params?.id || '').trim();

  if (!patientId) {
    return json({ ok: false, error: 'patient_id_required' }, 400);
  }

  const incoming = await req.json().catch(() => null);
  if (!incoming || typeof incoming !== 'object') {
    return json({ ok: false, error: 'invalid_json_body' }, 400);
  }

  const normalized = normalizeBody(incoming);
  if (!normalized.ok) {
    return json(
      {
        ok: false,
        error: normalized.error,
        message: normalized.message,
      },
      400,
    );
  }

  try {
    const res = await fetch(upstreamUrl(req, patientId), {
      method: 'POST',
      cache: 'no-store',
      headers: forwardHeaders(req, true),
      body: JSON.stringify(normalized.body),
    });

    const data = await readPayload(res);

    if (!res.ok) {
      return json(
        {
          ok: false,
          error: 'vital_write_failed',
          status: res.status,
          upstream: data,
        },
        res.status === 404 ? 404 : 502,
      );
    }

    if (data && typeof data === 'object') {
      return json({
        ...(data as Record<string, unknown>),
        ok: (data as Record<string, unknown>).ok !== false,
      });
    }

    return json({ ok: true, item: normalized.body });
  } catch (err: any) {
    return json(
      {
        ok: false,
        error: 'vital_write_gateway_request_failed',
        message: err?.message || 'Unable to save vital reading.',
      },
      502,
    );
  }
}
