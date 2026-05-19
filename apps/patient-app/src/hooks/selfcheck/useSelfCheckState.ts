'use client';

import { useCallback, useMemo, useState } from 'react';

import useProfileBMI from '@/src/hooks/selfcheck/useProfileBMI';
import useTriageAnalyzer from '@/src/hooks/selfcheck/useTriageAnalyzer';

import { computeCardioRisk, hypertensionIndex } from '@/src/analytics/cardio';
import { computeStressIndex } from '@/src/analytics/stress';

import type { SelfCheckStep } from '@/components/selfcheck/SelfCheckStepper';
import type { BodyAreaKey, BodySide, BodyArea as BodyAreaBase } from '@/components/selfcheck/BodyMap2D';

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

type Gender = 'female' | 'male' | 'other' | 'unknown';
type SymptomState = Record<SymptomKey, boolean>;

type SafeAnalyzer = {
  analysisSource?: string;
  degradedMode?: boolean;
  remoteError?: string | null;
  result?: any;
  risk?: string;
  riskLevel?: string;
  confidence?: number;
  hasAnalyzed?: boolean;
  lastAnalyzedAt?: string | Date | null;
  analyze?: (payload?: any) => Promise<any> | any;
  runAnalyze?: (payload?: any) => Promise<any> | any;
  reset?: () => void;
  [key: string]: any;
};

const DEFAULT_VITALS: Vital[] = [
  {
    label: 'Temperature',
    key: 'temperature',
    value: '',
    unit: '°C',
    min: 36,
    max: 37.8,
    trend: [],
  },
  {
    label: 'Heart rate',
    key: 'heartRate',
    value: '',
    unit: 'bpm',
    min: 50,
    max: 110,
    trend: [],
  },
  {
    label: 'Oxygen saturation',
    key: 'spo2',
    value: '',
    unit: '%',
    min: 94,
    max: 100,
    trend: [],
  },
  {
    label: 'Systolic blood pressure',
    key: 'systolic',
    value: '',
    unit: 'mmHg',
    min: 90,
    max: 140,
    trend: [],
  },
  {
    label: 'Diastolic blood pressure',
    key: 'diastolic',
    value: '',
    unit: 'mmHg',
    min: 60,
    max: 90,
    trend: [],
  },
  {
    label: 'Glucose',
    key: 'glucose',
    value: '',
    unit: 'mg/dL',
    min: 70,
    max: 180,
    trend: [],
  },
];

function legacyFromKeys(keys: BodyAreaKey[]): BodyAreaBase[] {
  return keys.map((k) => String(k).split(':')[1] as BodyAreaBase);
}

