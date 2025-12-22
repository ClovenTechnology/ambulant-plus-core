'use client';

import { useMemo, useState } from 'react';

import useProfileBMI from '@/src/hooks/selfcheck/useProfileBMI';
import useTriageAnalyzer from '@/src/hooks/selfcheck/useTriageAnalyzer';

import { computeCardioRisk, hypertensionIndex } from '@/src/analytics/cardio';
import { computeStressIndex } from '@/src/analytics/stress';

import type { SelfCheckStep } from '@/components/selfcheck/SelfCheckStepper';
import type { BodyAreaKey, BodySide, BodyAreaBase } from '@/components/selfcheck/BodyMap2D';

export type Vital = {
  label: string;
  key: string;
  value: any;
  unit?: string;
  min?: number;
  max?: number;
  trend?: number[];
};

export const SELF_CHECK_SYMPTOMS = [
  { key: 'fever', label: 'Fever' },
  { key: 'cough', label: 'Cough' },
  { key: 'sob', label: 'Shortness of breath' },
  { key: 'dizzy', label: 'Dizziness' },
  { key: 'fatigue', label: 'Fatigue' },
] as const;

export type SymptomKey = (typeof SELF_CHECK_SYMPTOMS)[number]['key'];

function legacyFromKeys(keys: BodyAreaKey[]): BodyAreaBase[] {
  return keys.map((k) => k.split(':')[1] as BodyAreaBase);
}

