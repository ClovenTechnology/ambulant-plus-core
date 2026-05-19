// apps/patient-app/app/api/practices/[id]/availability/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  applyPatientSessionHeaders,
  resolvePatientAppSession,
} from '../../../_session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function trimSlash(value: string) {
  return String(value || '').replace(/\/+$/, '');
}

function gatewayBase() {
  return trimSlash(
    process.env.APIGW_BASE ||
      process.env.API_GATEWAY_BASE_URL ||
      process.env.API_GATEWAY_URL ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
      '',
  );
}

function forwardHeaders(req: NextRequest) {
  const session = resolvePatientAppSession();
  const headers = new Headers();

  for (const key of [
    'cookie',
    'authorization',
    'x-ambulant-identity',
    'x-ambulant-user-id',
    'x-ambulant-org-id',
    'x-ambulant-role',
    'x-uid',
    'x-user-id',
    'x-org-id',
    'x-role',
  ]) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  headers.set('accept', 'application/json');

  if (!headers.get('x-role') && !headers.get('x-ambulant-role')) {
    headers.set('x-role', 'patient');
  }

  applyPatientSessionHeaders(headers, session);
  return headers;
}

async function readJsonSafe(res: Response) {
  return res.json().catch(() => null);
}

function normalizeSlot(input: any) {
  const start = String(input?.start ?? input?.startsAt ?? input?.startISO ?? '').trim();
  const end = input?.end ?? input?.endsAt ?? input?.endISO ?? undefined;
  const clinicianId = String(input?.clinicianId ?? input?.clinician_id ?? '').trim();

  return {
    start,
    end: end ? String(end) : undefined,
    clinicianId,
    clinicianName: input?.clinicianName ?? input?.clinician_name ?? undefined,
    priceCents:
      typeof input?.priceCents === 'number'
        ? input.priceCents
        : typeof input?.feeCents === 'number'
          ? input.feeCents
          : undefined,
    currency: input?.currency ?? undefined,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const practiceId = String(params?.id || '').trim();

  if (!practiceId) {
    return NextResponse.json(
      { ok: false, error: 'practice_id_required', slots: [] },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const base = gatewayBase();

  if (!base) {
    return NextResponse.json(
      { ok: false, error: 'service_not_configured', slots: [] },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const incoming = new URL(req.url);
  const candidates = [
    `/api/practices/${encodeURIComponent(practiceId)}/availability`,
    `/api/practices/${encodeURIComponent(practiceId)}/slots`,
  ];

  let lastError = '';

  for (const path of candidates) {
    try {
      const upstream = new URL(path, base);

      incoming.searchParams.forEach((value, key) => {
        upstream.searchParams.set(key, value);
      });

      const res = await fetch(upstream.toString(), {
        method: 'GET',
        headers: forwardHeaders(req),
        cache: 'no-store',
      });

      const data = await readJsonSafe(res);

      if (!res.ok) {
        lastError = data?.error || data?.message || `HTTP ${res.status}`;
        continue;
      }

      const rawSlots = Array.isArray(data)
        ? data
        : Array.isArray(data?.slots)
          ? data.slots
          : Array.isArray(data?.items)
            ? data.items
            : [];

      const slots = rawSlots
        .map(normalizeSlot)
        .filter((slot: any) => slot.start && slot.clinicianId);

      return NextResponse.json(
        { ok: true, slots, source: 'api_gateway' },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    } catch (err: any) {
      lastError = err?.message || 'practice_availability_proxy_failed';
    }
  }

  return NextResponse.json(
    {
      ok: false,
      error: lastError || 'practice_availability_unavailable',
      slots: [],
    },
    { status: 502, headers: { 'Cache-Control': 'no-store' } },
  );
}