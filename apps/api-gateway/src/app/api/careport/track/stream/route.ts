// apps/api-gateway/app/api/careport/track/stream/route.ts
import { NextRequest } from 'next/server';
import { prisma } from '@/src/lib/prisma';

const encoder = new TextEncoder();

// tiny helper to format SSE chunks
function sseChunk(event: string | null, data: any) {
  let payload = '';
  if (event) payload += `event: ${event}\n`;
  payload += `data: ${JSON.stringify(data)}\n\n`;
  return encoder.encode(payload);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const externalId =
    url.searchParams.get('id') || url.searchParams.get('jobId') || 'CP-1001';

  const job = await prisma.carePortJob.findUnique({
    where: { externalId },
    include: {
      pharmacy: true, // PharmacyPartner
    },
  });

  if (!job) {
    // still return an SSE stream with a friendly error event
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    writer.write(
      sseChunk('meta', {
        status: 'not_found',
        error: `CarePort job ${externalId} not found`,
      })
    );
    writer.close();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  }

  // optional: link to Delivery by externalId
  const delivery = await prisma.delivery.findFirst({
    where: { orderId: job.externalId },
  });

  // recent rider coords from LocationPing
  const pings = await prisma.locationPing.findMany({
    where: {
      kind: 'rider',
      entityId: job.riderId,
      orderId: job.externalId,
    },
    orderBy: { at: 'asc' },
    take: 50,
  });

  const coords = pings.map((p) => ({
    lat: p.lat,
    lng: p.lng,
    ts: p.at.getTime(),
  }));

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  // initial pharmacy event
  const pharmacy = job.pharmacy;
  if (pharmacy) {
    await writer.write(
      sseChunk('pharmacy', {
        id: pharmacy.id,
        name: pharmacy.name,
        address: pharmacy.contact ?? null,
        coords: null, // you can extend PharmacyPartner later with lat/lng
        distanceText: null,
        ts: Date.now(),
      })
    );
  }

  // initial rider event (very minimal for now)
  await writer.write(
    sseChunk('rider', {
      id: job.riderId,
      name: `Rider ${job.riderId}`,
      avatar: null,
      rating: null,
      vehicle: 'Motorbike',
      phoneMasked: null,
      phone: null,
      regPlate: null,
      tripsCount: null,
    })
  );

  // coords event
  if (coords.length > 0) {
    await writer.write(sseChunk('coords', coords));
  }

  // meta event (status + order details for DeliveryDetails card)
  await writer.write(
    sseChunk('meta', {
      status: job.status,
      order: {
        orderNo: job.externalId,
        encounterId: delivery?.encounterId ?? null,
        patientId: delivery?.patientId ?? null,
        clinicianId: delivery?.clinicianId ?? null,
        caseId: delivery?.caseId ?? null,
        trackingNo: job.externalId,
        riderId: job.riderId,
        deliveryAmount: delivery
          ? (delivery.priceCents / 100).toLocaleString('en-ZA', {
              style: 'currency',
              currency: 'ZAR',
            })
          : undefined,
        paymentMethod: 'Card',
        dateIso: delivery?.createdAt.toISOString(),
      },
    })
  );

  // (Optional) Poll DB periodically to push updates
  const interval = setInterval(async () => {
    try {
      const freshJob = await prisma.carePortJob.findUnique({
        where: { externalId: job.externalId },
      });
      if (!freshJob) return;

      await writer.write(
        sseChunk('meta', {
          status: freshJob.status,
        })
      );

      // new pings since last poll
      const newPings = await prisma.locationPing.findMany({
        where: {
          kind: 'rider',
          entityId: job.riderId,
          orderId: job.externalId,
        },
        orderBy: { at: 'asc' },
        take: 1,
      });

      if (newPings.length) {
        await writer.write(
          sseChunk('coords', newPings.map((p) => ({
            lat: p.lat,
            lng: p.lng,
            ts: p.at.getTime(),
          })))
        );
      }
    } catch (err) {
      console.warn('careport track poll failed', err);
    }
  }, 5000);

  // handle client disconnect
  const abort = req.signal;
  abort.addEventListener('abort', () => {
    clearInterval(interval);
    writer.close();
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
