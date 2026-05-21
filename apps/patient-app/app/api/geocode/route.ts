// apps/patient-app/app/api/geocode/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get("q") || "").trim();
  const country = String(searchParams.get("country") || "za").toLowerCase();

  if (!q) return NextResponse.json({ ok: false, error: "q_required" }, { status: 400 });

  // NOTE: Nominatim usage policy expects a real User-Agent; set one.
  const ua =
    process.env.GEOCODER_USER_AGENT ||
    "AmbulantCarePortDev/1.0 (dev; contact: dev@ambulant.invalid)";

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("q", q);
  url.searchParams.set("countrycodes", country);

  const r = await fetch(url.toString(), {
    headers: {
      "user-agent": ua,
      accept: "application/json",
    },
    cache: "no-store",
  });

  const arr = (await r.json().catch(() => [])) as any[];
  const hit = arr?.[0];

  if (!hit?.lat || !hit?.lon) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    addr: hit.display_name,
    lat: Number(hit.lat),
    lng: Number(hit.lon),
  });
}