import { NextRequest, NextResponse } from "next/server";
import { readIdentity } from "@/src/lib/identity";
import {
  correlationIdFromHeaders,
  orgIdFromHeaders,
  requireRole,
} from "@/src/lib/careport";
import {
  generateCarePortRxQuotes,
  listCarePortRxQuotes,
  serializeCarePortRxQuote,
} from "@/src/lib/careport-rx-quotes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}

function clean(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);
  const correlationId = correlationIdFromHeaders(req.headers);

  try {
    requireRole(who, ["patient", "admin"]);
    const sessionId = clean(params.sessionId, 240);
    if (!sessionId) return json({ ok: false, error: "sessionId_required", correlationId }, 400);

    const quotes = await listCarePortRxQuotes({ who, orgId, sessionId });

    return json({
      ok: true,
      sessionId,
      quotes: quotes.map(serializeCarePortRxQuote),
      quoteCount: quotes.length,
      generated: false,
      correlationId,
    });
  } catch (error: any) {
    return json(
      {
        ok: false,
        error: error?.message || "careport_rx_quote_lookup_failed",
        reasonCode: "PHARMACY_DISCOVERY_TECHNICAL_ERROR",
        correlationId,
      },
      error?.status || 500,
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);
  const correlationId = correlationIdFromHeaders(req.headers);

  try {
    requireRole(who, ["patient", "admin"]);
    const sessionId = clean(params.sessionId, 240);
    if (!sessionId) return json({ ok: false, error: "sessionId_required", correlationId }, 400);

    const result = await generateCarePortRxQuotes({
      who,
      orgId,
      sessionId,
      correlationId,
    });

    return json({
      ok: true,
      sessionId,
      generated: true,
      quoteTtlSeconds: 300,
      availability: result.availability,
      quotes: result.quotes.map(serializeCarePortRxQuote),
      correlationId,
    });
  } catch (error: any) {
    return json(
      {
        ok: false,
        error: error?.message || "careport_rx_quote_generation_failed",
        availability: {
          state: "TECHNICAL_ERROR",
          reasonCode: "PHARMACY_DISCOVERY_TECHNICAL_ERROR",
          searchPhase: "FAILED",
          patientMessageKey: "PHARMACY_DISCOVERY_TECHNICAL_ERROR",
          technicalCorrelationId: correlationId,
        },
        correlationId,
      },
      error?.status || 500,
    );
  }
}
