// apps/patient-app/app/self-check/page.tsx
'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';

import SelfCheckStepper from '@/components/selfcheck/SelfCheckStepper';
import type { SelfCheckStep } from '@/components/selfcheck/SelfCheckStepper';

import SelfCheckHeader from '@/components/selfcheck/SelfCheckHeader';
import SelfCheckRightRail from '@/components/selfcheck/SelfCheckRightRail';

import SelfCheckVitalsStep from '@/components/selfcheck/steps/SelfCheckVitalsStep';
import SelfCheckSymptomsStep from '@/components/selfcheck/steps/SelfCheckSymptomsStep';
import SelfCheckResultsStep from '@/components/selfcheck/steps/SelfCheckResultsStep';

import { useNow } from '@/src/hooks/selfcheck/useNow';
import { useSelfCheckState } from '@/src/hooks/selfcheck/useSelfCheckState';

import useBodyMapHints from '@/src/hooks/selfcheck/useBodyMapHints';
import type {
  BodyAreaKey,
  BodyHint,
} from '@/components/selfcheck/BodyMap2D';

type BinaryGender = 'male' | 'female';
type BodySide = 'front' | 'back';
type RiskLevel = 'low' | 'medium' | 'high';
type ConfidenceLevel = 'Low' | 'Moderate' | 'High';

type SymptomsRecord = Record<string, boolean>;
type SymptomsUpdater = (prev: SymptomsRecord) => SymptomsRecord;

type Explanation = {
  feature: string;
  impact: number;
  note?: string | null;
};

type ResultsTimelineEntry = {
  date: string;
  score: number;
};

type ConfidenceInfo = {
  level: ConfidenceLevel;
  note: string;
};

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normaliseBinaryGender(value: unknown): BinaryGender {
  return value === 'female' ? 'female' : 'male';
}

function normaliseRiskLevel(
  value: unknown,
  fallbackText: unknown,
  healthScore: number,
): RiskLevel {
  const raw = `${String(value ?? '')} ${String(fallbackText ?? '')}`.toLowerCase();

  if (
    raw.includes('high') ||
    raw.includes('critical') ||
    raw.includes('emergency') ||
    raw.includes('red')
  ) {
    return 'high';
  }

  if (
    raw.includes('medium') ||
    raw.includes('moderate') ||
    raw.includes('urgent') ||
    raw.includes('amber')
  ) {
    return 'medium';
  }

  if (
    raw.includes('low') ||
    raw.includes('green') ||
    raw.includes('routine') ||
    raw.includes('self-care') ||
    raw.includes('selfcare')
  ) {
    return 'low';
  }

  /*
   * healthScore is a wellness score: higher = better.
   * Convert it to a risk signal if the analyzer does not provide one.
   */
  if (healthScore < 50) return 'high';
  if (healthScore < 75) return 'medium';
  return 'low';
}

function riskLevelToLabel(level: RiskLevel, fallback?: unknown): string {
  const text = String(fallback ?? '').trim();

  if (text) return text;

  if (level === 'high') return 'High risk';
  if (level === 'medium') return 'Medium risk';
  return 'Low risk';
}

function riskLevelToBadgeClass(level: RiskLevel): string {
  if (level === 'high') {
    return 'bg-rose-600 text-white';
  }

  if (level === 'medium') {
    return 'bg-amber-300 text-slate-900';
  }

  return 'bg-emerald-600 text-white';
}

function normaliseHealthScore(value: unknown): number {
  const n = toFiniteNumber(value);
  if (n === null) return 0;

  return Math.round(clampNumber(n, 0, 100));
}

