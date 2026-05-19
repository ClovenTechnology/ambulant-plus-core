'use client';

import { useCallback, useMemo, useState } from 'react';
import { computeCardioRisk, hypertensionIndex } from '@/src/analytics/cardio';
import { computeStressIndex } from '@/src/analytics/stress';
import useSelfCheckHistory from './useSelfCheckHistory';
import {
  analyzeSelfCheckWithInsightCore,
  postInsightLearningEvent,
} from '@/src/lib/insightcore/api';

type RiskLevel = 'low' | 'medium' | 'high';
type AnalysisSource = 'insightcore' | 'local_fallback' | 'hybrid';

type Concern = {
  name: string;
  prob: number;
};

type Explanation = {
  feature: string;
  impact: number;
  note?: string;
};

type TriageAnalyzerArgs = {
  vitals?: any[];
  symptoms?: Record<string, boolean>;
  bmi?: number | null;
  extraMeta?: Record<string, any>;
};

async function clientFallbackAnalyze(
  vitals: any[],
  symptoms: Record<string, boolean>,
  bmi: number | null,
  extraMeta?: Record<string, any>
) {
  const symptomCount = Object.values(symptoms).filter(Boolean).length;

  const profile = extraMeta?.profile || {};
  const med = extraMeta?.medicationAdherence || {};
  const wearable = extraMeta?.wearableDrivers || {};

  const chronicConditions = Array.isArray(profile?.chronicConditions)
    ? profile.chronicConditions
    : [];

  const missedDoseCount = Number(med?.missedDoseCount || 0);
  const poorSleep = Boolean(wearable?.poorSleep);
  const lowRecovery = Boolean(wearable?.lowRecovery);
  const lowActivity = Boolean(wearable?.lowActivity);
  const elevatedStress = Boolean(wearable?.elevatedStress);

  let score =
    (bmi && bmi >= 18.5 && bmi < 25 ? 90 : 80) -
    symptomCount * 7 -
    missedDoseCount * 4 -
    (poorSleep ? 5 : 0) -
    (lowRecovery ? 4 : 0) -
    (elevatedStress ? 4 : 0);

  if (includesText(chronicConditions, 'hypertension')) {
    score -= 2;
  }

  if (
    includesText(chronicConditions, 'diabetes') ||
    includesText(chronicConditions, 'prediabetes')
  ) {
    score -= 2;
  }

  score = Math.max(0, Math.round(score));

  const recommendations: string[] = [
    'Keep hydrated, rest and monitor symptoms.',
  ];

  if (poorSleep) {
    recommendations.push(
      'Sleep debt may be contributing — aim for an earlier wind-down and re-check after better rest.'
    );
  }

  if (lowActivity) {
    recommendations.push(
      'A short gentle walk today may help circulation if you feel safe to do so.'
    );
  }

  if (missedDoseCount > 0) {
    recommendations.push(
      'Missed medication may be contributing — review your schedule and take only as prescribed.'
    );
  }

  if (elevatedStress) {
    recommendations.push(
      'Stress may be contributing — try 10 minutes of slow breathing or guided relaxation.'
    );
  }

  const explanations: Explanation[] = [
    {
      feature: 'Symptoms count',
      impact: -0.07 * symptomCount,
      note: `${symptomCount} active`,
    },
    ...(bmi
      ? [
          {
            feature: 'BMI',
            impact: bmi >= 25 ? -0.05 : 0.05,
            note: `${bmi.toFixed(1)}`,
          },
        ]
      : []),
    ...(poorSleep
      ? [
          {
            feature: 'Sleep',
            impact: -0.05,
            note: 'Sleep debt may be contributing',
          },
        ]
      : []),
    ...(lowRecovery
      ? [
          {
            feature: 'Recovery',
            impact: -0.04,
            note: 'Reduced recovery signal',
          },
        ]
      : []),
    ...(missedDoseCount > 0
      ? [
          {
            feature: 'Medication adherence',
            impact: -0.05 * missedDoseCount,
            note: `${missedDoseCount} missed`,
          },
        ]
      : []),
    ...(chronicConditions.length
      ? [
          {
            feature: 'Known conditions',
            impact: -0.03,
            note: chronicConditions.slice(0, 3).join(', '),
          },
        ]
      : []),
  ];

  const diagnoses: Concern[] = [
    {
      name: 'Self-check baseline',
      prob: 0.75,
    },
  ];

  return {
    score,
    diagnoses,
    recommendations,
    explanations,
  };
}

function extractSystolicFromEntry(v: any): number | null {
  try {
    if (!v) return null;

    if (typeof v.value === 'string' && v.value.includes('/')) {
      const parts = v.value.split('/').map((p: any) => Number(p.trim()));

      if (parts.length >= 1 && Number.isFinite(parts[0])) {
        return parts[0];
      }
    }

    if (
      Array.isArray(v.trend) &&
      v.trend.length &&
      Number.isFinite(v.trend[v.trend.length - 1])
    ) {
      return Number(v.trend[v.trend.length - 1]);
    }

    return null;
  } catch {
    return null;
  }
}

