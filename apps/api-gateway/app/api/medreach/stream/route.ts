// apps/api-gateway/app/api/medreach/stream/route.ts
import { NextRequest } from 'next/server';
import { addClient } from '@/src/lib/sse';
import { readIdentity } from '@/src/lib/identity';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

type MedReachRole = 'admin' | 'phleb' | 'patient' | 'clinician' | 'anonymous';

function roleOf(who: ReturnType<typeof readIdentity>): MedReachRole {
  return String((who as any)?.role || 'anonymous') as MedReachRole;
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

  const drawDelegate = (prisma as any).draw;

  if (!drawDelegate?.findFirst) {
    return new Response('draw store unavailable', { status: 503 });
  }

  const draw = await drawDelegate.findFirst({
    where: { orderId },
  });

  if (!draw) {
    return new Response('not found', { status: 404 });
  }

  const allowed =
    role === 'admin' ||
    (role === 'patient' && uid === String(draw.patientId || '')) ||
    (role === 'clinician' && uid === String(draw.clinicianId || '')) ||
    (role === 'phleb' && uid === String(draw.phlebId || ''));

  if (!allowed) {
    return new Response('forbidden', { status: 403 });
  }

  const encoder = new TextEncoder();

  let removeClient: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const writer = sseWriter(controller);

      removeClient = addClient(orderId, {
        id: crypto.randomUUID(),
        res: writer,
      });

      writer.write(encoder.encode(': connected\n\n'));

      heartbeat = setInterval(() => {
        try {
          writer.write(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          // Client may have disconnected.
        }
      }, 15_000);

      req.signal.addEventListener('abort', () => {
        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = null;
        }

        if (removeClient) {
          removeClient();
          removeClient = null;
        }

        try {
          controller.close();
        } catch {
          // Stream may already be closed.
        }
      });
    },

    cancel() {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }

      if (removeClient) {
        removeClient();
        removeClient = null;
      }
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