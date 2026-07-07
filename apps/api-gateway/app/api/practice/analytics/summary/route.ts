// apps/api-gateway/app/api/practice/analytics/summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PlanTier = "host" | "pro" | "basic" | "free";

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

function planTierOf(practice: any): PlanTier {
  const raw = String(
    practice?.planTier ||
      practice?.tier ||
      practice?.subscriptionTier ||
      practice?.meta?.planTier ||
      "basic",
  ).toLowerCase();

  if (raw === "host" || raw === "pro" || raw === "free") return raw;
  return "basic";
}

function roleOf(member: any) {
  return String(member?.role || member?.membershipRole || "").toLowerCase();
}

async function loadMembers(practiceId: string) {
  const db = prisma as any;

  return db.practiceMember.findMany({
    where: { practiceId },
    select: {
      id: true,
      clinicianId: true,
      role: true,
      status: true,
    },
  });
}

async function countRecentSessions(clinicianIds: string[]) {
  if (clinicianIds.length === 0) return 0;

  const db = prisma as any;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  try {
    return await db.encounter.count({
      where: {
        clinicianId: { in: clinicianIds },
        createdAt: { gte: since },
      },
    });
  } catch {
    return 0;
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

    let totalClinicians = 0;
    let totalNurses = 0;
    let totalAdmin = 0;

    for (const member of members) {
      const role = roleOf(member);

      if (role.includes("nurse")) totalNurses += 1;
      else if (
        role.includes("admin") ||
        role.includes("manager") ||
        role.includes("billing") ||
        role.includes("accounting") ||
        role.includes("hr") ||
        role.includes("support")
      ) {
        totalAdmin += 1;
      } else if (role.includes("clinician") || role.includes("doctor") || role.includes("clinical_lead")) {
        totalClinicians += 1;
      }
    }

    const last30dSessions = await countRecentSessions(clinicianIds);

    return NextResponse.json(
      {
        ok: true,
        practiceName: ctx.practice?.name || ctx.practice?.practiceName || "Practice",
        planTier: planTierOf(ctx.practice),
        totalMembers: members.length,
        totalClinicians,
        totalNurses,
        totalAdmin,
        last30dSessions,
        avgPunctualityPct: 0,
        avgOverrunMinutes: 0,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err: any) {
    console.error("[practice/analytics/summary] GET error", err);
    return jsonError(err?.message || "Failed to load practice analytics", 500);
  }
}
