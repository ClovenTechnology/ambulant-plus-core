// apps/patient-app/app/api/iomt/sse/route.ts
import { NextRequest } from 'next/server';
import { bus } from '../_bus';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get('roomId') || 'default';

  let ka: NodeJS.Timeout | null = null;
  let onVital: ((evt: any) => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const enc = (data: any) =>
        controller.enqueue(new TextEncoder().encode(`event: vitals\ndata:${JSON.stringify(data)}\n\n`));

      onVital = (evt: any) => {
        if (evt?.roomId === roomId) enc(evt.data);
      };
      bus.on('vitals', onVital);

      // keepalive
      ka = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(':\n\n'));
        } catch {
          // ignore if closed
        }
      }, 15000);
    },
    cancel() {
      if (onVital) bus.off('vitals', onVital);
      if (ka) clearInterval(ka);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
