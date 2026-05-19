import { NextRequest, NextResponse } from "next/server";
import { forwardAuthHeaders, getGatewayBase } from "@/app/api/careport/_gw";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeMedication(m: any) {
  if (!m || typeof m !== "object") return null;

  const drug =
    String(
      m.drug ||
        m.name ||
        m.display ||
        m.medication ||
        m.medicationText ||
        m.label ||
        ""
    ).trim() || null;

  const sig = String(
    m.sig ||
      [m.dose, m.route, m.freq, m.duration].filter(Boolean).join(" · ") ||
      m.instructions ||
      m.note ||
      ""
  ).trim();

  if (!drug) return null;

  return {
    drug,
    sig: sig || "Use as directed"
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const encId = (url.searchParams.get("encId") || "").trim();

  if (!encId) {
    return NextResponse.json(
      { ok: false, error: "encId_required" },
      { status: 400 }
    );
  }

  const base = getGatewayBase();

  try {
    const upstream = new URL(
      `/api/encounters/${encodeURIComponent(encId)}/erx`,
      base
    );

    const r = await fetch(upstream.toString(), {
      method: "GET",
      headers: forwardAuthHeaders(req),
      cache: "no-store"
    });

    const js = await r.json().catch(() => ({}));

    if (!r.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: js?.error || `gateway_http_${r.status}`
        },
        { status: r.status }
      );
    }

    const meds = Array.isArray(js?.medications)
      ? js.medications
      : Array.isArray(js?.meds)
        ? js.meds
        : Array.isArray(js?.items)
          ? js.items
          : [];

    const first = normalizeMedication(meds[0]);

    if (!first) {
      return NextResponse.json(
        { ok: false, error: "no_rx_found_for_encounter" },
        { status: 404 }
      );
    }

    return NextResponse.json(first, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load latest Rx.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 502 }
    );
  }
}