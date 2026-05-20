// apps/api-gateway/src/insightcore/ResponseContractAssembler.ts
import type {
  AdminInsightResponse,
  ClinicianInsightResponse,
  PatientInsightResponse,
} from '../../../../packages/insightcore/src/contracts/integration';

type PatientInsightSource = 'insightcore';

function finiteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clampScore(value: unknown, fallback = 80): number {
  const n = finiteNumber(value);
  if (n == null) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function inferPatientRiskLevel(score?: number | null): PatientInsightResponse['summary']['riskLevel'] {
  const s = Number(score ?? 0);

  if (s <= 30) return 'critical';
  if (s <= 50) return 'high';
  if (s <= 70) return 'moderate';
  if (s <= 85) return 'watch';

  return 'low';
}

function inferRiskLabel(level: PatientInsightResponse['summary']['riskLevel']) {
  switch (level) {
    case 'critical':
      return 'Urgent attention needed';
    case 'high':
      return 'Follow up now';
    case 'moderate':
      return 'Monitor closely';
    case 'watch':
      return 'Watch and re-check';
    default:
      return 'All good';
  }
}

function resultHealthScore(result: any): number {
  const candidates = [
    result?.patientSummary?.healthScore,
    result?.summary?.healthScore,
    result?.healthScore,
    result?.score,
    result?.episodes?.[0]?.peakRiskScore != null
      ? 100 - Number(result.episodes[0].peakRiskScore) * 100
      : null,
    result?.alerts?.[0]?.score != null
      ? 100 - Number(result.alerts[0].score) * 100
      : null,
    result?.insights?.[0]?.score,
  ];

  for (const candidate of candidates) {
    const n = finiteNumber(candidate);
    if (n != null) return clampScore(n);
  }

  return 80;
}

function resultConfidence(result: any): number | null {
  const candidates = [
    result?.confidence,
    result?.inferences?.[0]?.confidence,
    result?.deploymentInferences?.[0]?.confidence,
    result?.alerts?.[0]?.confidence,
  ];

  for (const candidate of candidates) {
    const n = finiteNumber(candidate);
    if (n != null) return Math.max(0, Math.min(1, n));
  }

  return null;
}

function resultConcerns(result: any): Array<{ name: string; prob?: number | null }> {
  const episodes = Array.isArray(result?.episodes) ? result.episodes : [];
  const alerts = Array.isArray(result?.alerts) ? result.alerts : [];

  const fromEpisodes = episodes
    .map((episode: any) => ({
      name: String(episode?.title || episode?.syndrome || 'Clinical signal').trim(),
      prob: finiteNumber(episode?.peakRiskScore),
    }))
    .filter((item: any) => item.name);

  const fromAlerts = alerts
    .map((alert: any) => ({
      name: String(alert?.type || alert?.message || alert?.syndrome || 'Risk alert').trim(),
      prob: finiteNumber(alert?.score),
    }))
    .filter((item: any) => item.name);

  return [...fromEpisodes, ...fromAlerts].slice(0, 6);
}

function resultRecommendations(result: any): string[] {
  const insights = Array.isArray(result?.insights) ? result.insights : [];

  return insights
    .map((insight: any) =>
      String(
        insight?.recommendation ||
          insight?.next ||
          insight?.summary ||
          insight?.message ||
          '',
      ).trim(),
    )
    .filter(Boolean)
    .slice(0, 6);
}

function resultExplanations(result: any): Array<{ feature: string; impact?: number | null; note?: string | null }> {
  const inferences = Array.isArray(result?.deploymentInferences)
    ? result.deploymentInferences
    : Array.isArray(result?.inferences)
      ? result.inferences
      : [];

  return inferences
    .map((inference: any) => ({
      feature: String(
        inference?.output?.ruleId ||
          inference?.model ||
          inference?.syndrome ||
          'InsightCore signal',
      ).trim(),
      impact: finiteNumber(inference?.confidence),
      note: inference?.rationale?.[0] ? String(inference.rationale[0]) : null,
    }))
    .filter((item: any) => item.feature)
    .slice(0, 6);
}

export class ResponseContractAssembler {
  toPatient(args: {
    requestId: string;
    degradedMode: boolean;
    source: PatientInsightSource;
    local?: null;
    result?: any;
    baselineTrend?: any;
    baselineState?: any;
  }): PatientInsightResponse {
    const healthScore = resultHealthScore(args.result);
    const riskLevel = inferPatientRiskLevel(healthScore);
    const riskLabel = inferRiskLabel(riskLevel);

    const concerns = resultConcerns(args.result);
    const recommendations = resultRecommendations(args.result);
    const explanations = resultExplanations(args.result);

    const nextBestActions =
      riskLevel === 'critical' || riskLevel === 'high'
        ? [
            {
              id: 'book',
              label: 'Book a teleconsult',
              href: '/clinicians',
              kind: 'book_visit' as const,
            },
            {
              id: 'repeat',
              label: 'Repeat check soon',
              kind: 'repeat_check' as const,
            },
          ]
        : [
            {
              id: 'self-care',
              label: 'Follow today’s self-care plan',
              kind: 'self_care' as const,
            },
            {
              id: 'repeat',
              label: 'Repeat check later',
              kind: 'repeat_check' as const,
            },
          ];

    return {
      requestId: args.requestId,
      generatedAt: new Date().toISOString(),
      degradedMode: args.degradedMode,
      source: 'insightcore',
      summary: {
        riskLabel,
        riskLevel,
        healthScore,
        confidence: resultConfidence(args.result),
        requiresClinicianReview: riskLevel === 'high' || riskLevel === 'critical',
      },
      concerns,
      recommendations,
      explanations,
      trendSummary: args.baselineTrend
        ? {
            label: 'Trend-aware interpretation available',
            note: 'Recent patterns were considered.',
          }
        : null,
      baselineSummary: args.baselineState
        ? {
            label: 'Baseline-aware interpretation available',
            note: 'Personal history informed the summary.',
          }
        : null,
      nextBestActions,
      whenToSeekCare:
        riskLevel === 'critical'
          ? {
              urgency: 'urgent',
              message: 'If symptoms feel severe or unsafe, seek urgent medical care now.',
            }
          : riskLevel === 'high'
            ? {
                urgency: 'soon',
                message: 'Book clinician review soon, especially if readings remain abnormal.',
              }
            : {
                urgency: 'routine',
                message: 'Monitor and repeat if symptoms change or persist.',
              },
      handoffAvailable: true,
    };
  }

  toClinician(args: {
    requestId: string;
    degradedMode: boolean;
    result: any;
  }): ClinicianInsightResponse {
    return {
      requestId: args.requestId,
      generatedAt: new Date().toISOString(),
      degradedMode: args.degradedMode,
      patientSummary: {
        riskLabel: args.result?.alerts?.[0]?.type || 'Clinical summary',
        riskLevel: args.result?.alerts?.[0]?.severity || 'watch',
        confidence: args.result?.inferences?.[0]?.confidence ?? null,
        baselineSummary: args.result?.baselineState ?? null,
        trendSummary: args.result?.baselineTrend ?? null,
      },
      deploymentInferences: args.result?.deploymentInferences || [],
      episodes: args.result?.episodes || [],
      alerts: args.result?.alerts || [],
      insights: args.result?.insights || [],
    };
  }

  toAdmin(args: {
    requestId: string;
    degradedMode?: boolean;
    result: any;
  }): AdminInsightResponse {
    return {
      requestId: args.requestId,
      generatedAt: new Date().toISOString(),
      runtimePlan: args.result?.runtimePlan ?? null,
      runtimeAudit: args.result?.runtimeAudit ?? null,
      rolloutRecords: args.result?.rolloutRecords ?? [],
      experimentAssignments: args.result?.experimentAssignments ?? [],
      evaluation: {
        modelScorecard: null,
        familyScorecard: null,
        runtimeDrift: null,
        baselineDrift: null,
        researchScorecard: null,
        executionQuality: null,
      },
      governance: {
        compliance: null,
        rolloutSafety: null,
        policyDrift: null,
      },
      cohort: args.result?.cohort ?? null,
    };
  }
}