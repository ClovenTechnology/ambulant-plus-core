import { NextRequest } from 'next/server';
import { addClient, sseKeys } from '@/src/lib/sse';
import { readIdentity } from '@/src/lib/identity';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('orderId') || '';
  const drawId = req.nextUrl.searchParams.get('drawId') || '';
  const bundleId = req.nextUrl.searchParams.get('bundleId') || '';

  if (!orderId && !drawId && !bundleId) {
    return new Response('orderId or drawId or bundleId required', { status: 400 });
  }

  const who = readIdentity(req.headers);

  let draw =
    drawId
      ? await prisma.draw.findUnique({ where: { id: drawId } })
      : orderId
      ? await prisma.draw.findFirst({ where: { orderId } })
      : null;

  if (!draw && bundleId) {
    const bundle = await prisma.medReachSpecimenBundle.findUnique({
      where: { id: bundleId },
    });

    if (!bundle) return new Response('not found', { status: 404 });

    draw = bundle.drawId
      ? await prisma.draw.findUnique({ where: { id: bundle.drawId } })
      : bundle.orderId
      ? await prisma.draw.findFirst({ where: { orderId: bundle.orderId } })
      : null;
  }

  if (!draw) return new Response('not found', { status: 404 });

  const allowed =
    who.role === 'admin' ||
    who.role === 'lab' ||
    (who.role === 'patient' && who.uid === draw.patientId) ||
    (who.role === 'clinician' && who.uid === draw.clinicianId) ||
    (who.role === 'phleb' && who.uid === draw.phlebId);

  if (!allowed) return new Response('forbidden', { status: 403 });

  const channelKey = bundleId
    ? sseKeys.bundle(bundleId)
    : drawId
    ? sseKeys.draw(drawId)
    : sseKeys.order(orderId);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const writer = controller as unknown as {
        write(chunk: Uint8Array): void | Promise<void>;
        close?(): void | Promise<void>;
      };
      const remove = addClient(channelKey, { id: crypto.randomUUID(), res: writer });
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
    },
  });
}