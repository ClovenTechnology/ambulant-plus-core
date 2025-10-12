// apps/admin-dashboard/app/api/analytics/models/[id]/predict/route.ts
import { NextRequest } from "next/server";

const ML_API_URL = process.env.ML_API_URL || "http://localhost:8000";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const r = await fetch(`${ML_API_URL}/predict`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await r.text();
  return new Response(text, {
    status: r.status,
    headers: { "content-type": r.headers.get("content-type") || "application/json" },
  });
}
