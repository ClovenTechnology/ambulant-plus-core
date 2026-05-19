import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseIntSafe(value: string | null, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function average(nums: number[]) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function computeLateScore(delayMinutes: number, source: "verified" | "self_reported") {
  const d = Math.max(0, delayMinutes);

  if (source === "verified") {
    if (d <= 30) return 0.95;
    if (d <= 60) return 0.9;
    if (d <= 120) return 0.8;
    if (d <= 240) return 0.7;
    if (d <= 480) return 0.6;
    return 0.5;
  }

  if (d <= 30) return 0.7;
  if (d <= 60) return 0.65;
  if (d <= 120) return 0.55;
  if (d <= 240) return 0.45;
  if (d <= 480) return 0.4;
  return 0.35;
}

function classifyReminder(rem: any) {
  const status = String(rem?.status ?? "Pending");
  const scheduledFor = asDate(rem?.scheduledFor ?? rem?.meta?.scheduledFor ?? null);
  const takenAt =
    asDate(rem?.takenAt) ??
    asDate(rem?.verifiedAt) ??
    asDate(rem?.reportedTakenAt) ??
    null;

  const verificationStatus = String(rem?.verificationStatus ?? "");
  const takenSource = String(rem?.takenSource ?? "");

  if (status === "Missed") {
    return {
      kind: "MISSED",
      adherenceScore: 0,
      confidenceScore: 0,
      delayMinutes: null as number | null,
      late: false,
    };
  }

  if (status !== "Taken") {
    return {
      kind: "PENDING",
      adherenceScore: null as number | null,
      confidenceScore: null as number | null,
      delayMinutes: null as number | null,
      late: false,
    };
  }

  const delayMinutes =
    scheduledFor && takenAt
      ? Math.max(0, Math.round((takenAt.getTime() - scheduledFor.getTime()) / 60000))
      : 0;

  const isVerified =
    verificationStatus === "VERIFIED" || takenSource === "CAMERA_VERIFIED";

  const isSelfReported =
    verificationStatus === "SELF_REPORTED" ||
    takenSource === "SELF_REPORTED" ||
    takenSource === "MANUAL_CLINICIAN";

  if (isVerified) {
    if (delayMinutes <= 15) {
      return {
        kind: "VERIFIED_ON_TIME",
        adherenceScore: 1,
        confidenceScore: 1,
        delayMinutes,
        late: false,
      };
    }

    const score = computeLateScore(delayMinutes, "verified");
    return {
      kind: "VERIFIED_LATE",
      adherenceScore: score,
      confidenceScore: score,
      delayMinutes,
      late: true,
    };
  }

  if (isSelfReported) {
    if (delayMinutes <= 15) {
      return {
        kind: "SELF_REPORTED_ON_TIME",
        adherenceScore: 0.75,
        confidenceScore: 0.75,
        delayMinutes,
        late: false,
      };
    }

    const score = computeLateScore(delayMinutes, "self_reported");
    return {
      kind: "SELF_REPORTED_LATE",
      adherenceScore: score,
      confidenceScore: score,
      delayMinutes,
      late: true,
    };
  }

  return {
    kind: "TAKEN_UNCLASSIFIED",
    adherenceScore: 0.6,
    confidenceScore: 0.6,
    delayMinutes,
    late: delayMinutes > 15,
  };
}

async function buildMemberAdherence(args: {
  patientId: string;
  days: number;
}) {
  const now = new Date();
  const start = startOfDay(new Date(now.getTime() - (args.days - 1) * 24 * 60 * 60 * 1000));
  const end = endOfDay(now);

  const [sharingPreference, medications, reminders] = await Promise.all([
    prisma.patientDataSharingPreference.findUnique({
      where: { patientId: args.patientId },
    }).catch(() => null),

    prisma.medication.findMany({
      where: { patientId: args.patientId },
      orderBy: { createdAt: "desc" },
    }),

    prisma.reminder.findMany({
      where: {
        patientId: args.patientId,
        source: "medication",
        OR: [
          { scheduledFor: { gte: start, lte: end } },
          { createdAt: { gte: start, lte: end } },
        ],
      },
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const sharingEnabled = Boolean(
    sharingPreference?.allowMedicalAidAdherenceAccess ||
      sharingPreference?.allowCorporateSponsorAdherenceAccess ||
      sharingPreference?.allowRewardProgramAccess
  );

  const activeMeds = medications.filter((m) => String(m.status) === "Active");
  const reminderMedIds = new Set(reminders.map((r) => r.medicationId).filter(Boolean));
  const uncoveredMedicationCount = activeMeds.filter((m) => !reminderMedIds.has(m.id)).length;

  let verifiedTaken = 0;
  let selfReportedTaken = 0;
  let missed = 0;
  let pending = 0;
  let lateCount = 0;

  const adherenceScores: number[] = [];
  const confidenceScores: number[] = [];
  const dailyMap = new Map<
    string,
    {
      date: string;
      weightedNumerator: number;
      confidenceNumerator: number;
      denominator: number;
      missed: number;
      pending: number;
    }
  >();

  for (const rem of reminders) {
    const cls = classifyReminder(rem);
    const dayDate = asDate(rem.scheduledFor ?? rem.createdAt) ?? now;
    const dayKey = toYmd(dayDate);

    if (!dailyMap.has(dayKey)) {
      dailyMap.set(dayKey, {
        date: dayKey,
        weightedNumerator: 0,
        confidenceNumerator: 0,
        denominator: 0,
        missed: 0,
        pending: 0,
      });
    }
    const dayAgg = dailyMap.get(dayKey)!;

    if (cls.kind === "PENDING") {
      pending += 1;
      dayAgg.pending += 1;
      continue;
    }

    dayAgg.denominator += 1;

    if (cls.kind === "MISSED") {
      missed += 1;
      dayAgg.missed += 1;
      continue;
    }

    if (String(rem.verificationStatus) === "VERIFIED" || String(rem.takenSource) === "CAMERA_VERIFIED") {
      verifiedTaken += 1;
    } else {
      selfReportedTaken += 1;
    }

    if (cls.late) {
      lateCount += 1;
    }

    adherenceScores.push(cls.adherenceScore ?? 0);
    confidenceScores.push(cls.confidenceScore ?? 0);

    dayAgg.weightedNumerator += cls.adherenceScore ?? 0;
    dayAgg.confidenceNumerator += cls.confidenceScore ?? 0;
  }

  const totalTracked = verifiedTaken + selfReportedTaken + missed;
  const weightedPct = totalTracked > 0 ? Math.round(average(adherenceScores) * 100) : 100;
  const confidencePct = totalTracked > 0 ? Math.round(average(confidenceScores) * 100) : 100;
  const verifiedRatio = totalTracked > 0 ? Math.round((verifiedTaken / totalTracked) * 100) : 0;
  const missedDoseRate = totalTracked > 0 ? Math.round((missed / totalTracked) * 100) : 0;
  const lateDoseRate =
    verifiedTaken + selfReportedTaken > 0
      ? Math.round((lateCount / (verifiedTaken + selfReportedTaken)) * 100)
      : 0;

  const reminderCoveragePct =
    activeMeds.length > 0
      ? Math.round(((activeMeds.length - uncoveredMedicationCount) / activeMeds.length) * 100)
      : 100;

  const riskStatus =
    missedDoseRate >= 25 || weightedPct < 60
      ? "high"
      : missedDoseRate >= 10 || weightedPct < 80
      ? "moderate"
      : "low";

  const rewardEligible =
    weightedPct >= 80 && confidencePct >= 70 && missedDoseRate <= 10;

  const rewardPointsEstimate = Math.max(
    0,
    verifiedTaken * 3 + selfReportedTaken * 1 - missed * 2
  );

  const dailyTrend = Array.from(dailyMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      date: d.date,
      weightedPct:
        d.denominator > 0 ? Math.round((d.weightedNumerator / d.denominator) * 100) : 100,
      confidencePct:
        d.denominator > 0 ? Math.round((d.confidenceNumerator / d.denominator) * 100) : 100,
      missed: d.missed,
      pending: d.pending,
    }));

  return {
    sharingEnabled,
    summary: {
      weightedPct,
      confidencePct,
      verifiedRatio,
      missedDoseRate,
      lateDoseRate,
      trackedDoseCount: totalTracked,
      verifiedTaken,
      selfReportedTaken,
      missed,
      pending,
      activeMedicationCount: activeMeds.length,
      uncoveredMedicationCount,
      reminderCoveragePct,
    },
    riskStatus,
    rewardEligible,
    rewardPointsEstimate,
    dailyTrend,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId") ?? "org-default";
    const days = parseIntSafe(searchParams.get("days"), 30);
    const memberStatus = searchParams.get("memberStatus") ?? undefined;

    const members = await prisma.clientMember.findMany({
      where: {
        orgId,
        ...(memberStatus ? { memberStatus: memberStatus as never } : {}),
      },
      include: {
        coveragePlan: true,
        clientProgram: true,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 500,
    });

    const activeMembers = members.filter((m) =>
      ["ACTIVE", "APPROVED", "ENROLLED"].includes(String(m.memberStatus ?? "").toUpperCase())
    );

    const enriched = await Promise.all(
      members.map(async (member) => {
        if (!member.patientId) {
          return {
            memberId: member.id,
            patientId: null,
            memberNumber: member.memberNumber ?? member.employeeNumber ?? member.id,
            memberStatus: member.memberStatus,
            memberKind: member.memberKind,
            coveragePlan: member.coveragePlan
              ? { id: member.coveragePlan.id, name: member.coveragePlan.name }
              : null,
            adherence: null,
          };
        }

        const adherence = await buildMemberAdherence({
          patientId: member.patientId,
          days,
        });

        return {
          memberId: member.id,
          patientId: member.patientId,
          memberNumber: member.memberNumber ?? member.employeeNumber ?? member.id,
          memberStatus: member.memberStatus,
          memberKind: member.memberKind,
          employeeNumber: member.employeeNumber ?? null,
          dependentCode: member.dependentCode ?? null,
          principalMemberNumber: member.principalMemberNumber ?? null,
          effectiveFrom: member.effectiveFrom ?? null,
          effectiveTo: member.effectiveTo ?? null,
          coveragePlan: member.coveragePlan
            ? { id: member.coveragePlan.id, name: member.coveragePlan.name }
            : null,
          clientProgram: member.clientProgram
            ? { id: member.clientProgram.id, name: member.clientProgram.name }
            : null,
          adherence,
        };
      })
    );

    const sharedMembers = enriched.filter((m) => m.adherence?.sharingEnabled);
    const trackedMembers = sharedMembers.filter((m) => m.adherence?.summary);

    const avgWeightedAdherence =
      trackedMembers.length > 0
        ? Math.round(
            average(
              trackedMembers.map((m) => m.adherence?.summary?.weightedPct ?? 0)
            )
          )
        : 0;

    const avgConfidence =
      trackedMembers.length > 0
        ? Math.round(
            average(
              trackedMembers.map((m) => m.adherence?.summary?.confidencePct ?? 0)
            )
          )
        : 0;

    const avgReminderCoverage =
      trackedMembers.length > 0
        ? Math.round(
            average(
              trackedMembers.map((m) => m.adherence?.summary?.reminderCoveragePct ?? 0)
            )
          )
        : 0;

    const highRiskMembers = trackedMembers.filter((m) => m.adherence?.riskStatus === "high");
    const moderateRiskMembers = trackedMembers.filter((m) => m.adherence?.riskStatus === "moderate");
    const rewardEligibleMembers = trackedMembers.filter((m) => m.adherence?.rewardEligible);

    const trendMap = new Map<
      string,
      { date: string; weightedValues: number[]; confidenceValues: number[] }
    >();

    for (const member of trackedMembers) {
      for (const point of member.adherence?.dailyTrend ?? []) {
        if (!trendMap.has(point.date)) {
          trendMap.set(point.date, {
            date: point.date,
            weightedValues: [],
            confidenceValues: [],
          });
        }
        const bucket = trendMap.get(point.date)!;
        bucket.weightedValues.push(point.weightedPct);
        bucket.confidenceValues.push(point.confidencePct);
      }
    }

    const dailyTrend = Array.from(trendMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        date: d.date,
        weightedPct: Math.round(average(d.weightedValues)),
        confidencePct: Math.round(average(d.confidenceValues)),
      }));

    const topInterventionMembers = trackedMembers
      .filter((m) => m.adherence?.riskStatus === "high" || m.adherence?.riskStatus === "moderate")
      .sort((a, b) => {
        const aScore = a.adherence?.summary?.weightedPct ?? 100;
        const bScore = b.adherence?.summary?.weightedPct ?? 100;
        return aScore - bScore;
      })
      .slice(0, 10);

    const topRewardMembers = trackedMembers
      .filter((m) => m.adherence?.rewardEligible)
      .sort((a, b) => {
        const aScore = a.adherence?.rewardPointsEstimate ?? 0;
        const bScore = b.adherence?.rewardPointsEstimate ?? 0;
        return bScore - aScore;
      })
      .slice(0, 10);

    return NextResponse.json({
      ok: true,
      orgId,
      period: { days },
      summary: {
        memberCount: members.length,
        activeMemberCount: activeMembers.length,
        sharingEnabledMemberCount: sharedMembers.length,
        trackedMemberCount: trackedMembers.length,
        avgWeightedAdherence,
        avgConfidence,
        avgReminderCoverage,
        highRiskCount: highRiskMembers.length,
        moderateRiskCount: moderateRiskMembers.length,
        rewardEligibleCount: rewardEligibleMembers.length,
      },
      dailyTrend,
      topInterventionMembers,
      topRewardMembers,
      members: enriched,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build adherence overview.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}