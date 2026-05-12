import { NextRequest } from 'next/server';
import { addClient } from '@/src/lib/sse';
import { readIdentity } from '@/src/lib/identity';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

type CarePortRole = 'admin' | 'rider' | 'patient' | 'clinician' | 'anonymous';

function roleOf(who: ReturnType<typeof readIdentity>): CarePortRole {
  return String((who as any)?.role || 'anonymous') as CarePortRole;
}

function uidOf(who: ReturnType<typeof readIdentity>): string {
  return String((who as any)?.uid || '');
}

function sseWriter(controller: ReadableStreamDefaultController<Uint8Array>) {
  return {
    write(chunk: Uint8Array) {
      controller.enqueue(chunk);
    },
  };
}

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('orderId') || '';

  if (!orderId) {
    return new Response('orderId required', { status: 400 });
  }

  const who = readIdentity(req.headers);
  const role = roleOf(who);
  const uid = uidOf(who);

  const delivery = await prisma.delivery.findFirst({
    where: { orderId },
  });

  if (!delivery) {
    return new Response('not found', { status: 404 });
  }

  const allowed =
    role === 'admin' ||
    (role === 'patient' && uid === delivery.patientId) ||
    (role === 'clinician' && uid === delivery.clinicianId) ||
    (role === 'rider' && uid === delivery.riderId);

  if (!allowed) {
    return new Response('forbidden', { status: 403 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const writer = sseWriter(controller);
      const remove = addClient(orderId, {
        id: crypto.randomUUID(),
        res: writer,
      });

      writer.write(encoder.encode(': connected\n\n'));

      req.signal.addEventListener('abort', () => {
        remove();

        try {
          controller.close();
        } catch {
          // Stream may already be closed.
        }
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