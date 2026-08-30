// apps/api-gateway/app/api/insight/ingest/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  readIdentity,
  requireTrustedIdentityInProduction,
} from '@/src/lib/identity';

export const dynamic = 'force-dynamic';

function isProductionRuntime() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

function cleanBaseUrl(value: unknown) {
  const s = String(value || '').trim();
  if (!s) return '';
  return s.replace(/\/+$/, '');
}

function resolveInsightCoreBase() {
  const configured =
    cleanBaseUrl(process.env.INSIGHTCORE_URL) ||
    cleanBaseUrl(process.env.INSIGHTCORE_BASE_URL) ||
    cleanBaseUrl(process.env.INSIGHTCORE_STUDIO_PUBLIC_URL) ||
    cleanBaseUrl(process.env.NEXT_PUBLIC_INSIGHTCORE_URL);

  if (configured) return configured;

  if (isProductionRuntime()) return '';

  return 'http://localhost:8788';
}

function resolveInsightCoreKey() {
  return String(process.env.INSIGHTCORE_KEY || '').trim();
}

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);

  try {
    requireTrustedIdentityInProduction(req.headers, who);
  } catch {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const role = String(who.role || '').toLowerCase();
  if (!who.uid || !['clinician', 'admin', 'admin_staff', 'system'].includes(role)) {
    return NextResponse.json(
      { ok: false, error: 'forbidden' },
      { status: who.uid ? 403 : 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const core = resolveInsightCoreBase();

  if (!core) {
    return NextResponse.json(
      {
        ok: false,
        error: 'insightcore_url_not_configured',
        message: 'INSIGHTCORE_URL or INSIGHTCORE_BASE_URL must be configured in production.',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const body = await req.json().catch(() => ({}));
  const key = resolveInsightCoreKey();
  const auth = key ? `Bearer ${key}` : undefined;

  const payload = {
    ...((body && typeof body === 'object' && !Array.isArray(body)) ? body : {}),
    _ambulant: {
      actorRole: role,
      actorRefId: who.actorRefId || who.uid,
      requestedAt: new Date().toISOString(),
      clinicianReviewRequired: true,
    },
  };

  const r = await fetch(`${core}/ingest`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(auth ? { authorization: auth } : {}),
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  if (!r.ok) {
    const text = await r.text().catch(() => '');
    return NextResponse.json(
      { ok: false, error: `InsightCore ${r.status}`, detail: text || undefined },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const j = await r.json().catch(() => ({}));
  return NextResponse.json(
    { ok: true, ...j },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
