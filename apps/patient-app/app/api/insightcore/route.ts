import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST body: { kind: string; ...payload }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const url = process.env.INSIGHTCORE_URL;
  const key = process.env.INSIGHTCORE_API_KEY;

  if (!url) {
    // Dev stub: deterministic messages
    const name = body?.patientName || "the patient";
    const msgs = [
      `Baseline vitals look acceptable for ${name}.`,
      "Recommend 3-day HRV watch and morning SPO2 spot checks.",
      "Consider Atenolol 50 mg if resting HR > 95 across 3 days.",
    ];
    return NextResponse.json({ source: "stub", messages: msgs });
  }

  const r = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(key ? { authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const data = await r.json().catch(() => ({}));
  return NextResponse.json(data, { status: r.ok ? 200 : r.status });
}
