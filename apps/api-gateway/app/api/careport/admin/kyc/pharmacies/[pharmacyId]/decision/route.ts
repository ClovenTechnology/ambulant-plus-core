// FILE: apps/api-gateway/app/api/careport/admin/kyc/pharmacies/[pharmacyId]/decision/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { readIdentity } from "@/src/lib/identity";
import { requireRole } from "@/src/lib/careport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { pharmacyId: string } }) {
  const who = readIdentity(req.headers);
  requireRole(who, ["admin"]);

  const pharmacyId = String(params.pharmacyId || "").trim();
  if (!pharmacyId) return NextResponse.json({ ok: false, error: "pharmacyId_required" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const decision = String(body?.decision || "").toLowerCase();
  const reason = String(body?.reason || "").trim();

  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json({ ok: false, error: "decision_must_be_approve_or_reject" }, { status: 400 });
  }
  if (decision === "reject" && !reason) {
    return NextResponse.json({ ok: false, error: "reason_required_for_reject" }, { status: 400 });
  }

  const next =
    decision === "approve"
      ? {
          kycStatus: "APPROVED",
          kycVerifiedAt: new Date(),
          kycRejectedReason: null,
        }
      : {
          kycStatus: "REJECTED",
          kycVerifiedAt: null,
          kycRejectedReason: reason,
        };

  const updated = await prisma.pharmacyPartner.update({
    where: { id: pharmacyId },
    data: next as any,
  });

  return NextResponse.json({ ok: true, pharmacy: updated }, { status: 200 });
}
