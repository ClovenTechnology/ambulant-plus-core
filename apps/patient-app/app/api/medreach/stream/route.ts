// apps/patient-app/app/api/medreach/stream/route.ts
import { NextRequest } from 'next/server';
import { medReachMockData } from '../../../../components/fallbackMocks';

export const dynamic = 'force-dynamic';

// Optional backend base URL (for real SSE once the service exists)
const CLIN_BASE =
  process.env.MEDREACH_BASE_URL ||
  process.env.CLINICIAN_BASE_URL ||
  process.env.NEXT_PUBLIC_CLINICIAN_BASE_URL ||
  '';

// In-memory jobs store for mock mode
let JOBS = medReachMockData.map((j) => ({ ...j }));

/**
 * Proxy to real clinician / MedReach backend if configured.
 *
 * Expected upstream endpoint:
 *   GET /api/medreach/stream  (text/event-stream)
 *
 * This just pipes the SSE bytes straight through.
 */
async function proxyToClinician(req: NextRequest) {
  const url = `${CLIN_BASE.replace(/\/$/, '')}/api/medreach/stream`;

  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
  };

  const cookie = req.headers.get('cookie');
  const auth = req.headers.get('authorization');
  if (cookie) headers.cookie = cookie;
  if (auth) headers.authorization = auth;

  const upstream = await fetch(url, {
    headers,
    cache: 'no-store',
  });

  if (!upstream.body) {
    throw new Error('Upstream MedReach SSE has no body');
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

/**
 * GET /api/medreach/stream
 */
export async function GET(req: NextRequest) {
  // 1) Try real backend if configured
  if (CLIN_BASE) {
    try {
      return await proxyToClinician(req);
    } catch (err) {
      console.warn(
        '[MedReach SSE] Failed to proxy to clinician backend, falling back to mock:',
        err,
      );
      // fall through to mock mode below
    }
  }

  // 2) Mock mode (your existing behaviour)
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (data: any) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );
      };

      // Initial snapshot
      send(JOBS);

      // Periodically "touch" jobs to simulate activity
      const interval = setInterval(() => {
        // In future, you could randomise statuses or re-read from DB/service
        send(JOBS);
      }, 15_000);

      // Keep-alive comments to avoid some proxies timing out
      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(': keep-alive\n\n'));
      }, 45_000);

      const close = () => {
        clearInterval(interval);
        clearInterval(keepAlive);
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      // @ts-ignore – not all environments expose `signal`, but fine for Node
      controller.signal?.addEventListener('abort', close);
    },
    cancel() {
      // intervals cleaned up in start()
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
