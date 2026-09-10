'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  analyzeSelfCheckWithInsightCore,
  postInsightLearningEvent,
  type PatientInsightResponse,
} from '@/src/lib/insightcore/api';

export type SelfCheckRiskLevel = 'low' | 'medium' | 'high';

type Concern = {
  name: string;
  prob: number | null;
};

type Explanation = {
  feature: string;
  impact: number | null;
  note: string | null;
};

type TriageAnalyzerArgs = {
  vitals?: any[];
  symptoms?: Record<string, boolean>;
  bmi?: number | null;
  extraMeta?: Record<string, any>;
};

function normalizeAnalyzerArgs(args?: TriageAnalyzerArgs): Required<TriageAnalyzerArgs> {
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

function normalizeScore(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

function normalizeRiskLevel(value: unknown): SelfCheckRiskLevel | null {
  if (value === 'high' || value === 'critical') return 'high';
  if (value === 'moderate' || value === 'watch') return 'medium';
  if (value === 'low') return 'low';
  return null;
}

function normalizeConcerns(items: PatientInsightResponse['concerns'] | null | undefined): Concern[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const name = String(item?.name ?? '').trim();
      const prob = normalizeScore(item?.prob);
      return name ? { name, prob } : null;
    })
    .filter((item): item is Concern => Boolean(item));
}

function normalizeRecommendations(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => String(item ?? '').trim()).filter(Boolean);
}

function normalizeExplanations(
  items: PatientInsightResponse['explanations'] | null | undefined,
): Explanation[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const feature = String(item?.feature ?? '').trim();
      if (!feature) return null;
      const impact =
        item?.impact === null || item?.impact === undefined
          ? null
          : Number.isFinite(Number(item.impact))
            ? Number(item.impact)
            : null;
      const note =
        item?.note === null || item?.note === undefined
          ? null
          : String(item.note).trim() || null;
      return { feature, impact, note };
    })
    .filter((item): item is Explanation => Boolean(item));
}

export default function useTriageAnalyzer(args?: TriageAnalyzerArgs) {
  const { vitals, symptoms, bmi, extraMeta } = normalizeAnalyzerArgs(args);

  const [busy, setBusy] = useState(false);
  const [healthScore, setHealthScore] = useState<number | null>(null);
  const [riskLevel, setRiskLevel] = useState<SelfCheckRiskLevel | null>(null);
  const [riskLabel, setRiskLabel] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [concerns, setConcerns] = useState<Concern[]>([]);
  const [explanations, setExplanations] = useState<Explanation[]>([]);
  const [result, setResult] = useState<PatientInsightResponse | null>(null);
  const [degradedMode, setDegradedMode] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(null);

  const resetResult = useCallback(() => {
    setHealthScore(null);
    setRiskLevel(null);
    setRiskLabel(null);
    setConfidence(null);
    setRecommendations([]);
    setConcerns([]);
    setExplanations([]);
    setResult(null);
    setDegradedMode(false);
    setRemoteError(null);
    setHasAnalyzed(false);
    setLastAnalyzedAt(null);
  }, []);

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
      payloadSymptoms?: Record<string, boolean>,
    ): Promise<PatientInsightResponse | null> => {
      setBusy(true);
      setRemoteError(null);
      setHasAnalyzed(false);

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
        const learningBodyAreas = Array.isArray(usedExtraMeta.bodyAreas)
          ? usedExtraMeta.bodyAreas
          : [];

        const payload = {
          vitals: usedVitals,
          symptoms: usedSymptoms,
          meta: {
            clientTime: new Date().toISOString(),
            bmi: usedBmi,
            ...(usedExtraMeta || {}),
          },
        };

        const remote = await analyzeSelfCheckWithInsightCore(payload);

        if (!remote || remote.source !== 'insightcore') {
          throw new Error('invalid_insightcore_source');
        }

        if (remote.degradedMode) {
          throw new Error('insightcore_degraded_result');
        }

        const nextRiskLevel = normalizeRiskLevel(remote.summary?.riskLevel);
        const nextRiskLabel = String(remote.summary?.riskLabel ?? '').trim();

        if (!nextRiskLevel || !nextRiskLabel) {
          throw new Error('incomplete_insightcore_result');
        }

        const nextHealthScore = normalizeScore(remote.summary?.healthScore);
        const nextConfidence = normalizeScore(remote.summary?.confidence);
        const completedAt = new Date().toISOString();

        setHealthScore(nextHealthScore);
        setRiskLevel(nextRiskLevel);
        setRiskLabel(nextRiskLabel);
        setConfidence(nextConfidence);
        setRecommendations(normalizeRecommendations(remote.recommendations));
        setConcerns(normalizeConcerns(remote.concerns));
        setExplanations(normalizeExplanations(remote.explanations));
        setResult(remote);
        setDegradedMode(false);
        setHasAnalyzed(true);
        setLastAnalyzedAt(completedAt);

        void postInsightLearningEvent({
          id: remote.requestId,
          ts: completedAt,
          app: 'patient-app',
          surface: 'self-check',
          inputSnapshot: {
            vitals: payload.vitals,
            symptoms: payload.symptoms,
            domain: {
              bodyAreas: learningBodyAreas,
            },
          },
          outputSnapshot: {
            riskLabel: remote.summary.riskLabel,
            riskLevel: remote.summary.riskLevel,
            healthScore: remote.summary.healthScore ?? null,
            confidence: remote.summary.confidence ?? null,
            source: 'insightcore',
          },
          userAction: { action: 'viewed' },
        }).catch(() => undefined);

        return remote;
      } catch {
        setHealthScore(null);
        setRiskLevel(null);
        setRiskLabel(null);
        setConfidence(null);
        setRecommendations([]);
        setConcerns([]);
        setExplanations([]);
        setResult(null);
        setDegradedMode(true);
        setRemoteError('Self-check analysis is temporarily unavailable. Please retry.');
        setHasAnalyzed(false);
        setLastAnalyzedAt(null);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [vitals, symptoms, bmi, extraMeta],
  );

  const analysisSource = 'insightcore' as const;

  return useMemo(
    () => ({
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
      confidence,
      result,
      analyze,
      runAnalyze: analyze,
      reset: resetResult,
    }),
    [
      busy,
      healthScore,
      riskLevel,
      riskLabel,
      recommendations,
      concerns,
      explanations,
      degradedMode,
      remoteError,
      hasAnalyzed,
      lastAnalyzedAt,
      confidence,
      result,
      analyze,
      resetResult,
    ],
  );
}
