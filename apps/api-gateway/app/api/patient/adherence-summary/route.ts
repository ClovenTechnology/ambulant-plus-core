import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

/* keep all existing helper functions exactly as before:
   parseIntSafe, startOfDay, endOfDay, toYmd, asDate,
   computeLateScore, classifyReminder, average
*/

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function computeLateScore(delayMinutes: number, source: 'verified' | 'self_reported'): number {
  const d = Math.max(0, delayMinutes);

  if (source === 'verified') {
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
  const status = String(rem?.status ?? 'Pending');
  const scheduledFor = asDate(rem?.scheduledFor ?? rem?.meta?.scheduledFor ?? null);
  const takenAt =
    asDate(rem?.takenAt) ??
    asDate(rem?.verifiedAt) ??
    asDate(rem?.reportedTakenAt) ??
    null;

  const verificationStatus = String(rem?.verificationStatus ?? '');
  const takenSource = String(rem?.takenSource ?? '');

  if (status === 'Missed') {
    return { kind: 'MISSED', adherenceScore: 0, confidenceScore: 0, delayMinutes: null, late: false };
  }

  if (status !== 'Taken') {
    return { kind: 'PENDING', adherenceScore: null, confidenceScore: null, delayMinutes: null, late: false };
  }

  const delayMinutes =
    scheduledFor && takenAt
      ? Math.max(0, Math.round((takenAt.getTime() - scheduledFor.getTime()) / 60000))
      : 0;

  const isVerified =
    verificationStatus === 'VERIFIED' || takenSource === 'CAMERA_VERIFIED';

  const isSelfReported =
    verificationStatus === 'SELF_REPORTED' ||
    takenSource === 'SELF_REPORTED' ||
    takenSource === 'MANUAL_CLINICIAN';

  if (isVerified) {
    if (delayMinutes <= 15) {
      return { kind: 'VERIFIED_ON_TIME', adherenceScore: 1, confidenceScore: 1, delayMinutes, late: false };
    }
    const score = computeLateScore(delayMinutes, 'verified');
    return { kind: 'VERIFIED_LATE', adherenceScore: score, confidenceScore: score, delayMinutes, late: true };
  }

  if (isSelfReported) {
    if (delayMinutes <= 15) {
      return { kind: 'SELF_REPORTED_ON_TIME', adherenceScore: 0.75, confidenceScore: 0.75, delayMinutes, late: false };
    }
    const score = computeLateScore(delayMinutes, 'self_reported');
    return { kind: 'SELF_REPORTED_LATE', adherenceScore: score, confidenceScore: score, delayMinutes, late: true };
  }

  return { kind: 'TAKEN_UNCLASSIFIED', adherenceScore: 0.6, confidenceScore: 0.6, delayMinutes, late: delayMinutes > 15 };
}

function average(nums: number[]) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const patientId = (url.searchParams.get('patientId') || '').trim();
    const days = parseIntSafe(url.searchParams.get('days'), 30);
    const requesterRole = String(req.headers.get('x-role') || 'patient').toLowerCase();

    if (!patientId) {
      return NextResponse.json({ ok: false, error: 'patientId is required' }, { status: 400 });
    }

    const sharingPreference = await prisma.patientDataSharingPreference.findUnique({
      where: { patientId },
    });

    const isMedicalAid = requesterRole === 'medical_aid';
    const isCorporateSponsor = requesterRole === 'corporate_sponsor';
    const isRewardProgram = requesterRole === 'reward_program';

    if (isMedicalAid && !sharingPreference?.allowMedicalAidAdherenceAccess) {
      return NextResponse.json({ ok: false, error: 'adherence_sharing_not_enabled' }, { status: 403 });
    }

    if (isCorporateSponsor && !sharingPreference?.allowCorporateSponsorAdherenceAccess) {
      return NextResponse.json({ ok: false, error: 'adherence_sharing_not_enabled' }, { status: 403 });
    }

    if (isRewardProgram && !sharingPreference?.allowRewardProgramAccess) {
      return NextResponse.json({ ok: false, error: 'reward_sharing_not_enabled' }, { status: 403 });
    }

    const now = new Date();
    const start = startOfDay(new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000));
    const end = endOfDay(now);

    const [medications, reminders] = await Promise.all([
      prisma.medication.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.reminder.findMany({
        where: {
          patientId,
          source: 'medication',
          OR: [
            { scheduledFor: { gte: start, lte: end } },
            { createdAt: { gte: start, lte: end } },
          ],
        },
        orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    const activeMeds = medications.filter((m) => String(m.status) === 'Active');
    const reminderMedIds = new Set(reminders.map((r) => r.medicationId).filter(Boolean));
    const uncoveredMedications = activeMeds
      .filter((m) => !reminderMedIds.has(m.id))
      .map((m) => ({
        medicationId: m.id,
        name: m.name,
        dose: m.dose,
        source: m.source,
        status: m.status,
      }));

    let verifiedTaken = 0;
    let selfReportedTaken = 0;
    let missed = 0;
    let pending = 0;
    let lateCount = 0;

    const adherenceScores: number[] = [];
    const confidenceScores: number[] = [];

    const medicationMap = new Map<string, any>();
    const dailyMap = new Map<string, any>();

    for (const rem of reminders) {
      const cls = classifyReminder(rem);
      const dayDate = asDate(rem.scheduledFor ?? rem.createdAt) ?? now;
      const dayKey = toYmd(dayDate);

      if (!dailyMap.has(dayKey)) {
        dailyMap.set(dayKey, {
          date: dayKey,
          pending: 0,
          missed: 0,
          verifiedTaken: 0,
          selfReportedTaken: 0,
          weightedNumerator: 0,
          confidenceNumerator: 0,
          denominator: 0,
        });
      }
      const dayAgg = dailyMap.get(dayKey)!;

      const medKey = rem.medicationId || `unlinked:${rem.name}`;
      if (!medicationMap.has(medKey)) {
        medicationMap.set(medKey, {
          medicationId: rem.medicationId || medKey,
          name: rem.name,
          dose: rem.dose ?? null,
          source: rem.source ?? null,
          pending: 0,
          missed: 0,
          verifiedTaken: 0,
          selfReportedTaken: 0,
          lateCount: 0,
          reminderCount: 0,
          weightedPct: 0,
          confidencePct: 0,
          remindersConfigured: true,
        });
      }
      const medAgg = medicationMap.get(medKey)!;
      medAgg.reminderCount += 1;

      if (cls.kind === 'PENDING') {
        pending += 1;
        dayAgg.pending += 1;
        medAgg.pending += 1;
        continue;
      }

      dayAgg.denominator += 1;

      if (cls.kind === 'MISSED') {
        missed += 1;
        dayAgg.missed += 1;
        medAgg.missed += 1;
        continue;
      }

      if (String(rem.verificationStatus) === 'VERIFIED' || String(rem.takenSource) === 'CAMERA_VERIFIED') {
        verifiedTaken += 1;
        dayAgg.verifiedTaken += 1;
        medAgg.verifiedTaken += 1;
      } else {
        selfReportedTaken += 1;
        dayAgg.selfReportedTaken += 1;
        medAgg.selfReportedTaken += 1;
      }

      if (cls.late) {
        lateCount += 1;
        medAgg.lateCount += 1;
      }

      adherenceScores.push(cls.adherenceScore ?? 0);
      confidenceScores.push(cls.confidenceScore ?? 0);

      dayAgg.weightedNumerator += cls.adherenceScore ?? 0;
      dayAgg.confidenceNumerator += cls.confidenceScore ?? 0;
    }

    const medicationBreakdown = Array.from(medicationMap.values()).map((m) => {
      const denom = m.verifiedTaken + m.selfReportedTaken + m.missed;
      const weightedNumerator = m.verifiedTaken * 1 + m.selfReportedTaken * 0.75;
      const confidenceNumerator = m.verifiedTaken * 1 + m.selfReportedTaken * 0.75;

      return {
        ...m,
        weightedPct: denom > 0 ? Math.round((weightedNumerator / denom) * 100) : 100,
        confidencePct: denom > 0 ? Math.round((confidenceNumerator / denom) * 100) : 100,
        state:
          m.missed > 0
            ? 'at_risk'
            : m.pending > 0
            ? 'pending'
            : m.selfReportedTaken > m.verifiedTaken
            ? 'weak_evidence'
            : 'stable',
      };
    });

    const dailyTrend = Array.from(dailyMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        date: d.date,
        pending: d.pending,
        missed: d.missed,
        verifiedTaken: d.verifiedTaken,
        selfReportedTaken: d.selfReportedTaken,
        weightedPct: d.denominator > 0 ? Math.round((d.weightedNumerator / d.denominator) * 100) : 100,
        confidencePct: d.denominator > 0 ? Math.round((d.confidenceNumerator / d.denominator) * 100) : 100,
      }));

    const totalTracked = verifiedTaken + selfReportedTaken + missed;
    const weightedPct = totalTracked > 0 ? Math.round(average(adherenceScores) * 100) : 100;
    const confidencePct = totalTracked > 0 ? Math.round(average(confidenceScores) * 100) : 100;
    const verifiedRatio = totalTracked > 0 ? Math.round((verifiedTaken / totalTracked) * 100) : 0;
    const missedDoseRate = totalTracked > 0 ? Math.round((missed / totalTracked) * 100) : 0;
    const lateDoseRate =
      verifiedTaken + selfReportedTaken > 0
        ? Math.round((lateCount / (verifiedTaken + selfReportedTaken)) * 100)
        : 0;

    const coveredActiveMedicationCount = activeMeds.length - uncoveredMedications.length;
    const reminderCoveragePct =
      activeMeds.length > 0 ? Math.round((coveredActiveMedicationCount / activeMeds.length) * 100) : 100;

    const weakEvidenceMeds = medicationBreakdown.filter((m) => m.selfReportedTaken > m.verifiedTaken);
    const missedMeds = medicationBreakdown.filter((m) => m.missed > 0);

    const verifiedDays = dailyTrend.filter((d) => d.verifiedTaken > 0 && d.missed === 0).length;
    const rewardPointsEstimate = Math.max(0, verifiedTaken * 3 + selfReportedTaken * 1 - missed * 2);

    return NextResponse.json({
      ok: true,
      patientId,
      period: {
        days,
        start: start.toISOString(),
        end: end.toISOString(),
      },
      sharing: {
        allowMedicalAidAdherenceAccess: sharingPreference?.allowMedicalAidAdherenceAccess ?? false,
        allowCorporateSponsorAdherenceAccess: sharingPreference?.allowCorporateSponsorAdherenceAccess ?? false,
        allowRewardProgramAccess: sharingPreference?.allowRewardProgramAccess ?? false,
        allowEvidenceImages: sharingPreference?.allowEvidenceImages ?? false,
      },
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
        coveredActiveMedicationCount,
        uncoveredMedicationCount: uncoveredMedications.length,
        reminderCoveragePct,
      },
      dailyTrend,
      medicationBreakdown,
      uncoveredMedications,
      interventions: {
        highRiskMedications: missedMeds.slice(0, 10),
        weakEvidenceMedications: weakEvidenceMeds.slice(0, 10),
        needsReminderSetup: uncoveredMedications,
      },
      rewardSignals: {
        verifiedDays,
        rewardPointsEstimate,
        rewardEligible:
          weightedPct >= 80 &&
          confidencePct >= 70 &&
          missedDoseRate <= 10,
      },
    });
  } catch (err: any) {
    console.error('patient adherence summary GET error', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 }
    );
  }
}