'use client';

import { useCallback, useMemo, useState } from 'react';
import { computeCardioRisk, hypertensionIndex } from '@/src/analytics/cardio';
import { computeStressIndex } from '@/src/analytics/stress';
import useSelfCheckHistory from './useSelfCheckHistory';

type RiskLevel = 'low' | 'medium' | 'high';

async function clientFallbackAnalyze(vitals: any[], symptoms: Record<string, boolean>, bmi: number | null) {
  const symptomCount = Object.values(symptoms).filter(Boolean).length;
  const res = await new Promise((resv) =>
    setTimeout(
      () =>
        resv({
          score: Math.max(0, Math.round((bmi && bmi >= 18.5 && bmi < 25 ? 90 : 80) - symptomCount * 7)),
          recommendations: ['Keep hydrated, rest and monitor symptoms.'],
          explanations: [
            { feature: 'Symptoms count', impact: -0.07 * symptomCount, note: `${symptomCount} active` },
            ...(bmi ? [{ feature: 'BMI', impact: bmi >= 25 ? -0.05 : 0.05, note: `${bmi.toFixed(1)}` }] : []),
          ],
        }),
      450
    )
  );
  return res as any;
}

function extractSystolicFromEntry(v: any): number | null {
  try {
    if (!v) return null;
    if (typeof v.value === 'string' && v.value.includes('/')) {
      const parts = v.value.split('/').map((p: any) => Number(p.trim()));
      if (parts.length >= 1 && Number.isFinite(parts[0])) return parts[0];
    }
    if (Array.isArray(v.trend) && v.trend.length && Number.isFinite(v.trend[v.trend.length - 1])) {
      return Number(v.trend[v.trend.length - 1]);
    }
    return null;
  } catch {
    return null;
  }
}

