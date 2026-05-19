import { NextRequest, NextResponse } from "next/server";
import { readIdentity } from "@/src/lib/identity";
import { buildMedReachBillableEventsFromOrder } from "@ambulant/client-core/src/medreach";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const who = readIdentity(req.headers);

    if (!["admin", "lab", "lab_staff"].includes(String(who.role || "").toLowerCase())) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const orderId = String(params.orderId || "").trim();
    if (!orderId) {
      return NextResponse.json({ ok: false, error: "orderId_required" }, { status: 400 });
    }

    const items = await buildMedReachBillableEventsFromOrder(orderId);

    return NextResponse.json(
      {
        ok: true,
        orderId,
        createdCount: items.length,
        items
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build MedReach billable events.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}