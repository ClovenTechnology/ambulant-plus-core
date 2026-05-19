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

function firstDefined<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return null;
}

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null) return fallback;
  return Boolean(value);
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function hasMetric(metrics: unknown, names: string[]) {
  if (!Array.isArray(metrics)) return false;
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  return metrics.some((metric) => wanted.has(String(metric).toLowerCase()));
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

  const interventionFlags = [
    missedDoseRate >= 25 ? "HIGH_MISSED_DOSE_RATE" : null,
    weightedPct < 60 ? "LOW_WEIGHTED_ADHERENCE" : null,
    confidencePct < 70 ? "LOW_CONFIDENCE_EVIDENCE" : null,
    uncoveredMedicationCount > 0 ? "UNCOVERED_ACTIVE_MEDICATIONS" : null,
    reminderCoveragePct < 70 ? "LOW_REMINDER_COVERAGE" : null,
  ].filter(Boolean) as string[];

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
    interventionFlags,
    dailyTrend,
  };
}

function extractBadges(member: any, adherence: any) {
  const metadata = member?.metadata || {};
  const badges: Array<{ code: string; label: string }> = [];

  if (member?.coveragePlan || metadata?.medicalAid || metadata?.medicalAidName) {
    badges.push({
      code: "MEDICAL_AID",
      label: `Medical Aid${member?.coveragePlan?.name ? ` · ${member.coveragePlan.name}` : metadata?.medicalAidName ? ` · ${metadata.medicalAidName}` : ""}`,
    });
  }

  if (metadata?.hospitalCover || metadata?.hospitalCoverName || metadata?.inHospitalBenefit) {
    badges.push({
      code: "HOSPITAL_COVER",
      label: `Hospital Cover${metadata?.hospitalCoverName ? ` · ${metadata.hospitalCoverName}` : ""}`,
    });
  }

  if (member?.clientProgram || metadata?.corporateSponsor || metadata?.sponsorName) {
    badges.push({
      code: "CORPORATE_SPONSOR",
      label: `Corporate Sponsor${member?.clientProgram?.name ? ` · ${member.clientProgram.name}` : metadata?.sponsorName ? ` · ${metadata.sponsorName}` : ""}`,
    });
  }

  const gym = metadata?.gymMembership || metadata?.wellnessMembership || null;
  if (gym?.active || gym?.name || gym?.membershipType) {
    badges.push({
      code: "GYM",
      label: `Gym / Wellness${gym?.name ? ` · ${gym.name}` : gym?.membershipType ? ` · ${gym.membershipType}` : ""}`,
    });
  }

  const iomt = metadata?.iomtSharing || metadata?.deviceSharing || null;
  if (iomt?.mode === "full") {
    badges.push({ code: "IOMT_FULL", label: "IoMT Sharing · Full" });
  } else if (iomt?.mode === "partial" || iomt?.devices || iomt?.metrics) {
    badges.push({ code: "IOMT_PARTIAL", label: "IoMT Sharing · Partial" });
  }

  if (adherence?.rewardEligible) {
    badges.push({ code: "REWARD_ELIGIBLE", label: "Reward Eligible" });
  }

  return badges;
}

async function safeFindMany(modelName: string, args: any) {
  const model = (prisma as any)[modelName];
  if (!model?.findMany) return [];
  return model.findMany(args).catch(() => []);
}

async function safeFindFirst(modelName: string, args: any) {
  const model = (prisma as any)[modelName];
  if (!model?.findFirst) return null;
  return model.findFirst(args).catch(() => null);
}

function summarizeAllergies(items: any[]) {
  return items.slice(0, 8).map((x) => ({
    id: x.id,
    substance: x.substanceText || x.substance || x.name || x.allergen || "Allergy",
    reaction: x.reactionText || x.reaction || null,
    severity: x.severity || null,
    status: x.status || null,
    recordedAt: x.recordedAt?.toISOString?.() || x.createdAt?.toISOString?.() || null,
  }));
}

function summarizeConditions(items: any[]) {
  return items.slice(0, 10).map((x) => ({
    id: x.id,
    name: x.name || x.condition || x.title || x.label || "Condition",
    status: x.status || null,
    icd10: x.icd10 || x.code || null,
    recordedAt: x.recordedAt?.toISOString?.() || x.createdAt?.toISOString?.() || null,
  }));
}

