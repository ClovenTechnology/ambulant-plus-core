// apps/patient-app/app/api/events/emit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function targetUrl() {
  return `${apigwBase()}/api/events/emit`;
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
    'x-patient-id',
    'x-uid',
    'x-role',
    'x-email',
    'x-name',
    'x-display-name',
    'x-org-id',
    'x-correlation-id',
    'x-request-id',
  ]) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  headers.set('accept', 'application/json');
  headers.set('content-type', 'application/json');

  if (!headers.has('x-role')) headers.set('x-role', 'patient');

  return headers;
}

async function readUpstreamBody(res: Response) {
  const text = await res.text().catch(() => '');
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function POST(req: NextRequest) {
  let body = '';

  try {
    body = await req.text();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_request_body' },
      { status: 400 },
    );
  }

  if (!body.trim()) {
    return NextResponse.json(
      { ok: false, error: 'empty_event_payload' },
      { status: 400 },
    );
  }

  let url = '';

  try {
    url = targetUrl();
    const res = await fetch(url, {
      method: 'POST',
      headers: forwardHeaders(req),
      body,
      cache: 'no-store',
    });

    const payload = await readUpstreamBody(res);

    return NextResponse.json(payload ?? { ok: res.ok }, {
      status: res.status,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: 'events_emit_unavailable',
        message: error instanceof Error ? error.message : 'Event gateway unavailable',
      },
      { status: 502 },
    );
  }
}
