// apps/patient-app/app/api/clinicians/events/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getApigwBase() {
  return (
    process.env.APIGW_BASE ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_APIGW_URL ||
    ''
  );
}

// Local fallback: stable SSE that never throws when the client disconnects.
function localKeepAliveSSE() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`: connected\n\n`));

      const iv = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          clearInterval(iv);
        }
      }, 25000);

      // @ts-ignore
      this.onclose = () => {
        clearInterval(iv);
        try {
          controller.close();
        } catch {}
      };
    },
    cancel() {},
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

export async function GET() {
  const base = getApigwBase();
  if (!base) return localKeepAliveSSE();

  try {
    const upstream = await fetch(`${base.replace(/\/$/, '')}/api/clinicians/events`, {
      headers: {
        Accept: 'text/event-stream',
      },
      cache: 'no-store',
    });

    if (!upstream.ok || !upstream.body) {
      return localKeepAliveSSE();
    }

    // Stream through unchanged (plus keepalive-friendly headers)
    const headers = new Headers(upstream.headers);
    headers.set('Content-Type', 'text/event-stream');
    headers.set('Cache-Control', 'no-cache, no-transform');
    headers.set('Connection', 'keep-alive');

    return new Response(upstream.body, { status: 200, headers });
  } catch {
    return localKeepAliveSSE();
  }
}