export default function useTriageAnalyzer(args: {
  vitals: any[];
  symptoms: Record<string, boolean>;
  bmi: number | null;
  extraMeta?: Record<string, any>;
}) {
  const { vitals, symptoms, bmi, extraMeta } = args;
  const history = useSelfCheckHistory('selfcheck', 'vitals');

  const [busy, setBusy] = useState(false);
  const [healthScore, setHealthScore] = useState<number>(85);
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('low');
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [concerns, setConcerns] = useState<{ name: string; prob: number }[]>([]);
  const [explanations, setExplanations] = useState<{ feature: string; impact: number; note?: string }[]>([]);

  const analyze = useCallback(async (payloadVitals?: any[], payloadSymptoms?: Record<string, boolean>) => {
    setBusy(true);

    const usedVitals = payloadVitals ?? vitals;
    const usedSymptoms = payloadSymptoms ?? symptoms;

    try {
      const payload = {
        vitals: usedVitals,
        symptoms: usedSymptoms,
        meta: {
          clientTime: new Date().toISOString(),
          ua: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          bmi,
          ...(extraMeta || {}),
        },
      };

      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const serverData = res.ok
        ? await res.json().catch(async () => await clientFallbackAnalyze(payload.vitals, payload.symptoms, bmi))
        : await clientFallbackAnalyze(payload.vitals, payload.symptoms, bmi);

      // persist snapshot
      await history.append({ vitals: payload.vitals, symptoms: payload.symptoms, bmi, meta: payload.meta });

      const score = serverData?.score ?? 80;
      setHealthScore(score);
      setRiskLevel(score > 80 ? 'low' : score > 50 ? 'medium' : 'high');

      const bpEntry = (payload.vitals || []).find((v: any) => v.key === 'bp');
      const bpTrend = bpEntry?.trend ?? [];
      const restingHR = (payload.vitals || []).find((v: any) => v.key === 'hr')?.value ?? 60;
      const spo2 = (payload.vitals || []).find((v: any) => v.key === 'spo2')?.value ?? 98;

      const hrvVal = (payload.vitals || []).find((v: any) => v.key === 'hrv' || v.key === 'hrv_ms')?.value ?? null;

      // diastolic for cardio
      let diastolicArr: number[] = [];
      if (typeof bpEntry?.value === 'string' && bpEntry.value.includes('/')) {
        const parts = bpEntry.value.split('/').map((p: any) => Number(p.trim()));
        if (parts.length >= 2 && parts.every(Number.isFinite)) diastolicArr = [parts[1]];
      }

      const systolicForCall =
        Array.isArray(bpTrend) && bpTrend.length
          ? bpTrend
          : (() => {
              const s = extractSystolicFromEntry(bpEntry);
              return s != null ? [s] : [120];
            })();

      const cardio = computeCardioRisk(systolicForCall, diastolicArr.length ? diastolicArr : undefined, restingHR, spo2);
      const hypeIndex = hypertensionIndex(Array.isArray(bpTrend) && bpTrend.length ? bpTrend : [120]);

      const daytimeStress = usedSymptoms['fatigue'] ? 60 : 30;
      const stress = hrvVal != null
        ? computeStressIndex(hrvVal, daytimeStress, 0, { inputType: 'hrv' })
        : computeStressIndex(restingHR, daytimeStress, 0, { inputType: 'rhr' });

      // trends (short)
      const trendSummary: string[] = [];
      for (const v of payload.vitals || []) {
        if (Array.isArray(v.trend) && v.trend.length >= 2) {
          const last = v.trend[v.trend.length - 1];
          const prev = v.trend[v.trend.length - 2];
          if (typeof last === 'number' && typeof prev === 'number') {
            if (last > prev + Math.max(0.5, prev * 0.02)) trendSummary.push(`${v.label} trending up`);
            else if (last < prev - Math.max(0.5, prev * 0.02)) trendSummary.push(`${v.label} trending down`);
            else trendSummary.push(`${v.label} stable`);
          }
        }
      }

      // recommendations
      const recs: string[] = [];
      if (restingHR > 90 && spo2 >= 92) recs.push('Hydrate and rest for 30–60 minutes, then re-check.');
      if (usedSymptoms.fatigue || restingHR > 85) recs.push('Sleep hygiene: aim for 7–9 hours with a wind-down routine.');
      recs.push('If comfortable, a 20–30 minute walk today supports circulation.');
      if (stress.index > 60) recs.push('Try 10 minutes of breathing / guided relaxation.');
      if (usedSymptoms.fever || usedSymptoms.cough) recs.push('Light meals + fluids. Avoid skipping meals.');

      if (hypeIndex > 60) recs.unshift('BP concern: monitor and discuss with your clinician if elevated readings persist.');
      if (trendSummary.length) recs.push(`Trends: ${trendSummary.join('; ')}.`);

      setRecommendations(recs);

      const serverConcerns = Array.isArray(serverData?.diagnoses)
        ? serverData.diagnoses.map((d: any) => ({ name: d.name, prob: d.prob }))
        : [];
      setConcerns(serverConcerns);

      // explanations
      const expl: { feature: string; impact: number; note?: string }[] = [];
      const symptomCount = Object.values(payload.symptoms || {}).filter(Boolean).length;
      if (symptomCount > 0) expl.push({ feature: 'Symptoms active', impact: -symptomCount * 0.07, note: `${symptomCount} active` });
      expl.push({ feature: 'Resting HR', impact: -(restingHR - 60) / 200, note: `${restingHR} bpm` });
      expl.push({ feature: 'SpO₂', impact: (Math.min(100, spo2) - 95) / 200, note: `${spo2}%` });
      expl.push({ feature: 'Hypertension index', impact: -(hypeIndex / 300), note: `${hypeIndex}/100` });
      expl.push({ feature: 'Cardio note', impact: 0, note: cardio.notes });

      setExplanations(
        expl.map((e) => ({
          feature: e.feature,
          impact: Math.max(-1, Math.min(1, e.impact)),
          note: e.note,
        }))
      );
    } catch (err) {
      // fallback
      const fallback = await clientFallbackAnalyze(usedVitals, usedSymptoms, bmi);
      setHealthScore(fallback.score);
      setRecommendations(fallback.recommendations || []);
      setConcerns(fallback.diagnoses || []);
      setExplanations(fallback.explanations || []);
      setRiskLevel(fallback.score > 80 ? 'low' : fallback.score > 50 ? 'medium' : 'high');
    } finally {
      setBusy(false);
    }
  }, [vitals, symptoms, bmi, extraMeta, history]);

  const riskLabel = useMemo(() => (
    riskLevel === 'low' ? 'All good' : riskLevel === 'medium' ? 'Monitor' : 'Follow up'
  ), [riskLevel]);

  return {
    busy,
    healthScore,
    riskLevel,
    riskLabel,
    recommendations,
    concerns,
    explanations,
    analyze,
    history,
  };
}
