// apps/patient-app/app/api/events/inbox/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { API, BASE } from '@/src/lib/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // enforce Node runtime

// DEBUG: log resolved bases once on cold start
console.log('[patient-events proxy:init]', { API, BASE });

function targetUrl(base: string, req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  return `${base.replace(/\/$/, '')}/api/events/inbox${qs ? `?${qs}` : ''}`;
}

export async function GET(req: NextRequest) {
  const headers = {
    'x-role': req.headers.get('x-role') ?? 'patient',
    'x-uid': req.headers.get('x-uid') ?? '',
  };

  for (const base of [API, BASE]) {
    const url = targetUrl(base, req);
    console.log('[patient-events proxy:try]', url);

    try {
      const r = await fetch(url, { method: 'GET', headers, cache: 'no-store' });
      const body = await r.text();

      console.log('[patient-events proxy:success]', { url, status: r.status });

      return new NextResponse(body, {
        status: r.status,
        headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' },
      });
    } catch (err: any) {
      console.error('[patient-events proxy:error]', { url, err: err?.message });
      // Loop continues if gateway fails, BASE is next
      if (base === BASE) {
        return NextResponse.json(
          { error: 'events_inbox_failed', detail: err?.message, tried: [API, BASE] },
          { status: 502 }
        );
      }
    }
  }

  // Should never reach here
  return NextResponse.json({ error: 'unreachable' }, { status: 502 });
}
