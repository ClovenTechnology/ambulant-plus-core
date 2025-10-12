import { NextRequest } from 'next/server';
import { addClient } from '@/src/lib/sse';
import { readIdentity } from '@/src/lib/identity';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('orderId') || '';
  if (!orderId) return new Response('orderId required', { status: 400 });

  const who = readIdentity(req.headers);
  const draw = await prisma.draw.findFirst({ where: { orderId } });
  if (!draw) return new Response('not found', { status: 404 });

  const allowed =
    who.role === 'admin' ||
    (who.role === 'patient' && who.uid === draw.patientId) ||
    (who.role === 'clinician' && who.uid === draw.clinicianId) ||
    (who.role === 'phleb' && who.uid === draw.phlebId);

  if (!allowed) return new Response('forbidden', { status: 403 });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const writer = controller as unknown as ReadableStreamDefaultWriter<Uint8Array>;
      const remove = addClient(orderId, { id: crypto.randomUUID(), res: writer });
      const enc = new TextEncoder();
      writer.write(enc.encode(': connected\n\n'));
      (req.signal as any).addEventListener('abort', () => {
        remove();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'access-control-allow-origin': '*',
    },
  });
}
