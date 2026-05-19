import type {
  AdminInsightResponse,
  ClinicianInsightResponse,
  PatientInsightResponse,
} from '../../../../packages/insightcore/src/contracts/integration';

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

export class ResponseContractAssembler {
  toPatient(args: {
    requestId: string;
    degradedMode: boolean;
    source: 'insightcore' | 'local_fallback' | 'hybrid';
    local?: any;
    result?: any;
    baselineTrend?: any;
    baselineState?: any;
  }): PatientInsightResponse {
    const healthScore =
      args.local?.score ??
      args.result?.episode?.score ??
      args.result?.insights?.[0]?.score ??
      80;

    const riskLevel = inferPatientRiskLevel(healthScore);
    const riskLabel = inferRiskLabel(riskLevel);

    const concerns =
      (args.local?.diagnoses || []).map((d: any) => ({
        name: d.name,
        prob: d.prob ?? null,
      })) || [];

    const recommendations = Array.isArray(args.local?.recommendations)
      ? args.local.recommendations
      : [];

    const explanations = Array.isArray(args.local?.explanations)
      ? args.local.explanations
      : [];

    const nextBestActions =
      riskLevel === 'critical' || riskLevel === 'high'
        ? [
            { id: 'book', label: 'Book a teleconsult', href: '/clinicians', kind: 'book_visit' as const },
            { id: 'repeat', label: 'Repeat check soon', kind: 'repeat_check' as const },
          ]
        : [
            { id: 'self-care', label: 'Follow today’s self-care plan', kind: 'self_care' as const },
            { id: 'repeat', label: 'Repeat check later', kind: 'repeat_check' as const },
          ];

    return {
      requestId: args.requestId,
      generatedAt: new Date().toISOString(),
      degradedMode: args.degradedMode,
      source: args.source,
      summary: {
        riskLabel,
        riskLevel,
        healthScore,
        confidence: args.local?.confidence ?? null,
        requiresClinicianReview: riskLevel === 'high' || riskLevel === 'critical',
      },
      concerns,
      recommendations,
      explanations,
      trendSummary: args.baselineTrend
        ? { label: 'Trend-aware interpretation available', note: 'Recent patterns were considered.' }
        : null,
      baselineSummary: args.baselineState
        ? { label: 'Baseline-aware interpretation available', note: 'Personal history informed the summary.' }
        : null,
      nextBestActions,
      whenToSeekCare:
        riskLevel === 'critical'
          ? { urgency: 'urgent', message: 'If symptoms feel severe or unsafe, seek urgent medical care now.' }
          : riskLevel === 'high'
            ? { urgency: 'soon', message: 'Book clinician review soon, especially if readings remain abnormal.' }
            : { urgency: 'routine', message: 'Monitor and repeat if symptoms change or persist.' },
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
      rationale: {
        concerns: (args.result?.alerts || []).map((a: any) => a.message).filter(Boolean),
        drivers: (args.result?.deploymentInferences || []).map((i: any) => i.model).filter(Boolean),
        medicationImpact: [],
      },
      uncertainty: args.result?.uncertainty ?? null,
      traceRef: args.result?.trace?.id ?? null,
      lineageRef: args.result?.lineage?.id ?? null,
      researchSection: {
        available: Array.isArray(args.result?.researchInferences) && args.result.researchInferences.length > 0,
        items: args.result?.researchInferences || [],
        label: 'research_only',
      },
    };
  }

  toAdmin(args: {
    requestId: string;
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