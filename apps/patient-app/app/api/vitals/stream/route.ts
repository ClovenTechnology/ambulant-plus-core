// apps/patient-app/app/api/vitals/stream/route.ts
import { NextResponse } from 'next/server';
import { addClient, removeClient } from '../../_lib/broadcaster';

/* SSE stream — keep connection open and push events */
export async function GET(req: Request) {
  const { readable, writable } = new TransformStream();
  const res = new NextResponse(readable, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });

  // Write function requires a writer
  const writer = writable.getWriter();
  function writeRaw(s: string) {
    writer.write(new TextEncoder().encode(s));
  }

  // register client - store writer-like object in broadcaster
  const clientId = addClient({ write: (s: string) => writeRaw(s) }); // we pass an object shaped like earlier broadcaster
  // send a ping and initial comment
  writeRaw(': connected\n\n');

  // keep-alive ping every 20s
  const ping = setInterval(() => writeRaw(': ping\n\n'), 20000);

  // When the response is closed by the client, cleanup
  const close = () => {
    clearInterval(ping);
    removeClient(clientId);
    try { writer.close(); } catch (e) {}
  };

  // When client disconnects, Next.js doesn't provide direct hook - rely on signal:
  const controller = new AbortController();
  req.signal.addEventListener('abort', () => {
    close();
    controller.abort();
  });

  return res;
}
