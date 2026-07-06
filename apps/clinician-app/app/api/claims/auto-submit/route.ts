// apps/clinician-app/app/api/claims/auto-submit/route.ts
import { NextRequest } from "next/server";
import { apigwBase, forwardClinicianHeaders, jsonError, relayJsonResponse } from "../../_apigw";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();

    const res = await fetch(`${apigwBase()}/api/claims/auto-submit`, {
      method: "POST",
      cache: "no-store",
      headers: forwardClinicianHeaders(req),
      body,
    });

    return relayJsonResponse(res);
  } catch (error) {
    return jsonError(error, "claims_auto_submit_proxy_failed", 502);
  }
}