function toNum(v: any): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;

  if (typeof v === 'string') {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

function includesText(list: any[], needle: string): boolean {
  const q = needle.toLowerCase();

  return (Array.isArray(list) ? list : []).some((x) =>
    String(x || '').toLowerCase().includes(q)
  );
}

function normalizeAnalyzerArgs(
  args?: TriageAnalyzerArgs
): Required<TriageAnalyzerArgs> {
  return {
    vitals: Array.isArray(args?.vitals) ? args.vitals : [],
    symptoms:
      args?.symptoms &&
      typeof args.symptoms === 'object' &&
      !Array.isArray(args.symptoms)
        ? args.symptoms
        : {},
    bmi:
      typeof args?.bmi === 'number' && Number.isFinite(args.bmi)
        ? args.bmi
        : null,
    extraMeta:
      args?.extraMeta &&
      typeof args.extraMeta === 'object' &&
      !Array.isArray(args.extraMeta)
        ? args.extraMeta
        : {},
  };
}

function normalizeConcerns(
  items: Array<{ name?: unknown; prob?: unknown }> | null | undefined
): Concern[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const name = String(item?.name ?? '').trim();
      const prob = Number(item?.prob);

      return {
        name,
        prob: Number.isFinite(prob) ? prob : 0,
      };
    })
    .filter((item) => item.name.length > 0);
}

function normalizeRecommendations(items: unknown): string[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => String(item ?? '').trim())
    .filter((item) => item.length > 0);
}

function normalizeExplanations(
  items:
    | Array<{
        feature?: unknown;
        impact?: unknown;
        note?: unknown;
      }>
    | null
    | undefined
): Explanation[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const feature = String(item?.feature ?? '').trim();
      const impact = Number(item?.impact);
      const note =
        item?.note === null || item?.note === undefined
          ? undefined
          : String(item.note);

      return {
        feature,
        impact: Number.isFinite(impact) ? impact : 0,
        ...(note ? { note } : {}),
      };
    })
    .filter((item) => item.feature.length > 0);
}

