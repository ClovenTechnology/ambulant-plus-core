// apps/api-gateway/app/api/insight/stream/route.ts
export const dynamic = 'force-dynamic';

declare const global: any;
if (!global.__INSIGHT_CLIENTS__) global.__INSIGHT_CLIENTS__ = [];
type Client = { id: string; session: string; controller: ReadableStreamDefaultController<Uint8Array> };

function sse(data: any, event?: string) {
  const head = event ? `event: ${event}\n` : '';
  return new TextEncoder().encode(`${head}data: ${JSON.stringify(data)}\n\n`);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const session = url.searchParams.get('session') || url.searchParams.get('roomId') || 'default';
  const id = Math.random().toString(36).slice(2);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const client: Client = { id, session, controller };
      (global.__INSIGHT_CLIENTS__ as Client[]).push(client);
      controller.enqueue(sse({ hello: 'insight-stream', session }, 'ready'));

      const ping = setInterval(() => {
        try { controller.enqueue(sse({ t: Date.now() }, 'ping')); } catch {}
      }, 15000);

      (req as any).signal?.addEventListener?.('abort', () => {
        clearInterval(ping);
        const arr = global.__INSIGHT_CLIENTS__ as Client[];
        const idx = arr.findIndex((c) => c.id === id);
        if (idx >= 0) arr.splice(idx, 1);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
