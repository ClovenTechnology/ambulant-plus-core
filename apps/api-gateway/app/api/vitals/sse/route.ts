import { NextRequest } from 'next/server';
import { subscribe, getHistory } from '@/src/lib/sseBus';

export const runtime = 'nodejs'; // ensure streaming works

export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get('room_id') || '';
  if (!roomId) {
    return new Response('missing room_id', { status: 400 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const send = (obj: any) => controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`));

      // send last few on connect
      for (const v of getHistory(roomId)) send(v);

      const unsub = subscribe(roomId, send);

      // SSE headers
      controller.enqueue(new TextEncoder().encode(':ok\n\n'));
      const keep = setInterval(() => controller.enqueue(new TextEncoder().encode(':keepalive\n\n')), 25000);

      return () => {
        clearInterval(keep);
        unsub();
      };
    },
    cancel() {}
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    }
  });
}
