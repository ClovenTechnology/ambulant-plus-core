// apps/patient-app/app/api/iomt/stream/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET() {
  const encoder = new TextEncoder();

  let timer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = () => {
        const payload = JSON.stringify({
          ts: Date.now(),
          hr: 60 + Math.floor(Math.random() * 30),
          spo2: 95 + Math.floor(Math.random() * 4),
          temp: 36 + Math.random(),
          sourceMap: {
            hr: 'Wearable',
            spo2: 'Wearable',
            temp: 'Wearable',
          },
        });

        try {
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } catch {
          if (timer) {
            clearInterval(timer);
            timer = null;
          }

          try {
            controller.close();
          } catch {
            // Ignore already-closed stream.
          }
        }
      };

      controller.enqueue(encoder.encode(': connected\n\n'));
      send();

      timer = setInterval(send, 2000);
    },

    cancel() {
      if (timer) {
        clearInterval(timer);
        timer = null;
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