function normaliseConfidence(value: unknown): ConfidenceInfo {
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    const rawLevel = String(row.level ?? '').trim();

    const level: ConfidenceLevel =
      rawLevel === 'High'
        ? 'High'
        : rawLevel === 'Moderate'
          ? 'Moderate'
          : 'Low';

    const note = String(row.note ?? '').trim();

    return {
      level,
      note: note || confidenceNote(level),
    };
  }

  const numeric = toFiniteNumber(value);

  if (numeric === null) {
    return {
      level: 'Low',
      note: 'Confidence is limited because the available self-check data is incomplete.',
    };
  }

  if (numeric >= 75) {
    return {
      level: 'High',
      note: 'Several inputs are available, so the self-check has stronger context.',
    };
  }

  if (numeric >= 45) {
    return {
      level: 'Moderate',
      note: 'Some useful inputs are available, but more vitals or symptom details would improve confidence.',
    };
  }

  return {
    level: 'Low',
    note: 'Confidence is limited because only a small amount of self-check data is available.',
  };
}

function confidenceNote(level: ConfidenceLevel): string {
  if (level === 'High') {
    return 'Several inputs are available, so the self-check has stronger context.';
  }

  if (level === 'Moderate') {
    return 'Some useful inputs are available, but more vitals or symptom details would improve confidence.';
  }

  return 'Confidence is limited because the available self-check data is incomplete.';
}

function normaliseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
}

function normaliseExplanations(value: unknown): Explanation[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): Explanation | null => {
      if (!item || typeof item !== 'object') {
        const text = String(item ?? '').trim();

        return text
          ? {
              feature: text,
              impact: 0,
              note: null,
            }
          : null;
      }

      const row = item as Record<string, unknown>;

      const feature = String(
        row.feature ??
          row.label ??
          row.name ??
          row.title ??
          row.reason ??
          'Factor',
      ).trim();

      const impact = toFiniteNumber(row.impact ?? row.weight ?? row.score) ?? 0;
      const noteRaw = row.note ?? row.description ?? row.detail ?? null;
      const note = noteRaw === null || noteRaw === undefined ? null : String(noteRaw);

      return {
        feature: feature || 'Factor',
        impact,
        note,
      };
    })
    .filter((item): item is Explanation => Boolean(item));
}

function normaliseResultsTimeline(
  value: unknown,
  fallbackScore: number,
): ResultsTimelineEntry[] {
  if (!Array.isArray(value)) {
    return [
      {
        date: new Date().toISOString(),
        score: fallbackScore,
      },
    ];
  }

  const rows = value
    .map((item): ResultsTimelineEntry | null => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const row = item as Record<string, unknown>;

      const rawDate =
        row.date ??
        row.at ??
        row.createdAt ??
        row.timestamp ??
        row.time ??
        new Date().toISOString();

      const rawScore =
        row.score ??
        row.value ??
        row.healthScore ??
        row.health_score ??
        fallbackScore;

      const score = toFiniteNumber(rawScore);

      return {
        date: String(rawDate),
        score: score === null ? fallbackScore : clampNumber(score, 0, 100),
      };
    })
    .filter((item): item is ResultsTimelineEntry => Boolean(item));

  return rows.length
    ? rows
    : [
        {
          date: new Date().toISOString(),
          score: fallbackScore,
        },
      ];
}

function normaliseAbnormalKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();

      if (!item || typeof item !== 'object') return '';

      const row = item as Record<string, unknown>;

      return String(
        row.key ??
          row.id ??
          row.name ??
          row.label ??
          row.type ??
          row.code ??
          row.metric ??
          row.vital ??
          '',
      ).trim();
    })
    .filter(Boolean);
}

function normaliseLegacyBodyAreas(value: readonly string[]): string[] {
  return value
    .map((key) => {
      const parts = String(key).split(':');
      return parts.length > 1 ? parts.slice(1).join(':') : key;
    })
    .map((key) => key.trim())
    .filter(Boolean);
}

function normaliseTrendSummary(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();

      if (!item || typeof item !== 'object') return '';

      const row = item as Record<string, unknown>;

      const label = String(row.label ?? row.key ?? 'Trend').trim();
      const direction = String(row.direction ?? '').trim();
      const unit = String(row.unit ?? '').trim();

      const first =
        row.first === undefined || row.first === null ? '' : String(row.first);
      const last =
        row.last === undefined || row.last === null ? '' : String(row.last);

      if (first || last) {
        return `${label}: ${first || '—'} → ${last || '—'}${unit ? ` ${unit}` : ''}${
          direction ? ` (${direction})` : ''
        }`;
      }

      return label;
    })
    .filter(Boolean);
}

