// apps/api-gateway/app/api/analytics/clinicians/me/meta/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getViewerPlanTier } from "@/lib/planTier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function planLabel(planTier: string) {
  const tier = String(planTier || "basic").toLowerCase();
  if (tier === "host") return "Host / Practice";
  if (tier === "pro") return "Pro";
  if (tier === "free") return "Free";
  return "Basic";
}

export async function GET(req: NextRequest) {
  try {
    const viewer = await getViewerPlanTier(req);
    const viewerAny = viewer as any;

    return NextResponse.json(
      {
        ok: true,
        clinicianId: viewer?.clinicianId || null,
        clinicianName: viewerAny?.clinicianName || viewerAny?.name || "Clinician",
        planTier: viewer?.planTier || "basic",
        planLabel: planLabel(viewer?.planTier),
        practiceId: viewer?.practiceId || null,
        practiceName: viewer?.practiceName || null,
        canViewTeamAnalytics: viewer?.planTier === "host",
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err: any) {
    console.error("[analytics/clinicians/me/meta] GET error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to load clinician analytics meta" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
