// apps/clinician-app/app/api/practice/route.ts
import { NextRequest } from "next/server";
import { apigwBase, forwardClinicianHeaders, jsonError, relayJsonResponse } from "../_apigw";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const res = await fetch(`${apigwBase()}/api/practice/me`, {
      method: "GET",
      cache: "no-store",
      headers: forwardClinicianHeaders(req),
    });

    return relayJsonResponse(res);
  } catch (error) {
    return jsonError(error, "practice_proxy_failed", 502);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.text();

    const res = await fetch(`${apigwBase()}/api/practice/me`, {
      method: "PATCH",
      cache: "no-store",
      headers: forwardClinicianHeaders(req),
      body,
    });

    return relayJsonResponse(res);
  } catch (error) {
    return jsonError(error, "practice_update_proxy_failed", 502);
  }
}
