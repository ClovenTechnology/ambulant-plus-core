// apps/patient-app/app/vitals/stream/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

function rand(value: number): number {
  return Math.round(value);
}

export async function GET() {
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = () => {
        const payload = {
          heartRate: rand(60 + Math.random() * 30),
          spo2: rand(95 + Math.random() * 4),
          temperature: (36.4 + Math.random() * 0.6).toFixed(1),
          hrv: rand(40 + Math.random() * 20),
          t: Date.now(),
        };

        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
          );
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

      timer = setInterval(send, 1000);
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