export default function useTriageAnalyzer(args?: TriageAnalyzerArgs) {
  const { vitals, symptoms, bmi, extraMeta } = normalizeAnalyzerArgs(args);
  const history = useSelfCheckHistory('selfcheck', 'vitals');

  const [busy, setBusy] = useState(false);
  const [healthScore, setHealthScore] = useState<number>(85);
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('low');
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [concerns, setConcerns] = useState<Concern[]>([]);
  const [explanations, setExplanations] = useState<Explanation[]>([]);
  const [analysisSource, setAnalysisSource] =
    useState<AnalysisSource>('local_fallback');
  const [degradedMode, setDegradedMode] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(null);

  const analyze = useCallback(
    async (
      payloadVitals?:
        | any[]
        | {
            vitals?: any[];
            symptoms?: Record<string, boolean>;
            bmi?: number | null;
            extraMeta?: Record<string, any>;
          },
      payloadSymptoms?: Record<string, boolean>
    ) => {
      setBusy(true);
      setRemoteError(null);

      const objectPayload =
        payloadVitals &&
        !Array.isArray(payloadVitals) &&
        typeof payloadVitals === 'object'
          ? payloadVitals
          : null;

      const usedVitals = objectPayload
        ? Array.isArray(objectPayload.vitals)
          ? objectPayload.vitals
          : vitals
        : Array.isArray(payloadVitals)
          ? payloadVitals
          : vitals;

      const usedSymptoms = objectPayload
        ? objectPayload.symptoms &&
          typeof objectPayload.symptoms === 'object' &&
          !Array.isArray(objectPayload.symptoms)
          ? objectPayload.symptoms
          : symptoms
        : payloadSymptoms ?? symptoms;

      const usedBmi =
        objectPayload && 'bmi' in objectPayload
          ? objectPayload.bmi ?? null
          : bmi;

      const usedExtraMeta = objectPayload?.extraMeta ?? extraMeta ?? {};

      try {
        const payload: {
          vitals: any[];
          symptoms: Record<string, boolean>;
          meta: Record<string, any>;
        } = {
          vitals: usedVitals,
          symptoms: usedSymptoms,
          meta: {
            clientTime: new Date().toISOString(),
            ua:
              typeof navigator !== 'undefined'
                ? navigator.userAgent
                : 'unknown',
            bmi: usedBmi,
            ...(usedExtraMeta || {}),
          },
        };

        const localServerRes = await fetch('/api/triage', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const localData = localServerRes.ok
          ? await localServerRes
              .json()
              .catch(async () =>
                clientFallbackAnalyze(
                  payload.vitals,
                  payload.symptoms,
                  usedBmi,
                  usedExtraMeta
                )
              )
          : await clientFallbackAnalyze(
              payload.vitals,
              payload.symptoms,
              usedBmi,
              usedExtraMeta
            );

        await history.append({
          vitals: payload.vitals,
          symptoms: payload.symptoms,
          bmi: usedBmi,
          meta: payload.meta,
          score: localData?.score,
        });

        const localScore = Number(localData?.score ?? 80);

        // Default to local immediately.
        setHealthScore(localScore);
        setRiskLevel(localScore > 80 ? 'low' : localScore > 50 ? 'medium' : 'high');
        setRecommendations(normalizeRecommendations(localData?.recommendations));
        setConcerns(normalizeConcerns(localData?.diagnoses));
        setExplanations(normalizeExplanations(localData?.explanations));
        setAnalysisSource('local_fallback');
        setDegradedMode(true);

        // Enrich via InsightCore.
        try {
          const remote = await analyzeSelfCheckWithInsightCore({
            vitals: payload.vitals,
            symptoms: payload.symptoms,
            meta: {
              ...payload.meta,
              localScore: localData?.score ?? null,
              localDiagnoses: localData?.diagnoses ?? [],
              localRecommendations: localData?.recommendations ?? [],
              localExplanations: localData?.explanations ?? [],
            },
          });

          setHealthScore(
            Number(remote?.summary?.healthScore ?? localData?.score ?? 80)
          );

          const nextRisk: RiskLevel =
            remote?.summary?.riskLevel === 'critical' ||
            remote?.summary?.riskLevel === 'high'
              ? 'high'
              : remote?.summary?.riskLevel === 'moderate' ||
                  remote?.summary?.riskLevel === 'watch'
                ? 'medium'
                : 'low';

          setRiskLevel(nextRisk);
          setRecommendations(
            normalizeRecommendations(
              remote?.recommendations?.length
                ? remote.recommendations
                : localData?.recommendations
            )
          );
          setConcerns(
            normalizeConcerns(
              remote?.concerns?.length
                ? remote.concerns
                : localData?.diagnoses
            )
          );
          setExplanations(
            normalizeExplanations(
              remote?.explanations?.length
                ? remote.explanations
                : localData?.explanations
            )
          );
          setAnalysisSource(
            remote?.source === 'insightcore' ? 'insightcore' : 'hybrid'
          );
          setDegradedMode(Boolean(remote?.degradedMode));

          postInsightLearningEvent({
            id: remote?.requestId,
            ts: new Date().toISOString(),
            app: 'patient-app',
            surface: 'self-check',
            inputSnapshot: {
              vitals: payload.vitals,
              symptoms: payload.symptoms,
              medications: payload.meta?.medicationAdherence,
              wearable: payload.meta?.wearableDrivers,
              domain: {
                bodyAreas: payload.meta?.bodyAreas || [],
              },
            },
            outputSnapshot: {
              riskLabel: remote?.summary?.riskLabel,
              riskLevel: remote?.summary?.riskLevel,
              healthScore: remote?.summary?.healthScore,
              concerns: (remote?.concerns || []).map((c: any) => c.name),
              recommendations: remote?.recommendations || [],
              confidence: remote?.summary?.confidence ?? null,
              degradedMode: remote?.degradedMode,
              source: remote?.source,
            },
            userAction: {
              action: 'viewed',
            },
          }).catch(() => undefined);
        } catch {
          setRemoteError('InsightCore unavailable, using local fallback.');
        }
      } catch {
        const fallback = await clientFallbackAnalyze(
          usedVitals,
          usedSymptoms,
          usedBmi,
          usedExtraMeta
        );

        setHealthScore(fallback.score);
        setRecommendations(normalizeRecommendations(fallback.recommendations));
        setConcerns(normalizeConcerns(fallback.diagnoses));
        setExplanations(normalizeExplanations(fallback.explanations));
        setRiskLevel(
          fallback.score > 80 ? 'low' : fallback.score > 50 ? 'medium' : 'high'
        );
        setAnalysisSource('local_fallback');
        setDegradedMode(true);
        setRemoteError('Local fallback only.');
      } finally {
        setHasAnalyzed(true);
        setLastAnalyzedAt(new Date().toISOString());
        setBusy(false);
      }
    },
    [vitals, symptoms, bmi, extraMeta, history]
  );

  const riskLabel = useMemo(
    () =>
      riskLevel === 'low'
        ? 'All good'
        : riskLevel === 'medium'
          ? 'Monitor'
          : 'Follow up',
    [riskLevel]
  );

  return {
    busy,
    healthScore,
    riskLevel,
    riskLabel,
    recommendations,
    concerns,
    explanations,
    analysisSource,
    degradedMode,
    remoteError,
    hasAnalyzed,
    lastAnalyzedAt,
    confidence: healthScore,
    analyze,
    runAnalyze: analyze,
    history,
  };
}