// apps/clinician-app/app/api/practice/payouts/summary/route.ts
import { NextRequest } from "next/server";

import { apigwBase, forwardClinicianHeaders, jsonError, relayJsonResponse } from "../../../_apigw";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const res = await fetch(`${apigwBase()}/api/practice/payouts/summary${req.nextUrl.search || ""}`, {
      method: "GET",
      cache: "no-store",
      headers: forwardClinicianHeaders(req),
    });

    return relayJsonResponse(res);
  } catch (error) {
    return jsonError(error, "practice_payouts_summary_proxy_failed", 502);
  }
}