function parseBodyAreaKey(key: string): { side: BodySide; area: string } | null {
  const parts = String(key).split(':');

  if (parts.length < 2) return null;

  const side = parts[0];

  if (side !== 'front' && side !== 'back') return null;

  const area = parts.slice(1).join(':').trim();

  if (!area) return null;

  return { side, area };
}

function normaliseBodyAreaKeys(value: readonly string[]): BodyAreaKey[] {
  return value.filter((key): key is BodyAreaKey => Boolean(parseBodyAreaKey(key)));
}

export default function SelfCheckPage() {
  const now = useNow(1000);
  const sc = useSelfCheckState();

  const bodyAreas = useMemo(
    () => normaliseBodyAreaKeys(sc.areas),
    [sc.areas],
  );

  const binaryGender = useMemo<BinaryGender>(
    () => normaliseBinaryGender(sc.gender),
    [sc.gender],
  );

  const abnormalKeys = useMemo(
    () => normaliseAbnormalKeys(sc.abnormal),
    [sc.abnormal],
  );

  const legacyBodyAreas = useMemo(
    () => normaliseLegacyBodyAreas(sc.areas),
    [sc.areas],
  );

  const healthScore = useMemo(
    () => normaliseHealthScore(sc.analyzer.healthScore),
    [sc.analyzer.healthScore],
  );

  const riskLevel = useMemo<RiskLevel>(
    () =>
      normaliseRiskLevel(
        sc.analyzer.riskLevel ?? sc.analyzer.result?.riskLevel,
        sc.analyzer.riskLabel ?? sc.analyzer.risk ?? sc.analyzer.result?.risk,
        healthScore,
      ),
    [
      healthScore,
      sc.analyzer.result?.risk,
      sc.analyzer.result?.riskLevel,
      sc.analyzer.risk,
      sc.analyzer.riskLabel,
      sc.analyzer.riskLevel,
    ],
  );

  const riskLabel = useMemo(
    () =>
      riskLevelToLabel(
        riskLevel,
        sc.analyzer.riskLabel ??
          sc.analyzer.label ??
          sc.analyzer.risk ??
          sc.analyzer.result?.riskLabel ??
          sc.analyzer.result?.risk,
      ),
    [
      riskLevel,
      sc.analyzer.label,
      sc.analyzer.result?.risk,
      sc.analyzer.result?.riskLabel,
      sc.analyzer.risk,
      sc.analyzer.riskLabel,
    ],
  );

  const riskBadgeClass = useMemo(
    () => riskLevelToBadgeClass(riskLevel),
    [riskLevel],
  );

  const confidenceInfo = useMemo(
    () => normaliseConfidence(sc.confidence),
    [sc.confidence],
  );

  const recommendations = useMemo(
    () =>
      normaliseStringArray(
        sc.analyzer.recommendations ??
          sc.analyzer.result?.recommendations ??
          sc.analyzer.result?.advice,
      ),
    [
      sc.analyzer.recommendations,
      sc.analyzer.result?.advice,
      sc.analyzer.result?.recommendations,
    ],
  );

  const explanations = useMemo(
    () =>
      normaliseExplanations(
        sc.analyzer.explanations ??
          sc.analyzer.result?.explanations ??
          sc.analyzer.result?.factors,
      ),
    [
      sc.analyzer.explanations,
      sc.analyzer.result?.explanations,
      sc.analyzer.result?.factors,
    ],
  );

  const resultsTimeline = useMemo(
    () => normaliseResultsTimeline(sc.timeline, healthScore),
    [healthScore, sc.timeline],
  );

  const rightRailTrendSummary = useMemo(
    () => normaliseTrendSummary(sc.trendSummary),
    [sc.trendSummary],
  );

  const getBodyHint = useBodyMapHints({
    vitals: sc.vitals,
    symptoms: sc.symptoms,
  });

  const getHintForKey = useMemo(() => {
    return (key: string): BodyHint | null => {
      const parsed = parseBodyAreaKey(key);

      if (!parsed) return null;

      try {
        return getBodyHint({
          area: parsed.area as any,
          side: parsed.side,
        }) as BodyHint | null;
      } catch {
        return null;
      }
    };
  }, [getBodyHint]);

  function handleGenderChange(nextGender: BinaryGender) {
    sc.setGender(nextGender as Parameters<typeof sc.setGender>[0]);
  }

  function handleSymptomsChange(updater: SymptomsUpdater) {
    sc.setSymptoms((prev) => {
      const previous = prev as unknown as SymptomsRecord;
      const next = updater(previous);

      return {
        ...prev,
        ...next,
      } as typeof prev;
    });
  }

  async function copySummary() {
    const summary = {
      vitals: sc.vitals,
      symptoms: sc.symptoms,
      bmi: sc.bmi,
      bodyAreas: sc.areas,
      bodyAreasLegacy: legacyBodyAreas,
      abnormal: abnormalKeys,
      score: healthScore,
      risk: riskLabel,
      riskLevel,
      confidence: confidenceInfo,
      analyzedAt: sc.lastAnalyzedAt
        ? new Date(sc.lastAnalyzedAt).toISOString()
        : null,

      profileContext: sc.profileContext,
      medicationContext: sc.medicationContext,
      wearableContext: sc.wearableContext,

      recommendations,
      explanations,
      analysisSource: sc.analysisSource,
      degradedMode: sc.degradedMode,
      remoteError: sc.remoteError,
    };

    await sc.safeCopy(JSON.stringify(summary, null, 2));
  }

  const completed: Partial<Record<SelfCheckStep, boolean>> = {
    data: sc.step !== 'data',
    symptoms: sc.step === 'results' || sc.hasAnalyzed,
    results: sc.hasAnalyzed,
  };

  function onStep(step: SelfCheckStep) {
    if (step === 'results' && !sc.canOpenResults) return;
    sc.setStep(step);
  }


  const profileGenderReady = sc.profileContextLoaded;
  const hasUsableProfileGender =
    sc.profileContext?.gender === 'male' || sc.profileContext?.gender === 'female';

  if (!profileGenderReady) {
    return (
      <div data-p-ui="patient-self-check-page" className="min-h-screen overflow-x-clip bg-slate-50 px-3 py-4 text-slate-900 sm:p-6">
        <div className="mx-auto w-full max-w-3xl rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-6">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
            Self-check
          </div>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
            Loading your clinical profile
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            We are retrieving your verified demographic context before starting the assessment.
          </p>
        </div>
      </div>
    );
  }

  if (!hasUsableProfileGender) {
    return (
      <div data-p-ui="patient-self-check-page" className="min-h-screen overflow-x-clip bg-slate-50 px-3 py-4 text-slate-900 sm:p-6">
        <div className="mx-auto w-full max-w-3xl rounded-[24px] border border-amber-200 bg-amber-50/80 p-4 shadow-sm sm:rounded-[28px] sm:p-6">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-800">
            Profile completion required
          </div>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
            Add your verified gender before self-check
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Self-check uses your profile gender, age, BMI, body metrics, and vitals to provide safer context. To avoid spoofed demographic data, gender is not changed inside this assessment when a profile exists.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/profile"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 sm:w-auto"
            >
              Complete profile
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 sm:w-auto"
            >
              Back home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id="selfcheck-root"
      className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fbff_0%,_#f8fafc_38%,_#f1f5f9_100%)] p-4 text-slate-900 md:p-6"
    >
      <div className="mx-auto w-full max-w-7xl min-w-0 space-y-4 sm:space-y-5">
        <section data-p-ui="patient-self-check-hero" className="min-w-0 overflow-hidden rounded-[24px] border border-white/70 bg-white/85 p-4 shadow-[0_10px_40px_rgba(15,23,42,0.06)] backdrop-blur sm:rounded-[28px] xl:p-5">
          <SelfCheckHeader now={now} bmi={sc.bmi ?? null} />

          <div data-p-ui="patient-self-check-stepper-wrap" className="mt-4 min-w-0 overflow-x-auto pb-1">
            <SelfCheckStepper
              step={sc.step}
              onStep={onStep}
              completed={completed}
              canGoResults={sc.canOpenResults}
              lockedHint="Run Analyze to unlock results."
            />
          </div>
        </section>

        <div data-p-ui="patient-self-check-layout" className="grid min-w-0 grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-10 xl:gap-6">
          <div data-p-ui="patient-self-check-main-column" className="min-w-0 space-y-4 sm:space-y-5 xl:col-span-7">
            {sc.step === 'data' && (
              <SelfCheckVitalsStep
                vitals={sc.vitals}
                setVitals={(updater) => sc.setVitals(updater)}
                abnormal={abnormalKeys}
                riskColor={riskBadgeClass}
                riskLabel={riskLabel}
                busy={Boolean(sc.analyzer.busy)}
                onNext={() => sc.setStep('symptoms')}
                onAnalyze={sc.runAnalyze}
              />
            )}

            {sc.step === 'symptoms' && (
              <SelfCheckSymptomsStep
                gender={binaryGender}
                view={sc.view}
                areas={sc.areas}
                onChangeGender={handleGenderChange}
                onChangeView={sc.setView}
                onToggleArea={sc.toggleArea}
                symptoms={sc.symptoms}
                setSymptoms={handleSymptomsChange}
                busy={Boolean(sc.analyzer.busy)}
                onBack={() => sc.setStep('data')}
                onAnalyze={sc.runAnalyze}
                getHintForKey={getHintForKey}
              />
            )}

            {sc.step === 'results' && !sc.hasAnalyzed && (
              <div data-p-ui="patient-self-check-locked-results" className="min-w-0 rounded-[24px] border border-slate-200 bg-white/85 p-4 shadow-sm">
                <div className="text-lg font-semibold text-slate-900">
                  Results are locked
                </div>

                <div className="mt-1 text-sm text-slate-600">
                  Run analysis first, then we’ll generate your score, trends,
                  and action plan.
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={() => sc.setStep('symptoms')}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50 sm:w-auto"
                    type="button"
                  >
                    Go back
                  </button>

                  <button
                    onClick={sc.runAnalyze}
                    disabled={Boolean(sc.analyzer.busy)}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white hover:opacity-95 disabled:opacity-50 sm:w-auto"
                    type="button"
                  >
                    {sc.analyzer.busy ? 'Checking…' : 'Analyze now'}
                  </button>
                </div>
              </div>
            )}

            {sc.step === 'results' && sc.hasAnalyzed && (
              <SelfCheckResultsStep
                vitals={sc.vitals}
                symptomsSelected={sc.selectedSymptoms}
                areas={bodyAreas}
                busy={Boolean(sc.analyzer.busy)}
                riskColor={riskBadgeClass}
                riskLabel={riskLabel}
                riskLevel={riskLevel}
                healthScore={healthScore}
                recommendations={recommendations}
                explanations={explanations}
                confidence={confidenceInfo}
                timeline={resultsTimeline}
                onAdjustSymptoms={() => sc.setStep('symptoms')}
                onCopy={copySummary}
              />
            )}
          </div>

          <aside data-p-ui="patient-self-check-right-rail" className="min-w-0 xl:col-span-3">
            <SelfCheckRightRail
              cardio={sc.cardioAnalytics.risk}
              hypeIndex={sc.cardioAnalytics.hypertensionIndex}
              stress={sc.stressAnalytics}
              trendSummary={rightRailTrendSummary}
              areas={bodyAreas}
              gender={binaryGender}
              view={sc.view}
              busy={Boolean(sc.analyzer.busy)}
              onAnalyze={sc.runAnalyze}
              onCopy={copySummary}
            />
          </aside>
        </div>
      </div>

      {healthScore > 85 && (
        <div className="pointer-events-none fixed inset-0 -z-0 opacity-20">
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-200 via-transparent to-violet-200" />
        </div>
      )}
    </div>
  );
}