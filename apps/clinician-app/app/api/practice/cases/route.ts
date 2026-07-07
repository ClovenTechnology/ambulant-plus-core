// apps/clinician-app/app/api/practice/cases/route.ts
import { NextRequest } from "next/server";

import { apigwBase, forwardClinicianHeaders, jsonError, relayJsonResponse } from "../../_apigw";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const res = await fetch(`${apigwBase()}/api/practice/cases${req.nextUrl.search || ""}`, {
      method: "GET",
      headers: forwardClinicianHeaders(req),
      cache: "no-store",
    });

    return relayJsonResponse(res);
  } catch (err) {
    return jsonError("Unable to load practice cases.", err);
  }
}
