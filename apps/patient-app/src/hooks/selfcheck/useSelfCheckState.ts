'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import useProfileBMI from '@/src/hooks/selfcheck/useProfileBMI';
import useTriageAnalyzer from '@/src/hooks/selfcheck/useTriageAnalyzer';

import type { SelfCheckStep } from '@/components/selfcheck/SelfCheckStepper';
import type { BodyArea, BodyAreaKey, BodySide } from '@/components/selfcheck/BodyMap2D';

export type Vital = {
  label: string;
  key: string;
  value: number | string | null | undefined;
  unit?: string;
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
type ProfileGender = 'female' | 'male' | 'other' | 'unknown';

type SelfCheckProfileContext = {
  loaded: boolean;
  error: boolean;
  gender: ProfileGender;
  age: number | null;
  bmi: number | null;
  heightCm: number | null;
  weightKg: number | null;
  chronicConditions: string[];
  allergies: string[];
  hasProfileGender: boolean;
};

const EMPTY_PROFILE_CONTEXT: SelfCheckProfileContext = {
  loaded: false,
  error: false,
  gender: 'unknown',
  age: null,
  bmi: null,
  heightCm: null,
  weightKg: null,
  chronicConditions: [],
  allergies: [],
  hasProfileGender: false,
};

const DEFAULT_VITALS: Vital[] = [
  { label: 'Temperature', key: 'temperature', value: '', unit: '°C', trend: [] },
  { label: 'Heart rate', key: 'heartRate', value: '', unit: 'bpm', trend: [] },
  { label: 'Oxygen saturation', key: 'spo2', value: '', unit: '%', trend: [] },
  { label: 'Systolic blood pressure', key: 'systolic', value: '', unit: 'mmHg', trend: [] },
  { label: 'Diastolic blood pressure', key: 'diastolic', value: '', unit: 'mmHg', trend: [] },
  { label: 'Glucose', key: 'glucose', value: '', unit: 'mg/dL', trend: [] },
];

function normalizeProfileGender(value: unknown): ProfileGender {
  const raw = String(value ?? '').trim().toLowerCase();
  if (['female', 'woman', 'f'].includes(raw)) return 'female';
  if (['male', 'man', 'm'].includes(raw)) return 'male';
  if (raw) return 'other';
  return 'unknown';
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function calculateAgeFromDob(value: unknown): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const dob = new Date(raw);
  if (Number.isNaN(dob.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }

  return age >= 0 && age < 130 ? age : null;
}

function calculateBmi(heightCm: number | null, weightKg: number | null): number | null {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null;

  const metres = heightCm / 100;
  const bmi = weightKg / (metres * metres);
  return Number.isFinite(bmi) ? Math.round(bmi * 10) / 10 : null;
}

function symptomDefaults(): SymptomState {
  return SELF_CHECK_SYMPTOMS.reduce((acc, symptom) => {
    acc[symptom.key] = false;
    return acc;
  }, {} as SymptomState);
}

function legacyFromKeys(keys: BodyAreaKey[]): BodyArea[] {
  return keys
    .map((key) => String(key).split(':')[1] as BodyArea)
    .filter(Boolean);
}

export function useSelfCheckState() {
  const profileBmi = useProfileBMI();
  const analyzer = useTriageAnalyzer();

  const [step, setStep] = useState<SelfCheckStep>('data');
  const [vitals, setVitalsState] = useState<Vital[]>(DEFAULT_VITALS);
  const [symptoms, setSymptomsState] = useState<SymptomState>(() => symptomDefaults());
  const [gender, setGenderState] = useState<Gender>('unknown');
  const [view, setView] = useState<BodySide>('front');
  const [areas, setAreasState] = useState<BodyAreaKey[]>([]);
  const [profileContextState, setProfileContextState] =
    useState<SelfCheckProfileContext>(EMPTY_PROFILE_CONTEXT);

  useEffect(() => {
    let cancelled = false;

    async function loadProfileContext() {
      try {
        const res = await fetch('/api/profile', { cache: 'no-store' });
        const data = await res.json().catch(() => null);

        if (cancelled) return;

        if (!res.ok || data?.ok === false || !data) {
          setProfileContextState({ ...EMPTY_PROFILE_CONTEXT, loaded: true, error: true });
          return;
        }

        const normalizedGender = normalizeProfileGender(data.gender ?? data.sexAtBirth);
        const dob = String(data.dob ?? data.dateOfBirth ?? '').trim() || null;
        const age = numberOrNull(data.age) ?? calculateAgeFromDob(dob);
        const heightCm = numberOrNull(data.heightCm ?? data.height);
        const weightKg = numberOrNull(data.weightKg ?? data.weight);
        const bmi =
          numberOrNull(data.bmi ?? data.bodyMassIndex) ??
          calculateBmi(heightCm, weightKg);

        setProfileContextState({
          loaded: true,
          error: false,
          gender: normalizedGender,
          age,
          bmi,
          heightCm,
          weightKg,
          chronicConditions: cleanStringArray(data.chronicConditions),
          allergies: cleanStringArray(data.allergies),
          hasProfileGender:
            normalizedGender === 'male' || normalizedGender === 'female',
        });

        if (normalizedGender === 'male' || normalizedGender === 'female') {
          setGenderState(normalizedGender);
        }
      } catch {
        if (!cancelled) {
          setProfileContextState({ ...EMPTY_PROFILE_CONTEXT, loaded: true, error: true });
        }
      }
    }

    void loadProfileContext();

    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveBmi = profileContextState.bmi ?? profileBmi ?? null;
  const effectiveGender = profileContextState.hasProfileGender
    ? profileContextState.gender
    : gender;

  const selectedSymptoms = useMemo(
    () =>
      SELF_CHECK_SYMPTOMS
        .filter((item) => symptoms[item.key])
        .map((item) => item.key),
    [symptoms],
  );

  const invalidateResult = useCallback(() => {
    analyzer.reset();
  }, [analyzer]);

  const setVitals = useCallback(
    (updater: (prev: Vital[]) => Vital[]) => {
      invalidateResult();
      setVitalsState((prev) => updater(prev));
    },
    [invalidateResult],
  );

  const setSymptoms = useCallback(
    (updater: (prev: SymptomState) => SymptomState) => {
      invalidateResult();
      setSymptomsState((prev) => updater(prev));
    },
    [invalidateResult],
  );

  const setGender = useCallback(
    (nextGender: Gender) => {
      if (profileContextState.hasProfileGender) return;
      invalidateResult();
      setGenderState(nextGender);
    },
    [invalidateResult, profileContextState.hasProfileGender],
  );

  const toggleArea = useCallback(
    (area: BodyAreaKey | BodyArea) => {
      const raw = String(area);
      const key = (raw.includes(':') ? raw : `${view}:${raw}`) as BodyAreaKey;

      invalidateResult();
      setAreasState((prev) =>
        prev.includes(key)
          ? prev.filter((item) => item !== key)
          : [...prev, key],
      );
    },
    [invalidateResult, view],
  );

  const runAnalyze = useCallback(async () => {
    const safeProfileContext = {
      gender: effectiveGender,
      age: profileContextState.age,
      bmi: effectiveBmi,
      heightCm: profileContextState.heightCm,
      weightKg: profileContextState.weightKg,
      chronicConditions: profileContextState.chronicConditions,
      allergies: profileContextState.allergies,
    };

    const result = await analyzer.runAnalyze({
      vitals,
      symptoms,
      bmi: effectiveBmi,
      extraMeta: {
        gender: effectiveGender,
        view,
        bodyAreas: areas,
        legacyBodyAreas: legacyFromKeys(areas),
        selectedSymptoms,
        profileContext: safeProfileContext,
      },
    });

    if (result) {
      setStep('results');
    }

    return result;
  }, [
    analyzer,
    areas,
    effectiveBmi,
    effectiveGender,
    profileContextState.age,
    profileContextState.allergies,
    profileContextState.chronicConditions,
    profileContextState.heightCm,
    profileContextState.weightKg,
    selectedSymptoms,
    symptoms,
    view,
    vitals,
  ]);

  const safeCopy = useCallback(async (text?: string) => {
    const value = String(text ?? '');
    if (!value) return false;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {}

    return false;
  }, []);

  return {
    bmi: effectiveBmi,
    step,
    setStep,
    vitals,
    setVitals,
    symptoms,
    setSymptoms,
    selectedSymptoms,
    gender: effectiveGender,
    profileGenderLocked: profileContextState.hasProfileGender,
    profileContextLoaded: profileContextState.loaded,
    profileContextError: profileContextState.error,
    setGender,
    view,
    setView,
    areas,
    toggleArea,
    analyzer,
    analysisSource: analyzer.analysisSource,
    degradedMode: analyzer.degradedMode,
    remoteError: analyzer.remoteError,
    confidence: analyzer.confidence,
    hasAnalyzed: analyzer.hasAnalyzed,
    lastAnalyzedAt: analyzer.lastAnalyzedAt,
    canOpenResults: analyzer.hasAnalyzed,
    profileContext: profileContextState,
    runAnalyze,
    safeCopy,
  };
}
