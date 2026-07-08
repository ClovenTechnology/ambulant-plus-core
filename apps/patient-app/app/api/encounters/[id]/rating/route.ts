// apps/patient-app/app/api/encounters/[id]/rating/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function trimSlash(value: string) {
  return String(value || '').replace(/\/+$/, '');
}

function gatewayBase() {
  const configured =
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    '';

  return configured ? trimSlash(configured) : '';
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

function forwardHeaders(req: NextRequest) {
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
    'x-uid',
    'x-role',
    'x-org-id',
    'x-correlation-id',
    'x-request-id',
    'idempotency-key',
    'x-idempotency-key',
  ]) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }
  headers.set('accept', 'application/json');
  headers.set('content-type', 'application/json');
  if (!headers.has('x-role')) headers.set('x-role', 'patient');
  return headers;
}

async function readPayload(res: Response) {
  const text = await res.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function normalizeBody(input: any) {
  const score = Number(input?.score ?? input?.rating ?? input?.stars ?? input?.value);
  return {
    ...input,
    score: Number.isFinite(score) ? Math.max(1, Math.min(5, Math.round(score))) : undefined,
    rating: Number.isFinite(score) ? Math.max(1, Math.min(5, Math.round(score))) : undefined,
    stars: Number.isFinite(score) ? Math.max(1, Math.min(5, Math.round(score))) : undefined,
    comment: typeof input?.comment === 'string' && input.comment.trim() ? input.comment.trim().slice(0, 1200) : null,
    source: input?.source || 'patient.encounter',
  };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const base = gatewayBase();
  if (!base) {
    return json(
      {
        ok: false,
        error: 'api_gateway_base_required',
        message: 'Rating service is unavailable because the API gateway base URL is not configured.',
      },
      503,
    );
  }

  const id = encodeURIComponent(params.id);
  const attempts = [`/api/encounters/${id}/rating`, `/api/encounters/${id}/rate`];
  let last: { status: number; payload: any } | null = null;

  for (const path of attempts) {
    const res = await fetch(`${base}${path}`, {
      method: 'GET',
      cache: 'no-store',
      headers: forwardHeaders(req),
    });
    const payload = await readPayload(res);

    if (res.ok) return json(payload ?? { ok: true }, res.status);

    last = { status: res.status, payload };
    if (![404, 405, 501].includes(res.status)) break;
  }

  return json(
    last?.payload ?? {
      ok: false,
      error: 'encounter_rating_service_unavailable',
      message: 'This encounter service does not currently expose a patient rating endpoint.',
    },
    last?.status ?? 503,
  );
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const base = gatewayBase();
  if (!base) {
    return json(
      {
        ok: false,
        error: 'api_gateway_base_required',
        message: 'Rating service is unavailable because the API gateway base URL is not configured.',
      },
      503,
    );
  }

  const rawBody = await req.json().catch(() => ({} as any));
  const body = normalizeBody(rawBody);

  if (!body.score) {
    return json({ ok: false, error: 'rating_score_required' }, 400);
  }

  const id = encodeURIComponent(params.id);
  const attempts = [`/api/encounters/${id}/rating`, `/api/encounters/${id}/rate`];
  let last: { status: number; payload: any } | null = null;

  for (const path of attempts) {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      cache: 'no-store',
      headers: forwardHeaders(req),
      body: JSON.stringify(body),
    });
    const payload = await readPayload(res);

    if (res.ok) return json(payload ?? { ok: true }, res.status);

    last = { status: res.status, payload };
    if (![404, 405, 501].includes(res.status)) break;
  }

  return json(
    last?.payload ?? {
      ok: false,
      error: 'encounter_rating_service_unavailable',
      message: 'This encounter service does not currently expose a patient rating endpoint.',
    },
    last?.status ?? 503,
  );
}
