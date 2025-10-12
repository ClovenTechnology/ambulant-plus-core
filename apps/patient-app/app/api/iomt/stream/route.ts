// apps/patient-app/app/api/iomt/stream/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Mock: push a vitals line every 2s (replace later with MQTT)
      const t = setInterval(() => {
        const payload = JSON.stringify({
          ts: Date.now(),
          hr: 60 + Math.floor(Math.random()*30),
          spo2: 95 + Math.floor(Math.random()*4),
          temp: 36 + Math.random(),
          sourceMap: { hr: 'Wearable', spo2: 'Wearable', temp: 'Wearable' }
        });
        controller.enqueue(enc.encode(`data: ${payload}\n\n`));
      }, 2000);

      // keep reference for cleanup
      (globalThis as any).__iomtTimer = t;
    },
    cancel() {
      const t = (globalThis as any).__iomtTimer;
      if (t) clearInterval(t);
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
