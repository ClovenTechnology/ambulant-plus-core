// apps/clinician-app/app/api/practice/claims/route.ts
import { NextRequest } from "next/server";

import { apigwBase, forwardClinicianHeaders, jsonError, relayJsonResponse } from "../../_apigw";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const res = await fetch(`${apigwBase()}/api/practice/claims${req.nextUrl.search || ""}`, {
      method: "GET",
      headers: forwardClinicianHeaders(req),
      cache: "no-store",
    });

    return relayJsonResponse(res);
  } catch (err) {
    return jsonError("Unable to load practice claims.", err);
  }
}
