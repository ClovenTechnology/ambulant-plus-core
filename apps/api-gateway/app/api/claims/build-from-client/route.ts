import { NextRequest, NextResponse } from "next/server";
import { buildClaimFromBillableEvents } from "@ambulant/client-core/src/claims";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const clientId = String(body.clientId || "").trim();
    const claimType = String(body.claimType || "").trim() as
      | "MEDICAL_AID_CLAIM"
      | "CORPORATE_CLAIM"
      | "SPONSOR_INVOICE";

    if (!clientId) {
      return NextResponse.json({ ok: false, error: "clientId_required" }, { status: 400 });
    }

    if (!["MEDICAL_AID_CLAIM", "CORPORATE_CLAIM", "SPONSOR_INVOICE"].includes(claimType)) {
      return NextResponse.json({ ok: false, error: "invalid_claimType" }, { status: 400 });
    }

    const claim = await buildClaimFromBillableEvents({
      orgId: body.orgId ?? "org-default",
      clientId,
      claimType,
      currency: body.currency ?? "ZAR",
      notes: body.notes,
      billableEventIds: Array.isArray(body.billableEventIds) ? body.billableEventIds : undefined
    });

    return NextResponse.json({ ok: true, claim }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build claim from billable events.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}