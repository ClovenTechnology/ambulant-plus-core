// apps/api-gateway/app/api/practice/payouts/summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    { ok: false, error: message },
    { status, headers: { "cache-control": "no-store" } },
  );
}

function uidFrom(req: NextRequest) {
  return (
    req.headers.get("x-uid") ||
    req.cookies.get("ambulant_uid")?.value ||
    req.cookies.get("user_id")?.value ||
    ""
  ).trim();
}

async function getPracticeContext(uid: string) {
  const db = prisma as any;
  const member = await db.practiceMember.findFirst({
    where: { userId: uid },
    include: { practice: true },
  });

  if (!member?.practice) return null;

  return {
    practiceId: String(member.practiceId),
    practice: member.practice,
  };
}

function centsFrom(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.round(parsed);
  }
  return 0;
}

function pctFrom(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  if (value > 1) return value / 100;
  if (value < 0) return 0;
  return value;
}

function clinicianIdFromPayment(payment: any) {
  return (
    payment?.encounter?.clinicianId ||
    payment?.clinicianId ||
    payment?.providerId ||
    null
  );
}

function amountCentsFromPayment(payment: any) {
  return (
    centsFrom(payment?.amountCents) ||
    centsFrom(payment?.grossAmountCents) ||
    centsFrom(payment?.totalCents) ||
    centsFrom(payment?.amount)
  );
}

async function loadMembers(practiceId: string) {
  const db = prisma as any;

  return db.practiceMember.findMany({
    where: { practiceId },
    select: {
      id: true,
      clinicianId: true,
      fullName: true,
      name: true,
      email: true,
      role: true,
      virtualSharePctToPractice: true,
      inPersonSharePctToPractice: true,
      facilityFeeFixedZarPerInPersonVisit: true,
    },
  });
}

async function loadRecentPayments(clinicianIds: string[]) {
  if (clinicianIds.length === 0) return [];

  const db = prisma as any;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  try {
    return await db.payment.findMany({
      where: {
        createdAt: { gte: since },
        encounter: {
          clinicianId: { in: clinicianIds },
        },
      },
      include: {
        encounter: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
  } catch {
    return [];
  }
}

async function loadLastPayout(practiceId: string) {
  const db = prisma as any;

  try {
    return await db.payout.findFirst({
      where: { practiceId },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const uid = uidFrom(req);
    if (!uid) return jsonError("Missing user identity", 401);

    const ctx = await getPracticeContext(uid);
    if (!ctx) return jsonError("No practice found for this user", 404);

    const members = await loadMembers(ctx.practiceId);
    const clinicianIds = members
      .map((member: any) => member.clinicianId)
      .filter((value: unknown): value is string => typeof value === "string" && value.length > 0);

    const payments = await loadRecentPayments(clinicianIds);
    const lastPayout = await loadLastPayout(ctx.practiceId);

    const grossByClinician = new Map<string, number>();
    let gross = 0;

    for (const payment of payments) {
      const amount = amountCentsFromPayment(payment);
      if (amount <= 0) continue;

      const clinicianId = clinicianIdFromPayment(payment);
      gross += amount;

      if (clinicianId) {
        grossByClinician.set(clinicianId, (grossByClinician.get(clinicianId) || 0) + amount);
      }
    }

    const memberSplits = members
      .filter((member: any) => member.clinicianId)
      .map((member: any) => {
        const clinicianId = String(member.clinicianId);
        const memberGross = grossByClinician.get(clinicianId) || 0;
        const virtualSharePctToPractice = pctFrom(member.virtualSharePctToPractice);
        const inPersonSharePctToPractice = pctFrom(member.inPersonSharePctToPractice);
        const assumedShare = virtualSharePctToPractice || inPersonSharePctToPractice || 0;
        const last30dNetToPracticeCents = Math.round(memberGross * assumedShare);

        return {
          clinicianId,
          clinicianName: member.fullName || member.name || member.email || "Practice clinician",
          virtualSharePctToPractice,
          inPersonSharePctToPractice,
          facilityFeeFixedZarPerInPersonVisit:
            typeof member.facilityFeeFixedZarPerInPersonVisit === "number"
              ? member.facilityFeeFixedZarPerInPersonVisit
              : null,
          last30dNetToPracticeCents,
        };
      });

    const last30dNetToPracticeCents = memberSplits.reduce(
      (sum: number, row: any) => sum + centsFrom(row.last30dNetToPracticeCents),
      0,
    );

    const last30dNetToCliniciansCents = Math.max(0, gross - last30dNetToPracticeCents);

    return NextResponse.json(
      {
        ok: true,
        currency: ctx.practice?.currency || "ZAR",
        practiceName: ctx.practice?.name || ctx.practice?.practiceName || "Practice",
        practiceBankLast4:
          ctx.practice?.bankLast4 ||
          ctx.practice?.bankAccountLast4 ||
          ctx.practice?.payoutBankLast4 ||
          null,
        lastPayoutAmountCents: lastPayout ? amountCentsFromPayment(lastPayout) : null,
        lastPayoutAt:
          lastPayout?.paidAt instanceof Date
            ? lastPayout.paidAt.toISOString()
            : lastPayout?.createdAt instanceof Date
              ? lastPayout.createdAt.toISOString()
              : null,
        nextPayoutAmountCents: null,
        nextPayoutAt: null,
        last30dGrossCents: gross,
        last30dNetToPracticeCents,
        last30dNetToCliniciansCents,
        memberSplits,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err: any) {
    console.error("[practice/payouts/summary] GET error", err);
    return jsonError(err?.message || "Failed to load practice payout summary", 500);
  }
}
