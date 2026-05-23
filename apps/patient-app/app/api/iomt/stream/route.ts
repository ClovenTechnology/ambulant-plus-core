// apps/patient-app/app/api/iomt/stream/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/**
 * Health Monitor event stream.
 *
 * This endpoint used to emit generated vitals. It now only reports stream
 * readiness. Real vitals must be written through /api/v1/patients/[id]/vitals
 * by the Health Monitor session/bridge and read back through the vitals/report
 * read models.
 */
export async function GET() {
  const encoder = new TextEncoder();

  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          if (heartbeat) {
            clearInterval(heartbeat);
            heartbeat = null;
          }
          try {
            controller.close();
          } catch {
            // Already closed.
          }
        }
      };

      controller.enqueue(encoder.encode(': connected\n\n'));
      send({
        ok: true,
        ts: Date.now(),
        status: 'ready',
        source: 'health_monitor_session',
        message: 'Awaiting persisted device readings.',
      });

      heartbeat = setInterval(() => {
        send({
          ok: true,
          ts: Date.now(),
          status: 'ready',
          source: 'health_monitor_session',
        });
      }, 15_000);
    },

    cancel() {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
