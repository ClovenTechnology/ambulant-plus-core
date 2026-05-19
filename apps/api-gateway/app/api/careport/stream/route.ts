// apps/api-gateway/app/api/careport/stream/route.ts
import { NextRequest } from 'next/server';
import { addClient } from '@/src/lib/sse';
import { readIdentity } from '@/src/lib/identity';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('orderId') || '';
  if (!orderId) return new Response('orderId required', { status: 400 });

  // Authorize viewer against the delivery record
  const who = readIdentity(req.headers);
  const role = String((who as any)?.role ?? 'anonymous');
  const uid = String((who as any)?.uid ?? '');

  const delivery = await prisma.delivery.findFirst({ where: { orderId } });
  if (!delivery) return new Response('not found', { status: 404 });

  const allowed =
    role === 'admin' ||
    (role === 'patient' && uid === delivery.patientId) ||
    (role === 'clinician' && uid === delivery.clinicianId) ||
    (role === 'rider' && uid === delivery.riderId);

  if (!allowed) return new Response('forbidden', { status: 403 });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();

      // Minimal sink object compatible with existing addClient expectations
      const sink = {
        write(chunk: string | Uint8Array) {
          const data = typeof chunk === 'string' ? enc.encode(chunk) : chunk;
          controller.enqueue(data);
        },
        end() {
          try { controller.close(); } catch {}
        },
      };

      const remove = addClient(orderId, { id: crypto.randomUUID(), res: sink as any });
      sink.write(': connected\n\n');

      (req.signal as any)?.addEventListener?.('abort', () => {
        remove();
        try { controller.close(); } catch {}
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
