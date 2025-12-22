// apps/patient-app/app/api/careport/track/stream/route.ts
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

type CoordWithTs = { lat: number; lng: number; ts: number };

const CAREPORT_BASE =
  process.env.CAREPORT_BASE_URL ||
  process.env.CLINICIAN_BASE_URL ||
  process.env.NEXT_PUBLIC_CLINICIAN_BASE_URL ||
  '';

/**
 * Proxy to real CarePort tracking SSE if configured.
 *
 * Expected upstream endpoint:
 *   GET /api/careport/track/stream
 *
 * It should emit named events: "pharmacy", "rider", "coords", "meta".
 */
async function proxyToBackend(req: NextRequest) {
  const url = `${CAREPORT_BASE.replace(
    /\/$/,
    '',
  )}/api/careport/track/stream`;

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
    throw new Error('Upstream CarePort SSE has no body');
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

export async function GET(req: NextRequest) {
  // 1) Try to proxy to real backend if configured
  if (CAREPORT_BASE) {
    try {
      return await proxyToBackend(req);
    } catch (err) {
      console.warn(
        '[CarePort SSE] Failed to proxy to backend, using mock:',
        err,
      );
      // fall through to mock stream below
    }
  }

  // 2) MOCK STREAM (your existing implementation)
  const baseTs = Date.now();
  const routeCoords = [
    { lat: -26.0820, lng: 28.0340 }, // pharmacy (pickup)
    { lat: -26.0825, lng: 28.0348 },
    { lat: -26.0832, lng: 28.0356 },
    { lat: -26.0840, lng: 28.0364 },
    { lat: -26.0848, lng: 28.0374 },
    { lat: -26.0856, lng: 28.0386 },
    { lat: -26.0864, lng: 28.0398 },
    { lat: -26.0869, lng: 28.0406 },
    { lat: -26.0874, lng: 28.0412 },
    { lat: -26.0878, lng: 28.0418 },
  ];

  const route: CoordWithTs[] = routeCoords.map((p, i) => ({
    lat: p.lat,
    lng: p.lng,
    ts: baseTs + i * 1000, // 1s apart for demo
  }));

  const pharmacy = {
    id: 'ph-001',
    name: 'MedCare Sandton',
    address: 'Sandton, Johannesburg',
    coords: { lat: routeCoords[0].lat, lng: routeCoords[0].lng },
    distanceText: '2.1 km from patient',
  };

  const riderProfile = {
    id: 'r-1234',
    name: 'Sipho R.',
    avatar: '/rider-avatar.png',
    rating: 4.8,
    vehicle: 'Motorbike • Red',
    phoneMasked: '+27 ••• ••• 1234',
    regPlate: 'GP-123-XY',
    tripsCount: 1242,
  };

  const stream = new ReadableStream({
    start(controller) {
      let i = 0;
      let closed = false;
      const encoder = new TextEncoder();

      function sendEvent(name: string | null, data: any) {
        const payload =
          (name ? `event: ${name}\n` : '') +
          `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      }

      // initial meta
      sendEvent('meta', { status: 'connected', ts: Date.now() });

      // send pharmacy once (canonical pickup)
      sendEvent('pharmacy', pharmacy);

      // send rider profile once
      sendEvent('rider', riderProfile);

      const interval = setInterval(() => {
        if (closed) return;

        const slice = route.slice(0, i + 1);
        sendEvent('coords', slice);

        // heartbeat comment to keep proxies happy
        controller.enqueue(encoder.encode(': heartbeat\n\n'));

        i++;
        if (i >= route.length) {
          sendEvent('meta', { status: 'done', ts: Date.now() });
          clearInterval(interval);
          controller.close();
          closed = true;
        }
      }, 1000);

      // @ts-ignore – Node has this
      controller.signal?.addEventListener('abort', () => {
        clearInterval(interval);
        closed = true;
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
