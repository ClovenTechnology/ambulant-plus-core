// apps/clinician-app/app/api/analytics/practice/members/[id]/route.ts
import { NextRequest } from "next/server";

import { apigwBase, forwardClinicianHeaders, jsonError, relayJsonResponse } from "../../../../_apigw";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  try {
    const memberId = encodeURIComponent(ctx.params?.id || "");
    const res = await fetch(
      apigwBase() + "/api/analytics/practice/members/" + memberId + (req.nextUrl.search || ""),
      {
        method: "GET",
        cache: "no-store",
        headers: forwardClinicianHeaders(req),
      },
    );

    return relayJsonResponse(res);
  } catch (error) {
    return jsonError(error, "practice_member_analytics_proxy_failed", 502);
  }
}