function numberOrUndefined(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function symptomDefaults(): SymptomState {
  return SELF_CHECK_SYMPTOMS.reduce((acc, symptom) => {
    acc[symptom.key] = false;
    return acc;
  }, {} as SymptomState);
}

function riskToColor(risk: unknown) {
  const value = String(risk ?? '').toLowerCase();

  if (['critical', 'emergency', 'red', 'high'].some((x) => value.includes(x))) {
    return 'rose';
  }

  if (['urgent', 'amber', 'moderate', 'medium'].some((x) => value.includes(x))) {
    return 'amber';
  }

  if (['low', 'green', 'routine', 'self-care', 'selfcare'].some((x) => value.includes(x))) {
    return 'emerald';
  }

  return 'slate';
}

function buildTrendSummary(vitals: Vital[]) {
  return vitals
    .filter((v) => Array.isArray(v.trend) && v.trend.length > 0)
    .map((v) => {
      const trend = v.trend || [];
      const first = trend[0];
      const last = trend[trend.length - 1];
      const delta = typeof first === 'number' && typeof last === 'number' ? last - first : 0;

      return {
        key: v.key,
        label: v.label,
        unit: v.unit,
        first,
        last,
        delta,
        direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
      };
    });
}

function buildTimeline(vitals: Vital[], selectedSymptoms: SymptomKey[], areas: BodyAreaKey[]) {
  return [
    {
      id: 'symptoms',
      label: 'Symptoms selected',
      value: selectedSymptoms.length,
      at: new Date().toISOString(),
    },
    {
      id: 'body-areas',
      label: 'Body areas selected',
      value: areas.length,
      at: new Date().toISOString(),
    },
    {
      id: 'vitals',
      label: 'Vitals entered',
      value: vitals.filter((v) => numberOrUndefined(v.value) !== undefined).length,
      at: new Date().toISOString(),
    },
  ];
}

export function useSelfCheckState() {
  const bmi = useProfileBMI();
  const analyzer = useTriageAnalyzer() as SafeAnalyzer;

  const [step, setStep] = useState<SelfCheckStep>('symptoms' as SelfCheckStep);
  const [vitals, setVitals] = useState<Vital[]>(DEFAULT_VITALS);
  const [symptoms, setSymptoms] = useState<SymptomState>(() => symptomDefaults());
  const [gender, setGender] = useState<Gender>('unknown');
  const [view, setView] = useState<BodySide>('front' as BodySide);
  const [areas, setAreas] = useState<BodyAreaKey[]>([]);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(null);

  const selectedSymptoms = useMemo(
    () => SELF_CHECK_SYMPTOMS.filter((s) => symptoms[s.key]).map((s) => s.key),
    [symptoms],
  );

  const toggleArea = useCallback(
    (area: BodyAreaKey | BodyAreaBase) => {
      const raw = String(area);
      const key = (raw.includes(':') ? raw : `${view}:${raw}`) as BodyAreaKey;

      setAreas((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
    },
    [view],
  );

  const abnormal = useMemo(
    () =>
      vitals.filter((v) => {
        const n = numberOrUndefined(v.value);
        if (n === undefined) return false;
        if (typeof v.min === 'number' && n < v.min) return true;
        if (typeof v.max === 'number' && n > v.max) return true;
        return false;
      }),
    [vitals],
  );

  const vitalValues = useMemo(() => {
    const get = (key: string) => numberOrUndefined(vitals.find((v) => v.key === key)?.value);

    return {
      temperature: get('temperature'),
      heartRate: get('heartRate'),
      spo2: get('spo2'),
      systolic: get('systolic'),
      diastolic: get('diastolic'),
      glucose: get('glucose'),
    };
  }, [vitals]);

  const cardioAnalytics = useMemo(() => {
    try {
      const computeCardioRiskAny = computeCardioRisk as unknown as (...args: any[]) => any;
      const hypertensionIndexAny = hypertensionIndex as unknown as (...args: any[]) => any;

      return {
        risk: computeCardioRiskAny({
          systolic: vitalValues.systolic,
          diastolic: vitalValues.diastolic,
          heartRate: vitalValues.heartRate,
          spo2: vitalValues.spo2,
          bmi,
        }),
        hypertensionIndex: hypertensionIndexAny(vitalValues.systolic, vitalValues.diastolic),
      };
    } catch {
      return {
        risk: null,
        hypertensionIndex: null,
      };
    }
  }, [bmi, vitalValues.diastolic, vitalValues.heartRate, vitalValues.spo2, vitalValues.systolic]);

  const stressAnalytics = useMemo(() => {
    try {
      const computeStressIndexAny = computeStressIndex as unknown as (...args: any[]) => any;

      return computeStressIndexAny({
        heartRate: vitalValues.heartRate,
        symptoms: selectedSymptoms,
        abnormalVitals: abnormal,
      });
    } catch {
      return null;
    }
  }, [abnormal, selectedSymptoms, vitalValues.heartRate]);

  const trendSummary = useMemo(() => buildTrendSummary(vitals), [vitals]);
  const timeline = useMemo(() => buildTimeline(vitals, selectedSymptoms, areas), [areas, selectedSymptoms, vitals]);

  const confidence = useMemo(() => {
    if (typeof analyzer.confidence === 'number') return analyzer.confidence;

    const enteredVitals = vitals.filter((v) => numberOrUndefined(v.value) !== undefined).length;
    const symptomScore = selectedSymptoms.length > 0 ? 35 : 0;
    const vitalScore = Math.min(40, enteredVitals * 8);
    const bodyScore = areas.length > 0 ? 15 : 0;
    const bmiScore = bmi ? 10 : 0;

    return Math.min(100, symptomScore + vitalScore + bodyScore + bmiScore);
  }, [analyzer.confidence, areas.length, bmi, selectedSymptoms.length, vitals]);

  const riskColor = useMemo(
    () => riskToColor(analyzer.riskLevel ?? analyzer.risk ?? analyzer.result?.riskLevel ?? analyzer.result?.risk),
    [analyzer.risk, analyzer.riskLevel, analyzer.result],
  );

  const profileContext = useMemo(
    () => ({
      bmi,
      gender,
      bodyAreas: areas,
      legacyBodyAreas: legacyFromKeys(areas),
    }),
    [areas, bmi, gender],
  );

  const medicationContext = useMemo(
    () => ({
      medications: [],
      allergies: [],
    }),
    [],
  );

  const wearableContext = useMemo(
    () => ({
      vitals,
      abnormal,
      trends: trendSummary,
    }),
    [abnormal, trendSummary, vitals],
  );

  const canOpenResults = hasAnalyzed || Boolean(analyzer.hasAnalyzed);

  const runAnalyze = useCallback(async () => {
    const payload = {
      bmi,
      step,
      vitals,
      symptoms,
      selectedSymptoms,
      gender,
      view,
      areas,
      legacyAreas: legacyFromKeys(areas),
      abnormal,
      cardioAnalytics,
      stressAnalytics,
      trendSummary,
      timeline,
      confidence,
      profileContext,
      medicationContext,
      wearableContext,
    };

    const fn = typeof analyzer.runAnalyze === 'function' ? analyzer.runAnalyze : analyzer.analyze;

    const result = typeof fn === 'function' ? await fn(payload) : null;

    setHasAnalyzed(true);
    setLastAnalyzedAt(new Date().toISOString());

    return result;
  }, [
    abnormal,
    analyzer,
    areas,
    bmi,
    cardioAnalytics,
    confidence,
    gender,
    medicationContext,
    profileContext,
    selectedSymptoms,
    step,
    stressAnalytics,
    symptoms,
    timeline,
    trendSummary,
    view,
    vitals,
    wearableContext,
  ]);

  const safeCopy = useCallback(async (text?: string) => {
    const value = String(text ?? '');
    if (!value) return false;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {
      return false;
    }

    return false;
  }, []);

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
    analysisSource: analyzer.analysisSource,
    degradedMode: analyzer.degradedMode,
    remoteError: analyzer.remoteError,
    riskColor,

    cardioAnalytics,
    stressAnalytics,
    trendSummary,
    timeline,

    confidence,

    hasAnalyzed: hasAnalyzed || Boolean(analyzer.hasAnalyzed),
    lastAnalyzedAt: lastAnalyzedAt ?? analyzer.lastAnalyzedAt ?? null,
    canOpenResults,

    profileContext,
    medicationContext,
    wearableContext,

    runAnalyze,
    safeCopy,
  };
}