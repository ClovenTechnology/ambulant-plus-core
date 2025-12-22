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
    'connection': 'keep-alive',
    'access-control-allow-origin': '*',
  });

  let lastTs = BigInt(Date.now() - 60_000); // start from last 60s
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(type: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${type}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      // heartbeat
      const hb = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
      }, 15000);

      async function pump() {
        while (!closed) {
          const where: any = { ts: { gt: lastTs } };
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
            const payload = (() => {
              try { return r.payload ? JSON.parse(r.payload) : null; } catch { return r.payload; }
            })();
            send(r.kind, { id: r.id, ts: r.ts.toString(), kind: r.kind, payload });
          }

          // backoff a bit
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      pump().catch(() => {});

      // cleanup
      // @ts-ignore - controller has no 'closed' event in types; rely on cancel
      stream.cancel = () => {
        closed = true;
        clearInterval(hb);
      };
    },
    cancel() { closed = true; },
  });

  return new Response(stream, { headers });
}
