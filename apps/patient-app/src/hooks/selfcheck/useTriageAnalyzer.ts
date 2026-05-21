'use client';

import { useCallback, useMemo, useState } from 'react';
import useSelfCheckHistory from './useSelfCheckHistory';
import {
  analyzeSelfCheckWithInsightCore,
  postInsightLearningEvent,
} from '@/src/lib/insightcore/api';

type RiskLevel = 'low' | 'medium' | 'high';
type AnalysisSource = 'insightcore';

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
    useState<AnalysisSource>('insightcore');
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

        await history.append({
          vitals: payload.vitals,
          symptoms: payload.symptoms,
          bmi: usedBmi,
          meta: payload.meta,
          score: null,
        });

        const remote = await analyzeSelfCheckWithInsightCore({
          vitals: payload.vitals,
          symptoms: payload.symptoms,
          meta: payload.meta,
        });

        const score = Number(remote?.summary?.healthScore ?? 80);

        setHealthScore(score);

        const nextRisk: RiskLevel =
          remote?.summary?.riskLevel === 'critical' ||
          remote?.summary?.riskLevel === 'high'
            ? 'high'
            : remote?.summary?.riskLevel === 'moderate' ||
                remote?.summary?.riskLevel === 'watch'
              ? 'medium'
              : 'low';

        setRiskLevel(nextRisk);
        setRecommendations(normalizeRecommendations(remote?.recommendations));
        setConcerns(normalizeConcerns(remote?.concerns));
        setExplanations(normalizeExplanations(remote?.explanations));
        setAnalysisSource('insightcore');
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
            source: 'insightcore',
          },
          userAction: {
            action: 'viewed',
          },
        }).catch(() => undefined);
      } catch (err: any) {
        setRemoteError(err?.message || 'InsightCore self-check failed.');
        setDegradedMode(true);
        setAnalysisSource('insightcore');
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