// apps/clinician-app/app/api/practice/members/route.ts
import { NextRequest, NextResponse } from "next/server";
import { apigwBase, forwardClinicianHeaders, jsonError, relayJsonResponse } from "../../_apigw";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function stripRouteOnlyKeys(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;

  const source = value as Record<string, unknown>;
  const { memberId: _memberId, id: _id, ...rest } = source;
  return rest;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const upstreamUrl = new URL(`${apigwBase()}/api/practice/members`);

    url.searchParams.forEach((value, key) => {
      upstreamUrl.searchParams.set(key, value);
    });

    const res = await fetch(upstreamUrl.toString(), {
      method: "GET",
      cache: "no-store",
      headers: forwardClinicianHeaders(req),
    });

    return relayJsonResponse(res);
  } catch (error) {
    return jsonError(error, "practice_members_proxy_failed", 502);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();

    const res = await fetch(`${apigwBase()}/api/practice/members`, {
      method: "POST",
      cache: "no-store",
      headers: forwardClinicianHeaders(req),
      body,
    });

    return relayJsonResponse(res);
  } catch (error) {
    return jsonError(error, "practice_member_create_proxy_failed", 502);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const parsed = rawBody ? JSON.parse(rawBody) : {};
    const memberId = clean(parsed?.memberId ?? parsed?.id);

    if (!memberId) {
      return NextResponse.json(
        { ok: false, error: "memberId_required" },
        { status: 400, headers: { "cache-control": "no-store" } },
      );
    }

    const body = JSON.stringify(stripRouteOnlyKeys(parsed));

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
