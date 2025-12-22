// apps/patient-app/app/api/reminders/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APIGW = process.env.NEXT_PUBLIC_APIGW_BASE || 'http://localhost:3010';

async function forward(path: string, init: RequestInit = {}) {
  const url = `${APIGW.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, { ...init });
  const text = await res.text().catch(() => '');
  try {
    return new NextResponse(text ? JSON.parse(text) : {}, {
      status: res.status,
      headers: {
        'Cache-Control': 'no-store',
        'content-type': res.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch {
    return new NextResponse(text, { status: res.status });
  }
}

// GET /api/reminders -> proxy to APIGW /api/reminders
// Special case: ?for=today -> fetch all, then filter to "today" on this edge backend
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const searchParams = url.searchParams;
  const forParam = searchParams.get('for');

  // when for=today, we do a small post-filter on top of the APIGW
  if (forParam === 'today') {
    const upstreamParams = new URLSearchParams(searchParams);
    upstreamParams.delete('for'); // don't send this to APIGW

    const qs = upstreamParams.toString();
    const path = qs ? `/api/reminders?${qs}` : '/api/reminders';
    const upstreamUrl = `${APIGW.replace(/\/$/, '')}${path}`;

    const res = await fetch(upstreamUrl, { cache: 'no-store' });
    const text = await res.text().catch(() => '');

    try {
      const parsed: any = text ? JSON.parse(text) : {};

      const list: any[] = Array.isArray(parsed?.reminders)
        ? parsed.reminders
        : Array.isArray(parsed)
        ? parsed
        : [];

      // "today" semantics: keep Pending reminders only.
      // (client can additionally narrow by ?source=medication, etc.)
      const filtered = list.filter((r) => r && r.status === 'Pending');

      const body = Array.isArray(parsed?.reminders)
        ? { ...parsed, reminders: filtered }
        : filtered;

      return new NextResponse(JSON.stringify(body), {
        status: res.status,
        headers: {
          'Cache-Control': 'no-store',
          'content-type': 'application/json',
        },
      });
    } catch {
      // If upstream didn't return JSON, just pass it through.
      return new NextResponse(text, { status: res.status });
    }
  }

  // default: simple proxy behaviour
  const qs = searchParams.toString();
  const path = qs ? `/api/reminders?${qs}` : '/api/reminders';
  return forward(path);
}

// PUT /api/reminders -> create one or more reminders
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return forward('/api/reminders', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// POST /api/reminders -> actions
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return forward('/api/reminders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// DELETE /api/reminders -> delete by id / ids
export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const path = qs ? `/api/reminders?${qs}` : '/api/reminders';
  const body = await req.json().catch(() => ({}));
  return forward(path, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
