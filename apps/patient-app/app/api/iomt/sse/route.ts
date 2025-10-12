import { NextRequest } from 'next/server';
import { bus } from '../_bus';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get('roomId') || 'default';

  const stream = new ReadableStream({
    start(controller) {
      const enc = (data: any) =>
        controller.enqueue(new TextEncoder().encode(`event: vitals\ndata:${JSON.stringify(data)}\n\n`));

      const onVital = (evt: any) => { if (evt?.roomId === roomId) enc(evt.data); };
      bus.on('vitals', onVital);

      // keepalive
      const ka = setInterval(() => controller.enqueue(new TextEncoder().encode(':\n\n')), 15000);

      return () => { bus.off('vitals', onVital); clearInterval(ka); };
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
}
