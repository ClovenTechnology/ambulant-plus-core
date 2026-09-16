import { withPartnerBoundary } from '@/src/lib/partner-access/boundary';
import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { readIdentity } from "@/src/lib/identity";
import { orgIdFromHeaders, requireRole } from "@/src/lib/careport";
import { resolveCarePortPharmacyId } from "@/src/lib/careport-rx-pharmacy-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function partnerOriginalGET(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ["admin", "pharmacy", "pharmacy_staff"]);
    const pharmacyId = await resolveCarePortPharmacyId({
      who,
      orgId,
      explicitPharmacyId: req.nextUrl.searchParams.get("pharmacyId"),
    });
    if (!pharmacyId) return new Response("pharmacyId_unresolved", { status: 409 });

    const encoder = new TextEncoder();
    let closed = false;
    let lastCreatedAt = new Date(Date.now() - 10 * 60_000);
    let lastId = "";

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, data: any) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          } catch {
            closed = true;
          }
        };

        send("connected", { pharmacyId, at: new Date().toISOString() });

        const poll = async () => {
          if (closed) return;
          try {
            const rows = await (prisma as any).carePortRxPharmacyEvent.findMany({
              where: {
                orgId,
                pharmacyId,
                OR: [
                  { createdAt: { gt: lastCreatedAt } },
                  { createdAt: lastCreatedAt, id: { gt: lastId } },
                ],
              },
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              take: 100,
            });

            for (const row of rows) {
              const createdAt = new Date(row.createdAt);
              if (
                createdAt.getTime() < lastCreatedAt.getTime() ||
                (createdAt.getTime() === lastCreatedAt.getTime() && String(row.id) <= lastId)
              ) continue;

              send("rx-event", row);
              lastCreatedAt = createdAt;
              lastId = String(row.id);
            }

            send("heartbeat", { at: new Date().toISOString() });
          } catch (error: any) {
            send("warning", { error: error?.message || "rx_event_poll_failed" });
          }
        };

        await poll();
        const timer = setInterval(() => void poll(), 4_000);
        const timeout = setTimeout(() => {
          clearInterval(timer);
          if (!closed) {
            closed = true;
            try { controller.close(); } catch {}
          }
        }, 55_000);

        req.signal.addEventListener("abort", () => {
          clearInterval(timer);
          clearTimeout(timeout);
          closed = true;
          try { controller.close(); } catch {}
        });
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      },
    });
  } catch (error: any) {
    return new Response(error?.message || "rx_events_stream_failed", { status: error?.status || 500 });
  }
}

export const GET = withPartnerBoundary(partnerOriginalGET, '/api/careport/pharmacies/me/rx-events/stream');
