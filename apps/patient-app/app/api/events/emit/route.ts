import { NextRequest, NextResponse } from 'next/server';
import { API, BASE } from '@/src/lib/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function targetUrl(base: string) {
  return `${base.replace(/\/$/, '')}/api/events/emit`;
}

async function forward(url: string, headers: Record<string, string>, body: string) {
  const r = await fetch(url, { method: 'POST', headers, body, cache: 'no-store' });
  const ct = r.headers.get('content-type') ?? '';
  const text = await r.text();

  // If HTML error page came back, wrap as JSON error
  if (ct.includes('text/html') || text.startsWith('<!DOCTYPE')) {
    return NextResponse.json(
      { error: 'upstream_html_error', status: r.status, url, snippet: text.slice(0, 200) },
      { status: r.status }
    );
  }

  return new NextResponse(text, {
    status: r.status,
    headers: { 'content-type': ct || 'application/json' },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headers = {
    'content-type': 'application/json',
    'x-role': req.headers.get('x-role') ?? 'patient',
    'x-uid': req.headers.get('x-uid') ?? '',
  };

  for (const base of [API, BASE]) {
    const url = targetUrl(base);
    console.log('[events/emit:try]', url);
    try {
      return await forward(url, headers, body);
    } catch (err: any) {
      console.error('[events/emit:error]', { url, err: err?.message });
      if (base === BASE) {
        return NextResponse.json(
          { error: 'events_emit_failed', detail: err?.message, tried: [API, BASE] },
          { status: 502 }
        );
      }
    }
  }

  return NextResponse.json({ error: 'unreachable' }, { status: 502 });
}
