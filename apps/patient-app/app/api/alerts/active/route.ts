// apps/patient-app/app/api/alerts/active/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GATEWAY_ORIGIN = (
  process.env.APIGW_BASE ||
  process.env.NEXT_PUBLIC_APIGW_BASE ||
  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
  process.env.NEXT_PUBLIC_GATEWAY_BASE ||
  ''
).replace(/\/+$/, '');

function noStore(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function gatewayRequired() {
  if (!GATEWAY_ORIGIN) {
    const err = new Error('api_gateway_not_configured') as Error & { status?: number };
    err.status = 500;
    throw err;
  }

  return GATEWAY_ORIGIN;
}

async function readPayload(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeLevel(value: unknown) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'critical' || raw === 'red' || raw === 'high') return 'red';
  if (raw === 'moderate' || raw === 'amber' || raw === 'warning') return 'amber';
  if (raw === 'low' || raw === 'green' || raw === 'info') return 'green';
  return 'info';
}

function normalizeActiveAlert(item: unknown) {
  if (!isRecord(item)) return null;

  const id = String(item.id || item.alertId || item.eventId || '').trim();
  if (!id) return null;

  const status = String(item.status || 'new').trim().toLowerCase();
  if (status === 'resolved' || status === 'dismissed' || status === 'closed') {
    return null;
  }

  const when = String(
    item.timestamp ||
      item.ts ||
      item.createdAt ||
      item.generatedAt ||
      item.when ||
      new Date().toISOString(),
  );

  return {
    id,
    vital: String(item.vital || item.type || item.title || item.ruleName || 'Clinical signal'),
    value: String(item.value || item.message || item.summary || ''),
    level: normalizeLevel(item.level || item.severity || item.priority),
    when,
    source: String(item.source || 'insightcore'),
    status,
    raw: item,
  };
}

function unwrapAlerts(payload: any) {
  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.alerts)
      ? payload.alerts
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

  return raw.map(normalizeActiveAlert).filter(Boolean).slice(0, 50);
}

export async function GET(req: NextRequest) {
  try {
    const gateway = gatewayRequired();
    const incoming = new URL(req.url);
    const upstream = new URL(`${gateway}/api/insightcore/alerts`);

    incoming.searchParams.forEach((value, key) => {
      upstream.searchParams.set(key, value);
    });

    upstream.searchParams.set('limit', incoming.searchParams.get('limit') || '50');

    const cookie = req.headers.get('cookie');
    const authorization = req.headers.get('authorization');

    const response = await fetch(upstream.toString(), {
      method: 'GET',
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        ...(cookie ? { cookie } : {}),
        ...(authorization ? { authorization } : {}),
      },
    });

    const payload = await readPayload(response);

    if (!response.ok) {
      return noStore(
        {
          ok: false,
          error: 'active_alerts_upstream_failed',
          upstreamStatus: response.status,
          upstreamPayload: payload,
        },
        response.status,
      );
    }

    return noStore({
      ok: true,
      source: 'insightcore',
      items: unwrapAlerts(payload),
    });
  } catch (err: any) {
    return noStore(
      { ok: false, error: String(err?.message || 'active_alerts_unavailable') },
      Number(err?.status) || 500,
    );
  }
}