function summarizeVaccinations(items: any[]) {
  return items.slice(0, 10).map((x) => ({
    id: x.id,
    vaccine: x.vaccine || x.name || "Vaccination",
    date: x.date?.toISOString?.() || x.date || null,
    facility: x.facility || null,
    clinician: x.clinician || null,
    followupAt: x.followupAt?.toISOString?.() || x.followupAt || null,
  }));
}

function summarizeOperations(items: any[]) {
  return items.slice(0, 10).map((x) => ({
    id: x.id,
    title: x.title || x.procedure || "Operation / procedure",
    date: x.date?.toISOString?.() || x.date || null,
    facility: x.facility || null,
    surgeon: x.surgeon || null,
    clinicianCount: x.clinicianCount || null,
  }));
}

function summarizeVitals(items: any[]) {
  const latest = items[0] || null;

  return {
    latestClinicalSpotCheck: latest
      ? {
          bp: latest.bp || latest.bloodPressure || latest.bloodPressureText || null,
          hr: latest.hr || latest.heartRate || latest.pulse || null,
          spo2: latest.spo2 || latest.oxygenSaturation || null,
          temp: latest.temp || latest.temperature || null,
          respiratoryRate: latest.respiratoryRate || latest.rr || null,
          recordedAt: latest.recordedAt?.toISOString?.() || latest.createdAt?.toISOString?.() || null,
          source: latest.source || latest.deviceType || "clinical_spot_check",
        }
      : null,
    trendSummary: {
      count: items.length,
      window: "latest available readings",
    },
    abnormalFlags: items
      .slice(0, 20)
      .flatMap((x) => Array.isArray(x.abnormalFlags) ? x.abnormalFlags : [])
      .slice(0, 10),
    sourceCoverage: {
      clinicalSpotChecks: items.length,
      source: "Health Monitor / IoMT where available",
    },
  };
}

function summarizeWearable(items: any[]) {
  const latest = items[0] || null;

  return {
    sleepSummary: latest?.sleepSummary || latest?.sleepScore || latest?.sleep || null,
    activitySummary: latest?.activitySummary || latest?.steps || latest?.activity || null,
    rhrHrvSummary:
      latest?.rhrHrvSummary ||
      (latest ? { rhr: latest.rhr || latest.restingHeartRate || null, hrv: latest.hrv || null } : null),
    rewardSignals: items.length
      ? [
          latest?.steps ? `Steps ${latest.steps}` : null,
          latest?.sleepScore ? `Sleep score ${latest.sleepScore}` : null,
          latest?.activityMinutes ? `Activity ${latest.activityMinutes} min` : null,
        ].filter(Boolean)
      : [],
  };
}

async function buildRealHealthContext(patientId: string) {
  const [
    allergies,
    conditions,
    vaccinations,
    operations,
    vitals,
    wearable,
    ladyState,
    antenatalState,
  ] = await Promise.all([
    safeFindMany("allergy", { where: { patientId }, orderBy: { createdAt: "desc" }, take: 50 }),
    safeFindMany("condition", { where: { patientId }, orderBy: { createdAt: "desc" }, take: 50 }),
    safeFindMany("vaccination", { where: { patientId }, orderBy: { date: "desc" }, take: 50 }),
    safeFindMany("operation", { where: { patientId }, orderBy: { date: "desc" }, take: 50 }),

    safeFindMany("vitalReading", { where: { patientId }, orderBy: { createdAt: "desc" }, take: 100 }),
    safeFindMany("wearableReading", { where: { patientId }, orderBy: { createdAt: "desc" }, take: 100 }),

    safeFindFirst("ladyCenterState", { where: { patientId }, orderBy: { updatedAt: "desc" } }),
    safeFindFirst("antenatalState", { where: { patientId }, orderBy: { updatedAt: "desc" } }),
  ]);

  const vitalsSummary = summarizeVitals(vitals);
  const wearableSummary = summarizeWearable(wearable);

  return {
    vitals: vitalsSummary,
    wearable: wearableSummary,
    clinicalHistory: {
      allergies: summarizeAllergies(allergies),
      conditions: summarizeConditions(conditions),
      vaccinations: summarizeVaccinations(vaccinations),
      operations: summarizeOperations(operations),
    },
    reproductiveHealth: {
      visible: Boolean(ladyState),
      pregnancySignalAvailable: Boolean(ladyState?.pregnancyDetected || ladyState?.pregnancyConfidence),
      pregnancyDetected: Boolean(ladyState?.pregnancyDetected),
      confidence: ladyState?.pregnancyConfidence ?? null,
      lastUpdated: ladyState?.updatedAt?.toISOString?.() || null,
    },
    antenatal: {
      visible: Boolean(antenatalState),
      pregnancyActive: Boolean(antenatalState?.pregnancyActive),
      edd: antenatalState?.edd || antenatalState?.estimatedDueDate || null,
      gestationalAge: antenatalState?.gestationalAge || antenatalState?.gestationalAgeWeeks || null,
      trimester: antenatalState?.trimester || null,
      riskFlags: Array.isArray(antenatalState?.riskFlags) ? antenatalState.riskFlags : [],
      birthRecordAvailable: Boolean(antenatalState?.birthRecord || antenatalState?.birthRecordAvailable),
    },
  };
}