export function useSelfCheckState() {
  const bmi = useProfileBMI();

  const [step, setStep] = useState<SelfCheckStep>('data');

  const [vitals, setVitals] = useState<Vital[]>(() => [
    { label: 'Heart Rate', key: 'hr', value: 78, unit: 'bpm', min: 50, max: 100, trend: [72, 74, 76, 78, 77] },
    { label: 'SpO₂', key: 'spo2', value: 97, unit: '%', min: 90, max: 100, trend: [96, 96, 97, 97, 97] },
    { label: 'BP', key: 'bp', value: '120/80', unit: 'mmHg', trend: [118, 120, 122, 121, 120] },
    { label: 'Temp', key: 'temp', value: 36.8, unit: '°C', min: 36, max: 37.5, trend: [36.6, 36.7, 36.8, 36.8, 36.8] },
  ]);

  const [symptoms, setSymptoms] = useState<Record<string, boolean>>(
    () => Object.fromEntries(SELF_CHECK_SYMPTOMS.map((s) => [s.key, false]))
  );

  // Body map
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [view, setView] = useState<BodySide>('front');
  const [areas, setAreas] = useState<BodyAreaKey[]>([]);

  // NEW: results gating
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<number | null>(null);

  const toggleArea = (k: BodyAreaKey) => {
    setAreas((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  };

  const selectedSymptoms = useMemo(
    () => SELF_CHECK_SYMPTOMS.filter((s) => !!symptoms[s.key]).map((s) => s.label),
    [symptoms]
  );

  const abnormal = useMemo(() => {
    return vitals
      .map((v) =>
        typeof v.value === 'number' && v.min != null && v.max != null && (v.value < v.min || v.value > v.max)
          ? v.label
          : null
      )
      .filter(Boolean) as string[];
  }, [vitals]);

  const analyzer = useTriageAnalyzer({
    vitals,
    symptoms,
    bmi,
    extraMeta: {
      bodyAreas: areas, // NEW (front/back)
      bodyAreasLegacy: legacyFromKeys(areas), // OLD (safe)
      bodyMap: { gender, view },
    },
  });

  const riskColor =
    analyzer.riskLevel === 'low'
      ? 'bg-emerald-600 text-white'
      : analyzer.riskLevel === 'medium'
      ? 'bg-amber-400 text-slate-900'
      : 'bg-rose-600 text-white';

  const cardioAnalytics = useMemo(() => {
    const bpEntry = vitals.find((v) => v.key === 'bp');
    let systolicTrend: number[] = [];
    let diastolicTrend: number[] = [];

    if (bpEntry) {
      if (Array.isArray(bpEntry.trend) && bpEntry.trend.length > 0 && bpEntry.trend.every((n: any) => Number.isFinite(n))) {
        systolicTrend = bpEntry.trend.map((n: any) => Number(n));
      } else if (typeof bpEntry.value === 'string' && bpEntry.value.includes('/')) {
        const parts = bpEntry.value.split('/').map((p) => Number(p.trim()));
        if (parts.length >= 2 && parts.every(Number.isFinite)) {
          systolicTrend = [parts[0]];
          diastolicTrend = [parts[1]];
        }
      }
    }

    const restingHR = (vitals.find((v) => v.key === 'hr')?.value as number) ?? 60;
    const spo2 = (vitals.find((v) => v.key === 'spo2')?.value as number) ?? 98;

    const cardio = computeCardioRisk(
      systolicTrend.length ? systolicTrend : [120],
      diastolicTrend.length ? diastolicTrend : undefined,
      restingHR,
      spo2
    );
    const hypeIndex = hypertensionIndex(systolicTrend.length ? systolicTrend : [120]);
    return { cardio, hypeIndex };
  }, [vitals]);

  const stressAnalytics = useMemo(() => {
    const restingHR = (vitals.find((v) => v.key === 'hr')?.value as number) ?? 60;
    const daytimeStress = symptoms['fatigue'] ? 60 : 30;
    const hrvVal = (vitals.find((v) => v.key === 'hrv' || v.key === 'hrv_ms')?.value as number) ?? null;

    return hrvVal != null
      ? computeStressIndex(hrvVal, daytimeStress, 0, { inputType: 'hrv' })
      : computeStressIndex(restingHR, daytimeStress, 0, { inputType: 'rhr' });
  }, [vitals, symptoms]);

  const trendSummary = useMemo(() => {
    const summary: string[] = [];
    for (const v of vitals) {
      if (Array.isArray(v.trend) && v.trend.length >= 2) {
        const last = v.trend[v.trend.length - 1];
        const prev = v.trend[v.trend.length - 2];
        if (typeof last === 'number' && typeof prev === 'number') {
          if (last > prev + Math.max(0.5, prev * 0.02)) summary.push(`${v.label} trending up`);
          else if (last < prev - Math.max(0.5, prev * 0.02)) summary.push(`${v.label} trending down`);
          else summary.push(`${v.label} stable`);
        }
      }
    }
    return summary;
  }, [vitals]);

  const timeline = useMemo(() => {
    const items = analyzer.history.items || [];
    const simple = items
      .slice(-10)
      .map((h: any) => ({
        date: h?.timestamp ? new Date(h.timestamp).toISOString().slice(0, 10) : '—',
        score: Number(h?.data?.score ?? h?.data?.result?.score ?? 0) || 0,
      }))
      .filter((x) => x.score > 0);

    return simple;
  }, [analyzer.history.items]);

  const confidence = useMemo(() => {
    const vitalsFilled = vitals.filter((v) => v.value != null && v.value !== '').length;
    const symptomCount = selectedSymptoms.length;
    const bodyCount = areas.length;

    const points = vitalsFilled * 1.0 + symptomCount * 1.2 + bodyCount * 0.8;

    if (points >= 8) return { level: 'High' as const, note: 'Good input coverage' };
    if (points >= 5) return { level: 'Moderate' as const, note: 'Some inputs missing' };
    return { level: 'Low' as const, note: 'Limited inputs provided' };
  }, [vitals, selectedSymptoms.length, areas.length]);

  const canOpenResults = hasAnalyzed && !analyzer.busy;

  async function runAnalyze() {
    await analyzer.analyze();
    setHasAnalyzed(true);
    setLastAnalyzedAt(Date.now());
    setStep('results');
    document.querySelector('#selfcheck-root')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function safeCopy(obj: any) {
    try {
      await navigator.clipboard?.writeText(JSON.stringify(obj, null, 2));
    } catch {}
  }

  return {
    bmi,

    step,
    setStep,

    vitals,
    setVitals,

    symptoms,
    setSymptoms,
    selectedSymptoms,

    gender,
    setGender,
    view,
    setView,
    areas,
    setAreas,
    toggleArea,

    abnormal,

    analyzer,
    riskColor,

    cardioAnalytics,
    stressAnalytics,
    trendSummary,
    timeline,

    confidence,

    hasAnalyzed,
    lastAnalyzedAt,
    canOpenResults,

    runAnalyze,
    safeCopy,
  };
}
