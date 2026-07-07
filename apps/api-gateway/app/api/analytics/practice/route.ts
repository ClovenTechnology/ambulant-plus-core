// apps/api-gateway/app/api/analytics/practice/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getViewerPlanTier } from "@/lib/planTier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RangeKey = "30d" | "90d" | "12m";
type PlanTier = "free" | "basic" | "pro" | "host";
type TeamRoleKey = "clinician" | "admin_medical" | "admin_non_medical" | "nurse" | "assistant" | "other";

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    { ok: false, error: message },
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

function roleKey(member: any): TeamRoleKey {
  const role = roleRaw(member);
  if (role.includes("nurse")) return "nurse";
  if (role.includes("assistant")) return "assistant";
  if (role.includes("clinician") || role.includes("doctor") || role.includes("clinical_lead")) return "clinician";
  if (role.includes("medical_admin") || role.includes("clinical_admin")) return "admin_medical";
  if (role.includes("admin") || role.includes("manager") || role.includes("billing") || role.includes("support")) {
    return "admin_non_medical";
  }
  return "other";
}

function roleLabel(key: TeamRoleKey) {
  if (key === "clinician") return "Clinicians";
  if (key === "nurse") return "Nurses";
  if (key === "assistant") return "Assistants";
  if (key === "admin_medical") return "Medical admin";
  if (key === "admin_non_medical") return "Non-medical admin";
  return "Other";
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

function memberIdOf(member: any) {
  return String(member?.clinicianId || member?.id || member?.userId || "");
}

function isActive(member: any) {
  const status = String(member?.status || "active").toLowerCase();
  return !["inactive", "disabled", "suspended", "removed", "archived"].includes(status);
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

async function loadPracticeMembers(practiceId: string) {
  const db = prisma as any;
  try {
    return await db.practiceMember.findMany({
      where: { practiceId },
      orderBy: { createdAt: "asc" },
    });
  } catch {
    return await db.practiceMember.findMany({ where: { practiceId } });
  }
}

async function loadEncounters(clinicianIds: string[], since: Date) {
  if (!clinicianIds.length) return [];

  const db = prisma as any;
  try {
    return await db.encounter.findMany({
      where: {
        clinicianId: { in: clinicianIds },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: 2000,
    });
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const range = normaliseRange(url.searchParams.get("range"));

  try {
    const viewer = await getViewerPlanTier(req);
    const practiceId = String(viewer?.practiceId || "").trim();

    if (!practiceId) return jsonError("No practice found for this user", 404);

    const members = await loadPracticeMembers(practiceId);
    const clinicianIds = members
      .map((member: any) => member?.clinicianId)
      .filter((value: unknown): value is string => typeof value === "string" && value.length > 0);

    const encounters = await loadEncounters(clinicianIds, sinceForRange(range));
    const sessionsByClinician = new Map<string, any[]>();

    for (const encounter of encounters) {
      const clinicianId = String(encounter?.clinicianId || "");
      if (!clinicianId) continue;
      const existing = sessionsByClinician.get(clinicianId) || [];
      existing.push(encounter);
      sessionsByClinician.set(clinicianId, existing);
    }

    const totalSessionsRange = encounters.length;
    const totalConsultationMinutesRange = encounters.reduce(
      (sum: number, encounter: any) => sum + durationMinutes(encounter),
      0,
    );

    const patientIds = new Set(
      encounters
        .map((encounter: any) => encounter?.patientId || encounter?.patient?.id)
        .filter(Boolean)
        .map(String),
    );

    const roleMap = new Map<TeamRoleKey, { role: TeamRoleKey; label: string; headcount: number; active: number; sessions: number; sharePct: number }>();

    for (const member of members) {
      const key = roleKey(member);
      const current =
        roleMap.get(key) ||
        {
          role: key,
          label: roleLabel(key),
          headcount: 0,
          active: 0,
          sessions: 0,
          sharePct: 0,
        };

      current.headcount += 1;
      if (isActive(member)) current.active += 1;

      const clinicianId = String(member?.clinicianId || "");
      current.sessions += clinicianId ? (sessionsByClinician.get(clinicianId) || []).length : 0;

      roleMap.set(key, current);
    }

    const roleBreakdown = Array.from(roleMap.values()).map((row) => ({
      ...row,
      sharePct: totalSessionsRange ? (row.sessions / totalSessionsRange) * 100 : 0,
    }));

    const clinicianMembers = members.filter((member: any) => roleKey(member) === "clinician");
    const activeClinicians = clinicianMembers.filter(isActive).length;

    const teamMembers = members.map((member: any) => {
      const key = roleKey(member);
      const clinicianId = String(member?.clinicianId || "");
      const memberEncounters = clinicianId ? sessionsByClinician.get(clinicianId) || [] : [];

      return {
        memberId: memberIdOf(member),
        name: memberName(member),
        roleLabel: roleLabel(key).replace(/s$/, ""),
        classLabel: member?.classLabel || member?.clinicianClass || null,
        planTier: planTierOf(member?.planTier || viewer?.planTier),
        sessions: memberEncounters.length,
        consultationMinutes: memberEncounters.reduce(
          (sum: number, encounter: any) => sum + durationMinutes(encounter),
          0,
        ),
        onTimeJoinRatePct: 0,
        overrunRatePct: 0,
        avgRating:
          typeof member?.avgRating === "number"
            ? member.avgRating
            : typeof member?.rating === "number"
              ? member.rating
              : null,
        lastActiveAt:
          dateValue(member?.lastActiveAt || member?.updatedAt || member?.createdAt)?.toISOString() || null,
        isClinician: key === "clinician",
      };
    });

    return NextResponse.json(
      {
        planTier: planTierOf(viewer?.planTier),
        practiceName: viewer?.practiceName || "Practice",
        practiceId,
        kpis: {
          totalStaff: members.length,
          clinicians: clinicianMembers.length,
          activeClinicians,
          adminStaff: roleBreakdown
            .filter((row) => row.role === "admin_medical" || row.role === "admin_non_medical")
            .reduce((sum, row) => sum + row.headcount, 0),
          nurses: roleBreakdown
            .filter((row) => row.role === "nurse")
            .reduce((sum, row) => sum + row.headcount, 0),
          totalSessionsRange,
          totalConsultationMinutesRange,
          totalPatientsRange: patientIds.size,
          avgClinicianOnTimeJoinRatePct: 0,
          avgOverrunRatePct: 0,
        },
        roleBreakdown,
        punctualityBucketsClinician: [
          { label: "On time", sessions: 0, sharePct: 0 },
          { label: "Late", sessions: 0, sharePct: 0 },
        ],
        overrunBuckets: [
          { label: "On time / early", sessions: 0, sharePct: 0 },
          { label: "Overrun", sessions: 0, sharePct: 0 },
        ],
        members: teamMembers,
        _range: range,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err: any) {
    console.error("[analytics/practice] GET error", err);
    return jsonError(err?.message || "Failed to load practice analytics", 500);
  }
}