type Params = {
  params: {
    id: string;
  };
};

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId") ?? "org-default";
    const days = parseIntSafe(searchParams.get("days"), 30);

    const member = await prisma.clientMember.findFirst({
      where: {
        id: params.id,
        orgId,
      },
      include: {
        coveragePlan: {
          include: {
            serviceRules: true,
          },
        },
        clientProgram: true,
      },
    });

    if (!member) {
      return NextResponse.json(
        { ok: false, error: "Client member not found." },
        { status: 404 }
      );
    }

    const adherence =
      member.patientId
        ? await buildMemberAdherence({
            patientId: member.patientId,
            days,
          })
        : null;

    const authorizations = member.patientId
      ? await prisma.coverageAuthorization.findMany({
          where: {
            orgId,
            patientId: member.patientId,
          },
          orderBy: [{ requestedAt: "desc" }],
          take: 50,
        })
      : [];

    const nowMs = Date.now();

    const activeAuthorizations = authorizations.filter((x: any) => {
      const expiresAt = asDate(x.expiresAt);
      return !expiresAt || expiresAt.getTime() >= nowMs;
    });

    const claimLines = member.patientId
      ? await prisma.clientClaimLine.findMany({
          where: {
            billableEvent: {
              patientId: member.patientId,
            },
          },
          include: {
            claim: true,
            billableEvent: true,
          },
          orderBy: [{ createdAt: "desc" }],
          take: 200,
        }).catch(() => [])
      : [];

    const claimCount = new Set(
      claimLines.map((line: any) => line?.claimId).filter(Boolean)
    ).size;

    const submittedAmountMinor = claimLines.reduce(
      (sum: number, line: any) => sum + Number(line?.submittedAmountMinor || 0),
      0
    );
    const approvedAmountMinor = claimLines.reduce(
      (sum: number, line: any) => sum + Number(line?.approvedAmountMinor || 0),
      0
    );
    const paidAmountMinor = claimLines.reduce(
      (sum: number, line: any) => sum + Number(line?.paidAmountMinor || 0),
      0
    );

    const billableEvents = member.patientId
      ? await prisma.billableEvent.findMany({
          where: {
            patientId: member.patientId,
          },
          orderBy: [{ createdAt: "desc" }],
          take: 200,
        }).catch(() => [])
      : [];

    const metadata = (member.metadata || {}) as Record<string, any>;
    const iomt = (metadata.iomtSharing || metadata.deviceSharing || {}) as Record<string, any>;
    const gym = (metadata.gymMembership || metadata.wellnessMembership || {}) as Record<string, any>;
    const rewards = (metadata.rewardProfile || metadata.rewards || {}) as Record<string, any>;

    const sharingPreference = member.patientId
      ? ((await prisma.patientDataSharingPreference.findUnique({
          where: { patientId: member.patientId },
        }).catch(() => null)) as any | null)
      : null;

    const realHealthContext = member.patientId
      ? await buildRealHealthContext(member.patientId)
      : null;

    const health = (
      metadata.healthContext ||
      metadata.health ||
      metadata.healthProfile ||
      {}
    ) as Record<string, any>;

    const healthConsent = (
      health.consent ||
      metadata.healthConsent ||
      metadata.consent?.health ||
      metadata.dataSharing?.health ||
      {}
    ) as Record<string, any>;

    const healthVitals = (
      health.vitals ||
      metadata.vitals ||
      metadata.clinicalVitals ||
      {}
    ) as Record<string, any>;

    const wearableHealth = (
      health.wearable ||
      metadata.wearable ||
      metadata.wearableInsights ||
      {}
    ) as Record<string, any>;

    const clinicalHistory = (
      health.clinicalHistory ||
      metadata.clinicalHistory ||
      metadata.history ||
      {}
    ) as Record<string, any>;

    const reproductiveHealth = (
      health.reproductiveHealth ||
      metadata.reproductiveHealth ||
      {}
    ) as Record<string, any>;

    const antenatal = (
      health.antenatal ||
      metadata.antenatal ||
      metadata.maternity ||
      {}
    ) as Record<string, any>;

    const vitalMetricShared =
      iomt?.mode === "full" ||
      hasMetric(iomt?.metrics, [
        "vitals",
        "blood_pressure",
        "heart_rate",
        "spo2",
        "temperature",
        "respiratory_rate",
      ]);

    const wearableMetricShared =
      iomt?.mode === "full" ||
      hasMetric(iomt?.metrics, [
        "sleep",
        "activity",
        "steps",
        "heart_rate",
        "rhr",
        "hrv",
        "calories",
      ]);

    const healthContextConsent = {
      vitals: toBoolean(
        firstDefined(
          healthConsent?.vitals,
          healthConsent?.allowVitals,
          healthConsent?.allowVitalsAccess,
          healthConsent?.allowClinicalSpotChecks,
          sharingPreference?.allowVitalsAccess
        ),
        vitalMetricShared
      ),
      wearableInsights: toBoolean(
        firstDefined(
          healthConsent?.wearableInsights,
          healthConsent?.allowWearableInsights,
          healthConsent?.allowWearableInsightsAccess,
          sharingPreference?.allowWearableInsightsAccess
        ),
        wearableMetricShared
      ),
      clinicalHistory: toBoolean(
        firstDefined(
          healthConsent?.clinicalHistory,
          healthConsent?.allowClinicalHistory,
          healthConsent?.allowClinicalHistoryAccess,
          sharingPreference?.allowClinicalHistoryAccess
        )
      ),
      reproductiveHealth: toBoolean(
        firstDefined(
          healthConsent?.reproductiveHealth,
          healthConsent?.allowReproductiveHealth,
          healthConsent?.allowReproductiveHealthAccess,
          sharingPreference?.allowReproductiveHealthAccess
        )
      ),
      antenatal: toBoolean(
        firstDefined(
          healthConsent?.antenatal,
          healthConsent?.allowAntenatal,
          healthConsent?.allowAntenatalAccess,
          sharingPreference?.allowAntenatalAccess
        )
      ),
    };

    const latestAuth = activeAuthorizations[0] as any | undefined;
    const latestRuleSnapshot = (latestAuth?.ruleSnapshot || null) as Record<string, unknown> | null;

    const item = {
      member: {
        id: member.id,
        orgId: member.orgId,
        clientId: member.clientId ?? null,
        clientProgramId: member.clientProgramId ?? null,
        coveragePlanId: member.coveragePlanId ?? null,
        userId: member.userId ?? null,
        patientId: member.patientId ?? null,
        memberKind: member.memberKind ?? null,
        memberStatus: member.memberStatus ?? null,
        memberNumber: member.memberNumber ?? null,
        employeeNumber: member.employeeNumber ?? null,
        dependentCode: member.dependentCode ?? null,
        principalMemberNumber: member.principalMemberNumber ?? null,
        joinedAt: member.joinedAt?.toISOString?.() ?? null,
        effectiveFrom: member.effectiveFrom?.toISOString?.() ?? null,
        effectiveTo: member.effectiveTo?.toISOString?.() ?? null,
        onboardingSource: metadata?.onboardingSource ?? null,
        metadata: member.metadata ?? null,
      },

      coverage: {
        program: member.clientProgram
          ? {
              id: member.clientProgram.id,
              name: member.clientProgram.name,
            }
          : null,
        plan: member.coveragePlan
          ? {
              id: member.coveragePlan.id,
              name: member.coveragePlan.name,
              description: member.coveragePlan.description ?? null,
              status: member.coveragePlan.status ?? null,
              currency: member.coveragePlan.currency ?? "ZAR",
              annualLimitMinor: member.coveragePlan.annualLimitMinor ?? null,
              monthlyLimitMinor: member.coveragePlan.monthlyLimitMinor ?? null,
              lifetimeLimitMinor: member.coveragePlan.lifetimeLimitMinor ?? null,
              requiresEligibility: Boolean(member.coveragePlan.requiresEligibility),
              requiresConsent: Boolean(member.coveragePlan.requiresConsent),
              serviceRules: Array.isArray(member.coveragePlan.serviceRules)
                ? member.coveragePlan.serviceRules.map((rule: any) => ({
                    id: rule.id,
                    serviceType: rule.serviceType,
                    decision: rule.decision,
                    enabled: rule.enabled,
                    preauthRequired: rule.preauthRequired,
                    sponsorCapMinor: rule.sponsorCapMinor ?? null,
                    memberCopayMinor: rule.memberCopayMinor ?? null,
                    memberCopayPercent: rule.memberCopayPercent ?? null,
                    limitCount: rule.limitCount ?? null,
                    limitMinor: rule.limitMinor ?? null,
                    limitPeriod: rule.limitPeriod ?? null,
                    allowedVisitModes: rule.allowedVisitModes ?? [],
                    metadata: rule.metadata ?? null,
                  }))
                : [],
            }
          : null,
        badges: extractBadges(member, adherence),
      },

      consent: {
        sponsorAdherence: Boolean(sharingPreference?.allowMedicalAidAdherenceAccess),
        corporateAdherence: Boolean(sharingPreference?.allowCorporateSponsorAdherenceAccess),
        rewardProgram: Boolean(sharingPreference?.allowRewardProgramAccess),
        evidenceImages: Boolean(iomt?.allowEvidenceImages),
        iomtFull: iomt?.mode === "full",
        iomtDevices: Array.isArray(iomt?.devices) ? iomt.devices : [],
        iomtMetrics: Array.isArray(iomt?.metrics) ? iomt.metrics : [],
      },

      healthContext: {
        consent: healthContextConsent,
        vitals: {
          latestClinicalSpotCheck: firstDefined(
            realHealthContext?.vitals?.latestClinicalSpotCheck,
            healthVitals?.latestClinicalSpotCheck,
            healthVitals?.latestSpotCheck,
            metadata?.latestClinicalSpotCheck
          ),
          trendSummary: firstDefined(
            realHealthContext?.vitals?.trendSummary,
            healthVitals?.trendSummary,
            healthVitals?.trends,
            metadata?.vitalTrendSummary
          ),
          abnormalFlags: asArray(
            firstDefined(
              realHealthContext?.vitals?.abnormalFlags,
              healthVitals?.abnormalFlags,
              healthVitals?.flags,
              metadata?.abnormalVitalFlags
            )
          ),
          sourceCoverage: firstDefined(
            realHealthContext?.vitals?.sourceCoverage,
            healthVitals?.sourceCoverage,
            healthVitals?.coverage,
            metadata?.vitalSourceCoverage,
            {}
          ),
        },
        wearable: {
          sleepSummary: firstDefined(
            realHealthContext?.wearable?.sleepSummary,
            wearableHealth?.sleepSummary,
            wearableHealth?.sleep,
            metadata?.sleepSummary
          ),
          activitySummary: firstDefined(
            realHealthContext?.wearable?.activitySummary,
            wearableHealth?.activitySummary,
            wearableHealth?.activity,
            metadata?.activitySummary
          ),
          rhrHrvSummary: firstDefined(
            realHealthContext?.wearable?.rhrHrvSummary,
            wearableHealth?.rhrHrvSummary,
            wearableHealth?.rhrHrv,
            metadata?.rhrHrvSummary
          ),
          rewardSignals: firstDefined(
            realHealthContext?.wearable?.rewardSignals,
            wearableHealth?.rewardSignals,
            rewards?.wearableSignals,
            rewards?.signals,
            []
          ),
        },
        clinicalHistory: {
          allergies: asArray(firstDefined(realHealthContext?.clinicalHistory?.allergies, clinicalHistory?.allergies, metadata?.allergies)),
          conditions: asArray(firstDefined(realHealthContext?.clinicalHistory?.conditions, clinicalHistory?.conditions, metadata?.conditions)),
          vaccinations: asArray(firstDefined(realHealthContext?.clinicalHistory?.vaccinations, clinicalHistory?.vaccinations, metadata?.vaccinations)),
          operations: asArray(firstDefined(realHealthContext?.clinicalHistory?.operations, clinicalHistory?.operations, metadata?.operations)),
        },
        reproductiveHealth: {
          visible: toBoolean(
            firstDefined(
              realHealthContext?.reproductiveHealth?.visible,
              reproductiveHealth?.visible,
              healthContextConsent.reproductiveHealth
            )
          ),
          pregnancySignalAvailable: toBoolean(
            firstDefined(
              realHealthContext?.reproductiveHealth?.pregnancySignalAvailable,
              reproductiveHealth?.pregnancySignalAvailable,
              reproductiveHealth?.pregnancyDetected !== undefined ? true : null,
              reproductiveHealth?.confidence !== undefined ? true : null
            )
          ),
          pregnancyDetected: toBoolean(
            firstDefined(
              realHealthContext?.reproductiveHealth?.pregnancyDetected,
              reproductiveHealth?.pregnancyDetected,
              false
            )
          ),
          confidence: firstDefined(
            realHealthContext?.reproductiveHealth?.confidence,
            reproductiveHealth?.confidence,
            null
          ),
          lastUpdated: firstDefined(
            realHealthContext?.reproductiveHealth?.lastUpdated,
            reproductiveHealth?.lastUpdated,
            reproductiveHealth?.updatedAt,
            null
          ),
        },
        antenatal: {
          visible: toBoolean(
            firstDefined(
              realHealthContext?.antenatal?.visible,
              antenatal?.visible,
              healthContextConsent.antenatal
            )
          ),
          pregnancyActive: toBoolean(
            firstDefined(
              realHealthContext?.antenatal?.pregnancyActive,
              antenatal?.pregnancyActive,
              reproductiveHealth?.pregnancyDetected,
              false
            )
          ),
          edd: firstDefined(
            realHealthContext?.antenatal?.edd,
            antenatal?.edd,
            antenatal?.estimatedDueDate,
            null
          ),
          gestationalAge: firstDefined(
            realHealthContext?.antenatal?.gestationalAge,
            antenatal?.gestationalAge,
            antenatal?.gestationalAgeWeeks,
            null
          ),
          trimester: firstDefined(
            realHealthContext?.antenatal?.trimester,
            antenatal?.trimester,
            null
          ),
          riskFlags: asArray(
            firstDefined(
              realHealthContext?.antenatal?.riskFlags,
              antenatal?.riskFlags,
              antenatal?.flags
            )
          ),
          birthRecordAvailable: toBoolean(
            firstDefined(
              realHealthContext?.antenatal?.birthRecordAvailable,
              antenatal?.birthRecordAvailable,
              antenatal?.birthRecord !== undefined ? true : null,
              false
            )
          ),
        },
      },

      adherence: adherence
        ? {
            allowed: Boolean(adherence.sharingEnabled),
            riskStatus: adherence.riskStatus,
            rewardEligible: adherence.rewardEligible,
            rewardPointsEstimate: adherence.rewardPointsEstimate,
            interventionFlags: adherence.interventionFlags,
            summary: adherence.summary,
            dailyTrend: adherence.dailyTrend,
          }
        : null,

      utilization: {
        claims: {
          count: claimCount,
          submittedAmountMinor,
          approvedAmountMinor,
          paidAmountMinor,
          currency: member.coveragePlan?.currency ?? "ZAR",
        },
        authorizations: {
          total: authorizations.length,
          pending: authorizations.filter((x: any) => String(x.status || "").toUpperCase() === "PENDING").length,
          approved: authorizations.filter((x: any) => String(x.status || "").toUpperCase() === "APPROVED").length,
          denied: authorizations.filter((x: any) => String(x.status || "").toUpperCase() === "DENIED").length,
          expired: authorizations.filter((x: any) => {
            const expiresAt = asDate(x.expiresAt);
            return Boolean(expiresAt && expiresAt.getTime() < Date.now());
          }).length,
          consumed: authorizations.filter((x: any) => String(x.status || "").toUpperCase() === "CONSUMED").length,
        },
        sponsorFunded: {
          pharmacyOrders: billableEvents.filter((x: any) => x.serviceType === "PHARMACY_ITEM").length,
          labOrders: billableEvents.filter((x: any) => x.serviceType === "LAB_TEST").length,
          logisticsOrders: billableEvents.filter(
            (x: any) => x.serviceType === "LAB_LOGISTICS" || x.serviceType === "RIDER_DELIVERY"
          ).length,
        },
      },

      iomtSharing: {
        mode: iomt?.mode || "Not configured",
        allowEvidenceImages: Boolean(iomt?.allowEvidenceImages),
        devices: Array.isArray(iomt?.devices) ? iomt.devices : [],
        metrics: Array.isArray(iomt?.metrics) ? iomt.metrics : [],
      },

      gymWellness: {
        name: gym?.name || gym?.partnerName || null,
        membershipType: gym?.membershipType || null,
        status: gym?.status || (gym?.active ? "Active" : null),
        checkInCount: gym?.checkInCount ?? gym?.checkIns ?? 0,
        sessionCalories: gym?.sessionCalories ?? null,
        sessionDistanceKm: gym?.sessionDistanceKm ?? null,
        sessionAvgHr: gym?.sessionAvgHr ?? null,
        sessionAvgSpo2: gym?.sessionAvgSpo2 ?? null,
        lastCheckIn: gym?.lastCheckIn ?? null,
        lastSessionMinutes: gym?.lastSessionMinutes ?? null,
        notes: gym?.notes ?? null,
      },

      rewards: {
        eligible: Boolean(adherence?.rewardEligible),
        pointsEstimate: adherence?.rewardPointsEstimate ?? rewards?.pointsEstimate ?? 0,
        walletDestination: rewards?.walletDestination || rewards?.redemptionDestination || null,
        tier: rewards?.tier || "Standard",
        monthlyCap: rewards?.monthlyCap ?? null,
        reversalPolicy: rewards?.reversalPolicy ?? null,
        allowedUses: Array.isArray(rewards?.allowedUses) ? rewards.allowedUses : [],
      },

      latestPreflight: latestAuth
        ? {
            decision:
              String(latestAuth.status || "").toUpperCase() === "APPROVED"
                ? "COVERED"
                : String(latestAuth.status || "").toUpperCase() === "DENIED"
                ? "NOT_COVERED"
                : latestRuleSnapshot?.decision || null,
            sponsorAmountMinor: Number(latestAuth.approvedAmountMinor ?? 0),
            patientCopayMinor: Number(
              (latestRuleSnapshot?.patientCopayMinor as number | undefined) ?? 0
            ),
            uncoveredGapMinor: Number(
              (latestRuleSnapshot?.uncoveredGapMinor as number | undefined) ?? 0
            ),
            authorizationRequired:
              String(latestAuth.status || "").toUpperCase() === "PENDING" ||
              Boolean((latestRuleSnapshot as any)?.preauthRequired),
            reason: String(latestAuth.decisionReason || ""),
            ruleSnapshot: latestRuleSnapshot,
          }
        : null,

      recentAuthorizations: authorizations.slice(0, 10).map((item: any) => ({
        id: item.id,
        status: item.status,
        serviceType: item.serviceType,
        scopeType: item.scopeType,
        requestedAmountMinor: item.requestedAmountMinor ?? 0,
        approvedAmountMinor: item.approvedAmountMinor ?? 0,
        currency: item.currency ?? "ZAR",
        decisionReason: item.decisionReason ?? null,
        decidedAt: item.decidedAt?.toISOString?.() ?? null,
        expiresAt: item.expiresAt?.toISOString?.() ?? null,
        createdAt: item.createdAt?.toISOString?.() ?? null,
      })),

      audit: {
        sourceVersion: "client-member-profile-context.v2",
        generatedAt: new Date().toISOString(),
      },
    };

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build member profile context.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}