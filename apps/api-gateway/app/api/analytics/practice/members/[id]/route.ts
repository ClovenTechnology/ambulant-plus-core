// apps/api-gateway/app/api/analytics/practice/members/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getViewerPlanTier } from "@/lib/planTier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RangeKey = "30d" | "90d" | "12m";
type PlanTier = "free" | "basic" | "pro" | "host";

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "cache-control": "no-store" } },
  );
}

function normaliseRange(value: string | null): RangeKey {
  if (value === "30d" || value === "90d" || value === "12m") return value;
  return "90d";
}

function sinceForRange(range: RangeKey) {
  const days = range === "30d" ? 30 : range === "90d" ? 90 : 365;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function planTierOf(value: unknown): PlanTier {
  const raw = String(value || "basic").toLowerCase();
  if (raw === "host" || raw === "pro" || raw === "free") return raw;
  return "basic";
}

function roleRaw(member: any) {
  return String(member?.role || member?.membershipRole || member?.memberRole || "").toLowerCase();
}

function isClinician(member: any) {
  const role = roleRaw(member);
  return role.includes("clinician") || role.includes("doctor") || role.includes("clinical_lead");
}

function roleLabel(member: any) {
  const role = roleRaw(member);
  if (role.includes("nurse")) return "Nurse";
  if (role.includes("assistant")) return "Assistant";
  if (role.includes("admin")) return "Admin";
  if (isClinician(member)) return "Clinician";
  return member?.role || "Practice member";
}

function memberName(member: any) {
  return (
    member?.fullName ||
    member?.name ||
    member?.displayName ||
    member?.email ||
    member?.clinicianName ||
    "Practice member"
  );
}

function dateValue(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function durationMinutes(encounter: any) {
  for (const key of ["durationMinutes", "durationMin", "consultationMinutes", "minutes"]) {
    const value = Number(encounter?.[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }

  const started = dateValue(encounter?.startedAt || encounter?.startTime || encounter?.createdAt);
  const ended = dateValue(encounter?.endedAt || encounter?.endTime || encounter?.completedAt);

  if (started && ended && ended.getTime() > started.getTime()) {
    return Math.round((ended.getTime() - started.getTime()) / 60000);
  }

  return 0;
}

function modalityOf(encounter: any) {
  return String(encounter?.modality || encounter?.kind || encounter?.type || "").toLowerCase();
}

function monthBucket(value: Date) {
  return value.getFullYear() + "-" + String(value.getMonth() + 1).padStart(2, "0");
}

async function loadPracticeMembers(practiceId: string) {
  const db = prisma as any;
  return db.practiceMember.findMany({ where: { practiceId } });
}

async function loadMemberEncounters(clinicianId: string | null, since: Date) {
  if (!clinicianId) return [];

  const db = prisma as any;
  try {
    return await db.encounter.findMany({
      where: {
        clinicianId,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "asc" },
      take: 2000,
    });
  } catch {
    return [];
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  const memberId = ctx.params?.id;
  const url = new URL(req.url);
  const range = normaliseRange(url.searchParams.get("range"));

  if (!memberId) return jsonError("Missing member id", 400);

  try {
    const viewer = await getViewerPlanTier(req);
    const practiceId = String(viewer?.practiceId || "").trim();

    if (!practiceId) return jsonError("No practice found for this user", 404);

    const members = await loadPracticeMembers(practiceId);
    const member = members.find((row: any) => {
      return (
        String(row?.id || "") === memberId ||
        String(row?.clinicianId || "") === memberId ||
        String(row?.userId || "") === memberId
      );
    });

    if (!member) return jsonError("Practice member not found", 404);

    const clinicianId = typeof member?.clinicianId === "string" ? member.clinicianId : null;
    const encounters = await loadMemberEncounters(clinicianId, sinceForRange(range));

    let totalTelevisits = 0;
    let totalInPerson = 0;

    for (const encounter of encounters) {
      const modality = modalityOf(encounter);
      if (modality.includes("person") || modality.includes("clinic")) totalInPerson += 1;
      else totalTelevisits += 1;
    }

    const patientIds = new Set(
      encounters
        .map((encounter: any) => encounter?.patientId || encounter?.patient?.id)
        .filter(Boolean)
        .map(String),
    );

    const totalConsultationMinutes = encounters.reduce(
      (sum: number, encounter: any) => sum + durationMinutes(encounter),
      0,
    );

    const workDays = new Set<string>(
      encounters
        .map((encounter: any) => dateValue(encounter?.createdAt || encounter?.startedAt))
        .filter((date: Date | null): date is Date => Boolean(date))
        .map((date: Date) => date.toISOString().slice(0, 10)),
    );

    const timeSeriesMap = new Map<string, number>();

    for (const encounter of encounters) {
      const date = dateValue(encounter?.createdAt || encounter?.startedAt);
      if (!date) continue;
      const bucket = monthBucket(date);
      timeSeriesMap.set(bucket, (timeSeriesMap.get(bucket) || 0) + 1);
    }

    const monthsInRange = range === "30d" ? 1 : range === "90d" ? 3 : 12;
    const totalSessions = encounters.length;
    const totalPatients = patientIds.size;

    return NextResponse.json(
      {
        viewerPlanTier: planTierOf(viewer?.planTier),
        practiceName: viewer?.practiceName || "Practice",
        memberId: String(member?.clinicianId || member?.id || memberId),
        name: memberName(member),
        roleLabel: roleLabel(member),
        isClinician: isClinician(member),
        classLabel: member?.classLabel || member?.clinicianClass || null,
        planTier: planTierOf(member?.planTier || viewer?.planTier),
        status: member?.status || null,
        kpis: {
          totalTelevisits,
          totalInPerson,
          totalPatients,
          newPatients: totalPatients,
          repeatRatePct:
            totalSessions > 0 && totalPatients > 0
              ? Math.max(0, ((totalSessions - totalPatients) / totalSessions) * 100)
              : 0,
          clinicianOnTimeJoinRatePct: 0,
          patientOnTimeJoinRatePct: 0,
          avgClinicianJoinDelayMin: 0,
          overrunRatePct: 0,
          avgOverrunMin: 0,
          cancellations: 0,
          noShows: 0,
        },
        lifecycleSummary: {
          starterKitShippedAt: member?.starterKitShippedAt || null,
          firstShiftAt: member?.firstShiftAt || null,
          firstConsultAt:
            dateValue(encounters[0]?.createdAt || encounters[0]?.startedAt)?.toISOString() || null,
          totalCompletedSessions: totalSessions,
          totalConsultationMinutes,
          totalEarningsCents: null,
          avgMonthlyEarningsCents: null,
          totalPayThisMonthCents: null,
          avgWorkDaysPerMonth: workDays.size / monthsInRange,
          avgWorkHoursPerMonth: totalConsultationMinutes / 60 / monthsInRange,
          avgWorkHoursPerDay: workDays.size ? totalConsultationMinutes / 60 / workDays.size : 0,
          totalWorkDaysInRange: workDays.size,
          totalWorkDaysThisMonth: Array.from(workDays).filter((day: string) =>
            day.startsWith(new Date().toISOString().slice(0, 7)),
          ).length,
          avgPatientsPerMonth: totalPatients / monthsInRange,
          totalPatientsThisMonth: totalPatients,
        },
        badgeCounters: {
          topRated: false,
          avgRating:
            typeof member?.avgRating === "number"
              ? member.avgRating
              : typeof member?.rating === "number"
                ? member.rating
                : null,
          ratingsCount:
            typeof member?.ratingsCount === "number"
              ? member.ratingsCount
              : null,
          suspendedCount: String(member?.status || "").toLowerCase() === "suspended" ? 1 : 0,
          disciplinaryCount: 0,
          inactiveCount: String(member?.status || "").toLowerCase() === "inactive" ? 1 : 0,
        },
        punctualityBucketsClinician: [
          { label: "On time", sessions: 0, sharePct: 0 },
          { label: "Late", sessions: 0, sharePct: 0 },
        ],
        punctualityBucketsPatient: [
          { label: "On time", sessions: 0, sharePct: 0 },
          { label: "Late", sessions: 0, sharePct: 0 },
        ],
        overrunBuckets: [
          { label: "On time / early", sessions: 0, sharePct: 0 },
          { label: "Overrun", sessions: 0, sharePct: 0 },
        ],
        timeSeries: Array.from(timeSeriesMap.entries()).map(([bucket, sessions]) => ({
          bucket,
          sessions,
          clinicianOnTimeJoinRatePct: 0,
          overrunRatePct: 0,
          revenueCents: null,
        })),
        _range: range,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err: any) {
    console.error("[analytics/practice/members/:id] GET error", err);
    return jsonError(err?.message || "Failed to load practice member analytics", 500);
  }
}
