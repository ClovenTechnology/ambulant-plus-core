// apps/api-gateway/app/api/events/stream/route.ts
import { NextRequest } from 'next/server';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

type Opts = {
  clinicianId?: string;
  patientId?: string;
  orgId?: string;
  kinds?: string[];
};

function normalisePayload(raw: unknown) {
  if (raw == null) return null;

  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  return raw;
}

export async function GET(req: NextRequest) {
  const u = new URL(req.url);

  const q: Opts = {
    clinicianId: u.searchParams.get('clinicianId') || undefined,
    patientId: u.searchParams.get('patientId') || undefined,
    orgId: u.searchParams.get('orgId') || undefined,
    kinds: (u.searchParams.get('kinds') || '').split(',').filter(Boolean),
  };

  const headers = new Headers({
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'access-control-allow-origin': '*',
  });

  let lastTs = BigInt(Date.now() - 60_000);
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();

      function send(type: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${type}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      heartbeat = setInterval(() => {
        if (!closed) {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        }
      }, 15_000);

      async function pump() {
        while (!closed) {
          const where: Record<string, any> = {
            ts: { gt: lastTs },
          };

          if (q.orgId) where.orgId = q.orgId;
          if (q.clinicianId) where.targetClinicianId = q.clinicianId;
          if (q.patientId) where.targetPatientId = q.patientId;
          if (q.kinds?.length) where.kind = { in: q.kinds };

          const rows = await prisma.runtimeEvent.findMany({
            where,
            orderBy: { ts: 'asc' },
            take: 100,
          });

          for (const r of rows) {
            lastTs = r.ts;

            send(r.kind, {
              id: r.id,
              ts: r.ts.toString(),
              kind: r.kind,
              payload: normalisePayload(r.payload),
            });
          }

          await new Promise((resolve) => setTimeout(resolve, 2_000));
        }
      }

      pump().catch((err) => {
        if (!closed) {
          send('error', {
            error: 'event_stream_failed',
            detail: err?.message || String(err),
          });
        }
      });
    },

    cancel() {
      closed = true;

      if (heartbeat) {
        clearInterval(heartbeat);
      }
    },
  });

  req.signal.addEventListener('abort', () => {
    closed = true;

    if (heartbeat) {
      clearInterval(heartbeat);
    }
  });

  return new Response(stream, { headers });
}