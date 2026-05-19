import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseIntSafe(value: string | null, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function hasMetric(metrics: unknown, names: string[]) {
  if (!Array.isArray(metrics)) return false;
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  return metrics.some((metric) => wanted.has(String(metric).toLowerCase()));
}

function bool(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null) return fallback;
  return Boolean(value);
}

function pick(...values: any[]) {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId") || "org-default";
    const days = parseIntSafe(searchParams.get("days"), 30);

    const members = await prisma.clientMember.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const patientIds = members.map((m) => m.patientId).filter(Boolean) as string[];

    const sharingPrefs = patientIds.length
      ? await prisma.patientDataSharingPreference
          .findMany({
            where: { patientId: { in: patientIds } },
          })
          .catch(() => [])
      : [];

    const prefByPatientId = new Map(
      sharingPrefs.map((pref: any) => [pref.patientId, pref])
    );

    let vitalsAccessCount = 0;
    let wearableInsightsCount = 0;
    let clinicalHistoryAccessCount = 0;
    let reproductiveHealthAccessCount = 0;
    let antenatalAccessCount = 0;
    let pregnancySignalCount = 0;
    let birthRecordVisibleCount = 0;
    let clinicalSpotCheckAvailableCount = 0;
    let wearableRewardSignalCount = 0;

    const sampledMembers = members.slice(0, 8).map((member) => {
      const metadata = (member.metadata || {}) as Record<string, any>;
      const health =
        metadata.healthContext ||
        metadata.health ||
        metadata.healthProfile ||
        {};

      const healthConsent =
        health.consent ||
        metadata.healthConsent ||
        metadata.consent?.health ||
        metadata.dataSharing?.health ||
        {};

      const iomt = metadata.iomtSharing || metadata.deviceSharing || {};
      const pref = member.patientId ? prefByPatientId.get(member.patientId) : null;

      const vitalMetricShared =
        iomt.mode === "full" ||
        hasMetric(iomt.metrics, [
          "vitals",
          "blood_pressure",
          "heart_rate",
          "spo2",
          "temperature",
          "respiratory_rate",
        ]);

      const wearableMetricShared =
        iomt.mode === "full" ||
        hasMetric(iomt.metrics, [
          "sleep",
          "activity",
          "steps",
          "heart_rate",
          "rhr",
          "hrv",
          "calories",
        ]);

      const vitalsAccess = bool(
        pick(
          healthConsent.vitals,
          healthConsent.allowVitals,
          healthConsent.allowVitalsAccess,
          healthConsent.allowClinicalSpotChecks,
          (pref as any)?.allowVitalsAccess
        ),
        vitalMetricShared
      );

      const wearableInsights = bool(
        pick(
          healthConsent.wearableInsights,
          healthConsent.allowWearableInsights,
          healthConsent.allowWearableInsightsAccess,
          (pref as any)?.allowWearableInsightsAccess
        ),
        wearableMetricShared
      );

      const clinicalHistoryAccess = bool(
        pick(
          healthConsent.clinicalHistory,
          healthConsent.allowClinicalHistory,
          healthConsent.allowClinicalHistoryAccess,
          (pref as any)?.allowClinicalHistoryAccess
        )
      );

      const reproductiveHealthAccess = bool(
        pick(
          healthConsent.reproductiveHealth,
          healthConsent.allowReproductiveHealth,
          healthConsent.allowReproductiveHealthAccess,
          (pref as any)?.allowReproductiveHealthAccess
        )
      );

      const antenatalAccess = bool(
        pick(
          healthConsent.antenatal,
          healthConsent.allowAntenatal,
          healthConsent.allowAntenatalAccess,
          (pref as any)?.allowAntenatalAccess
        )
      );

      const vitals =
        health.vitals ||
        metadata.vitals ||
        metadata.clinicalVitals ||
        {};

      const wearable =
        health.wearable ||
        metadata.wearable ||
        metadata.wearableInsights ||
        {};

      const clinicalHistory =
        health.clinicalHistory ||
        metadata.clinicalHistory ||
        metadata.history ||
        {};

      const reproductiveHealth =
        health.reproductiveHealth ||
        metadata.reproductiveHealth ||
        {};

      const antenatal =
        health.antenatal ||
        metadata.antenatal ||
        metadata.maternity ||
        {};

      const hasClinicalSpotCheck = Boolean(
        vitals.latestClinicalSpotCheck ||
          vitals.latestSpotCheck ||
          metadata.latestClinicalSpotCheck
      );

      const hasWearableRewardSignals =
        asArray(wearable.rewardSignals).length > 0 ||
        asArray(metadata.rewardProfile?.wearableSignals).length > 0 ||
        asArray(metadata.rewards?.signals).length > 0;

      const hasPregnancySignal = Boolean(
        reproductiveHealth.pregnancySignalAvailable ||
          reproductiveHealth.pregnancyDetected ||
          reproductiveHealth.confidence
      );

      const hasBirthRecord = Boolean(
        antenatal.birthRecordAvailable ||
          antenatal.birthRecord
      );

      if (vitalsAccess) vitalsAccessCount += 1;
      if (wearableInsights) wearableInsightsCount += 1;
      if (clinicalHistoryAccess) clinicalHistoryAccessCount += 1;
      if (reproductiveHealthAccess) reproductiveHealthAccessCount += 1;
      if (antenatalAccess) antenatalAccessCount += 1;
      if (hasPregnancySignal) pregnancySignalCount += 1;
      if (hasBirthRecord) birthRecordVisibleCount += 1;
      if (hasClinicalSpotCheck) clinicalSpotCheckAvailableCount += 1;
      if (hasWearableRewardSignals) wearableRewardSignalCount += 1;

      return {
        id: member.id,
        memberNumber: member.memberNumber || member.employeeNumber || member.id,
        memberStatus: member.memberStatus,
        vitalsAccess,
        wearableInsights,
        clinicalHistoryAccess,
        reproductiveHealthAccess,
        antenatalAccess,
        clinicalCounts: {
          allergies: asArray(clinicalHistory.allergies || metadata.allergies).length,
          conditions: asArray(clinicalHistory.conditions || metadata.conditions).length,
          vaccinations: asArray(clinicalHistory.vaccinations || metadata.vaccinations).length,
          operations: asArray(clinicalHistory.operations || metadata.operations).length,
        },
        healthSignals: {
          clinicalSpotCheckAvailable: hasClinicalSpotCheck,
          wearableRewardSignals: hasWearableRewardSignals,
          pregnancySignalAvailable: hasPregnancySignal,
          birthRecordVisible: hasBirthRecord,
        },
      };
    });

    const summary = {
      orgId,
      days,
      memberCount: members.length,
      activeMemberCount: members.filter((m) => String(m.memberStatus || "").toUpperCase() === "ACTIVE").length,
      healthContext: {
        vitalsAccessCount,
        wearableInsightsCount,
        clinicalHistoryAccessCount,
        reproductiveHealthAccessCount,
        antenatalAccessCount,
        pregnancySignalCount,
        birthRecordVisibleCount,
        clinicalSpotCheckAvailableCount,
        wearableRewardSignalCount,
      },
    };

    return NextResponse.json({
      ok: true,
      orgId,
      days,
      summary,
      sampledMembers,
      audit: {
        sourceVersion: "client-dashboard-summary.v1",
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build client dashboard summary.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}