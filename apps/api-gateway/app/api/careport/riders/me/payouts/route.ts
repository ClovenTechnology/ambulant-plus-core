import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { readIdentity } from "@/src/lib/identity";
import { requireRole, orgIdFromHeaders } from "@/src/lib/careport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } });
}

function normalizeLine(line: any) {
  return {
    id: line.id,
    role: "rider",
    entityId: line.recipientId,
    periodStart: line.batch?.periodStart ?? line.createdAt,
    periodEnd: line.batch?.periodEnd ?? line.createdAt,
    amountCents: line.netPayableMinor ?? 0,
    grossCents: line.grossMinor ?? 0,
    tripCount: line.tripCount ?? 0,
    currency: line.currency ?? line.batch?.currency ?? "ZAR",
    status: String(line.status || "PENDING").toLowerCase(),
    remittanceRef: line.remittanceRef ?? line.batch?.remittanceRef ?? null,
    paidAt: line.paidAt ?? null,
    metadata: line.metadata ?? null,
  };
}

function carePortRiderPayoutReadiness(profile: any) {
  const blockers: string[] = [];

  if (!profile) {
    blockers.push("rider_profile_not_found");
  }

  if (profile && profile.isActive !== true) {
    blockers.push("rider_not_active");
  }

  if (
    profile &&
    (String(profile.kyiStatus || "").toUpperCase() !== "VERIFIED" || !profile.kyiVerifiedAt)
  ) {
    blockers.push("rider_not_kyi_verified");
  }

  return {
    subject: "rider",
    payoutEligible: blockers.length === 0,
    blockers,
    status: profile?.accountStatus || (profile?.isActive ? "ACTIVE" : "AWAITING_ACTIVATION"),
    kyiStatus: profile?.kyiStatus || null,
    kyiVerifiedAt: profile?.kyiVerifiedAt || null,
    kyiRejectedReason: profile?.kyiRejectedReason || null,
    isActive: profile?.isActive ?? null,
    message:
      blockers.length === 0
        ? "Rider payout readiness is clear."
        : "Rider payouts should remain on hold until KYI and activation readiness are complete.",
  };
}

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);

  try {
    requireRole(who, ["admin", "admin_staff", "rider"]);
    const orgId = orgIdFromHeaders(req.headers);
    const riderUserId = who.role === "admin" || who.role === "admin_staff"
      ? String(req.nextUrl.searchParams.get("riderUserId") || "").trim()
      : String(who.uid || "").trim();

    if (!riderUserId) return json({ ok: false, error: "riderUserId_required", items: [] }, 400);

    const db: any = prisma;
    const lines = await db.carePortSettlementLine?.findMany?.({
      where: { orgId, recipientType: "RIDER", recipientId: riderUserId },
      include: { batch: true },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
    }).catch(() => []);

    const fallbackPayouts = !lines?.length
      ? await db.payout?.findMany?.({
          where: { role: "rider", entityId: riderUserId },
          orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }],
          take: 100,
        }).catch(() => [])
      : [];

    const items = lines?.length ? lines.map(normalizeLine) : (fallbackPayouts || []);

    const profile = await db.carePortRiderProfile?.findFirst?.({ where: { userId: riderUserId } }).catch(() => null);
    const readiness = carePortRiderPayoutReadiness(profile);
    const trips = await prisma.carePortRiderAssignment.findMany({
      where: { riderUserId },
      include: { order: true, pharmacy: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });

    const pendingCents = (items || [])
      .filter((x: any) => String(x.status).toLowerCase() === "pending")
      .reduce((s: number, x: any) => s + Number(x.amountCents || x.netPayableMinor || 0), 0);

    const paidCents = (items || [])
      .filter((x: any) => String(x.status).toLowerCase() === "paid")
      .reduce((s: number, x: any) => s + Number(x.amountCents || x.netPayableMinor || 0), 0);

    return json({
      ok: true,
      riderUserId,
      source: lines?.length ? "careport_settlement_lines" : "legacy_payouts_or_empty",
      items,
      trips,
      account: {
        status: profile?.accountStatus || (profile?.isActive ? "ACTIVE" : "AWAITING_ACTIVATION"),
        kyiStatus: profile?.kyiStatus || null,
        isActive: profile?.isActive ?? null,
        isOnJob: profile?.isOnJob ?? null,
        payoutCycle: profile?.payoutCycle || null,
        lastPayoutAt: profile?.lastPayoutAt || null,
      },
      summary: {
        payoutCount: items?.length || 0,
        pendingCents,
        paidCents,
        tripCount: trips.length,
      },
    });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "rider_payouts_load_failed", items: [] }, e?.status || 500);
  }
}
