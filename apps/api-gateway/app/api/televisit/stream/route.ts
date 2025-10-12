import { NextRequest } from 'next/server';
import { addClient } from '@/src/lib/televisit-hub';

export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get('roomId') || '';
  if (!roomId) return new Response('roomId required', { status: 400 });

  const ts = new TransformStream();
  const writer = ts.writable.getWriter();
  const remove = addClient(roomId, writer);

  const ka = setInterval(() => writer.write(':\n\n'), 15000);
  req.signal.addEventListener('abort', () => { clearInterval(ka); remove(); writer.close(); });

  return new Response(ts.readable, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' }
  });
}
