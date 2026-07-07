// apps/api-gateway/app/api/analytics/clinicians/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getViewerPlanTier } from "@/lib/planTier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RangeKey = "30d" | "90d" | "12m";

function normaliseRange(value: string | null): RangeKey {
  if (value === "30d" || value === "90d" || value === "12m") return value;
  return "90d";
}

function sinceForRange(range: RangeKey) {
  const days = range === "30d" ? 30 : range === "90d" ? 90 : 365;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
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

function monthBucket(value: Date) {
  return value.getFullYear() + "-" + String(value.getMonth() + 1).padStart(2, "0");
}

async function loadEncounters(clinicianId: string | null, since: Date) {
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

async function loadRatings(clinicianId: string | null) {
  if (!clinicianId) return { average: null, count: 0 };

  const db = prisma as any;

  for (const model of ["clinicianRating", "review", "rating"]) {
    try {
      if (!db[model]?.findMany) continue;
      const rows = await db[model].findMany({
        where: { clinicianId },
        take: 500,
      });

      const values = rows
        .map((row: any) => Number(row?.rating ?? row?.score ?? row?.stars))
        .filter((value: number) => Number.isFinite(value));

      if (!values.length) return { average: null, count: rows.length };

      return {
        average: values.reduce((sum: number, value: number) => sum + value, 0) / values.length,
        count: values.length,
      };
    } catch {
      continue;
    }
  }

  return { average: null, count: 0 };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const range = normaliseRange(url.searchParams.get("range"));

  try {
    const viewer = await getViewerPlanTier(req);
    const viewerAny = viewer as any;
    const clinicianId =
      typeof viewer?.clinicianId === "string" && viewer.clinicianId.trim()
        ? viewer.clinicianId
        : null;

    const encounters = await loadEncounters(clinicianId, sinceForRange(range));
    const ratings = await loadRatings(clinicianId);

    let totalTelevisits = 0;
    let totalInPerson = 0;

    for (const encounter of encounters) {
      const modality = String(encounter?.modality || encounter?.kind || encounter?.type || "").toLowerCase();
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

    const timeSeriesMap = new Map<string, number>();

    for (const encounter of encounters) {
      const date = dateValue(encounter?.createdAt || encounter?.startedAt);
      if (!date) continue;
      const bucket = monthBucket(date);
      timeSeriesMap.set(bucket, (timeSeriesMap.get(bucket) || 0) + 1);
    }

    const totalSessions = encounters.length;
    const totalPatients = patientIds.size;

    return NextResponse.json(
      {
        ok: true,
        clinicianId,
        name: viewerAny?.clinicianName || viewerAny?.name || "Clinician",
        planTier: viewer?.planTier || "basic",
        practiceId: viewer?.practiceId || null,
        practiceName: viewer?.practiceName || null,
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
          totalConsultationMinutes,
        },
        lifecycleSummary: {
          totalCompletedSessions: totalSessions,
          totalConsultationMinutes,
          totalEarningsCents: null,
          avgMonthlyEarningsCents: null,
          totalPayThisMonthCents: null,
        },
        badgeCounters: {
          topRated: ratings.average != null && ratings.average >= 4.7 && ratings.count >= 5,
          avgRating: ratings.average,
          ratingsCount: ratings.count,
          suspendedCount: 0,
          disciplinaryCount: 0,
          inactiveCount: 0,
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
    console.error("[analytics/clinicians/me] GET error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to load clinician analytics" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
