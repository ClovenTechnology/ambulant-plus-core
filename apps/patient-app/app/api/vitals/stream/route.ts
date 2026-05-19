// apps/patient-app/app/api/vitals/stream/route.ts
import { NextResponse } from 'next/server';
import { addClient, removeClient } from '../../_lib/broadcaster';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/* SSE stream — keep connection open and push events */
export async function GET(req: Request) {
  const encoder = new TextEncoder();

  let clientId: number | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;

        if (ping) {
          clearInterval(ping);
          ping = null;
        }

        if (clientId !== null) {
          try {
            removeClient(clientId);
          } catch {
            // Ignore broadcaster cleanup failures.
          }

          clientId = null;
        }

        try {
          controller.close();
        } catch {
          // Ignore already-closed stream.
        }
      };

      const writeRaw = (message: string) => {
        if (closed) return;

        try {
          controller.enqueue(encoder.encode(message));
        } catch {
          close();
        }
      };

      clientId = addClient({
        write: (message: string) => writeRaw(message),
      });

      writeRaw(': connected\n\n');

      ping = setInterval(() => {
        writeRaw(': ping\n\n');
      }, 20_000);

      req.signal.addEventListener('abort', close, { once: true });
    },

    cancel() {
      closed = true;

      if (ping) {
        clearInterval(ping);
        ping = null;
      }

      if (clientId !== null) {
        try {
          removeClient(clientId);
        } catch {
          // Ignore broadcaster cleanup failures.
        }

        clientId = null;
      }
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}