// apps/api-gateway/app/api/vitals/sse/route.ts
import { NextRequest } from 'next/server';
import { subscribe, getHistory } from '@/src/lib/sseBus';

export const runtime = 'nodejs'; // ensure streaming works
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get('room_id') || '';
  if (!roomId) {
    return new Response('missing room_id', { status: 400 });
  }

  const encoder = new TextEncoder();
  let keep: ReturnType<typeof setInterval> | null = null;
  let unsub: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (obj: any) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      // send last few on connect
      for (const v of getHistory(roomId)) send(v);

      unsub = subscribe(roomId, send);

      // initial comment + keepalive
      controller.enqueue(encoder.encode(':ok\n\n'));
      keep = setInterval(
        () => controller.enqueue(encoder.encode(':keepalive\n\n')),
        25_000,
      );
    },
    cancel() {
      if (keep) clearInterval(keep);
      if (unsub) unsub();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
