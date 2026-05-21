// apps/patient-app/app/api/insightcore/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500, details?: Record<string, unknown>) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      source: "insightcore",
      ...(details ? { details } : {}),
    },
    { status },
  );
}

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// POST body: { kind: string; ...payload }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return jsonError("invalid_json_body", 400);
  }

  const url = process.env.INSIGHTCORE_URL;
  const key = process.env.INSIGHTCORE_API_KEY;

  if (!url || !url.trim()) {
    return jsonError("INSIGHTCORE_URL_required", 500);
  }

  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(key ? { authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const payload = await readPayload(upstream);

  if (!upstream.ok) {
    return jsonError("insightcore_upstream_failed", upstream.status, {
      upstreamStatus: upstream.status,
      upstreamPayload: payload,
    });
  }

  return NextResponse.json(payload, { status: 200 });
}