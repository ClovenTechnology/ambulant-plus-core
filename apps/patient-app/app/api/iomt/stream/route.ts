// apps/patient-app/app/api/iomt/stream/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Mock: push a vitals line every 2s (replace later with MQTT)
      const timer = setInterval(() => {
        const payload = JSON.stringify({
          ts: Date.now(),
          hr: 60 + Math.floor(Math.random() * 30),
          spo2: 95 + Math.floor(Math.random() * 4),
          temp: 36 + Math.random(),
          sourceMap: { hr: 'Wearable', spo2: 'Wearable', temp: 'Wearable' },
        });

        try {
          // enqueue may throw if controller is already closed
          controller.enqueue(enc.encode(`data: ${payload}\n\n`));
        } catch (err) {
          // If the controller is closed, stop the timer and try to close safely.
          try {
            clearInterval(timer);
          } catch {}
          try {
            controller.close?.();
          } catch {}
        }
      }, 2000);

      // keep reference for cleanup across the process (safe guard)
      (globalThis as any).__iomtTimer = timer;
    },

    cancel() {
      try {
        const t = (globalThis as any).__iomtTimer;
        if (t) clearInterval(t);
      } catch {}
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
