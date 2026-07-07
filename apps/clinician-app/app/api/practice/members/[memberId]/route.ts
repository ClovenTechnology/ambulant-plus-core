// apps/clinician-app/app/api/practice/members/[memberId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { apigwBase, forwardClinicianHeaders, jsonError, relayJsonResponse } from "../../../_apigw";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = {
  params: { memberId: string };
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}


export async function GET(req: NextRequest, { params }: Params) {
  const memberId = clean(params.memberId);

  if (!memberId) {
    return NextResponse.json(
      { ok: false, error: "memberId_required" },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const res = await fetch(
      `${apigwBase()}/api/practice/members/${encodeURIComponent(memberId)}${req.nextUrl.search || ""}`,
      {
        method: "GET",
        cache: "no-store",
        headers: forwardClinicianHeaders(req),
      },
    );

    return relayJsonResponse(res);
  } catch (error) {
    return jsonError(error, "practice_member_get_proxy_failed", 502);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const memberId = clean(params.memberId);

  if (!memberId) {
    return NextResponse.json(
      { ok: false, error: "memberId_required" },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const body = await req.text();

    const res = await fetch(
      `${apigwBase()}/api/practice/members/${encodeURIComponent(memberId)}`,
      {
        method: "PATCH",
        cache: "no-store",
        headers: forwardClinicianHeaders(req),
        body,
      },
    );

    return relayJsonResponse(res);
  } catch (error) {
    return jsonError(error, "practice_member_update_proxy_failed", 502);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const memberId = clean(params.memberId);

  if (!memberId) {
    return NextResponse.json(
      { ok: false, error: "memberId_required" },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const res = await fetch(
      `${apigwBase()}/api/practice/members/${encodeURIComponent(memberId)}`,
      {
        method: "DELETE",
        cache: "no-store",
        headers: forwardClinicianHeaders(req),
      },
    );

    return relayJsonResponse(res);
  } catch (error) {
    return jsonError(error, "practice_member_delete_proxy_failed", 502);
  }
}
