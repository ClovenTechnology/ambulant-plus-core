// apps/clinician-app/app/api/analytics/practice/route.ts
import { NextRequest } from "next/server";

import { apigwBase, forwardClinicianHeaders, jsonError, relayJsonResponse } from "../../_apigw";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const res = await fetch(apigwBase() + "/api/analytics/practice" + (req.nextUrl.search || ""), {
      method: "GET",
      cache: "no-store",
      headers: forwardClinicianHeaders(req),
    });

    return relayJsonResponse(res);
  } catch (error) {
    return jsonError(error, "practice_team_analytics_proxy_failed", 502);
  }
}
