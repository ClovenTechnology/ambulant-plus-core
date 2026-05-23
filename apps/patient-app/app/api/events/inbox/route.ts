// apps/patient-app/app/api/events/inbox/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function targetUrl(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  return `${apigwBase()}/api/events/inbox${qs ? `?${qs}` : ''}`;
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

export async function GET(req: NextRequest) {
  try {
    const res = await fetch(targetUrl(req), {
      method: 'GET',
      headers: forwardHeaders(req),
      cache: 'no-store',
    });

    const payload = await readUpstreamBody(res);

    return NextResponse.json(payload ?? { ok: res.ok, items: [] }, {
      status: res.status,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: 'events_inbox_unavailable',
        message: error instanceof Error ? error.message : 'Event gateway unavailable',
        items: [],
      },
      { status: 502 },
    );
  }
}
