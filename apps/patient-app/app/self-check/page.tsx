// apps/patient-app/app/self-check/page.tsx
'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';

import SelfCheckStepper, {
  type SelfCheckStep,
} from '@/components/selfcheck/SelfCheckStepper';
import SelfCheckHeader from '@/components/selfcheck/SelfCheckHeader';
import SelfCheckRightRail from '@/components/selfcheck/SelfCheckRightRail';
import SelfCheckVitalsStep from '@/components/selfcheck/steps/SelfCheckVitalsStep';
import SelfCheckSymptomsStep from '@/components/selfcheck/steps/SelfCheckSymptomsStep';
import SelfCheckResultsStep from '@/components/selfcheck/steps/SelfCheckResultsStep';
import {
  labelBodyAreaKey,
  type BodyAreaKey,
} from '@/components/selfcheck/BodyMap2D';

import { useNow } from '@/src/hooks/selfcheck/useNow';
import { useSelfCheckState } from '@/src/hooks/selfcheck/useSelfCheckState';

export default function SelfCheckPage() {
  const now = useNow(1000);
  const sc = useSelfCheckState();
  const [dataReviewed, setDataReviewed] = useState(false);

  const bodyAreas = useMemo(
    () => sc.areas.filter((key): key is BodyAreaKey => String(key).includes(':')),
    [sc.areas],
  );

  const profileReady = sc.profileContextLoaded;
  const binaryGender =
    sc.gender === 'female' || sc.gender === 'male' ? sc.gender : null;

  const canOpenSymptoms = dataReviewed || sc.step !== 'data';

  const completed: Partial<Record<SelfCheckStep, boolean>> = {
    data: dataReviewed,
    symptoms: sc.hasAnalyzed,
    results: sc.hasAnalyzed,
  };

  function goToSymptoms() {
    setDataReviewed(true);
    sc.setStep('symptoms');
  }

  function onStep(step: SelfCheckStep) {
    if (step === 'symptoms' && !canOpenSymptoms) return;
    if (step === 'results' && !sc.canOpenResults) return;
    sc.setStep(step);
  }

  async function copySummary() {
    if (
      !sc.hasAnalyzed ||
      !sc.analyzer.riskLevel ||
      !sc.analyzer.riskLabel
    ) {
      return;
    }

    const summary = {
      assessment: 'Ambulant+ Self-check',
      vitals: sc.vitals
        .filter(
          (vital) =>
            vital.value !== null &&
            vital.value !== undefined &&
            vital.value !== '',
        )
        .map((vital) => ({
          label: vital.label,
          value: vital.value,
          unit: vital.unit ?? null,
        })),
      symptoms: sc.selectedSymptoms,
      bodyAreas: bodyAreas.map(labelBodyAreaKey),
      result: {
        riskLabel: sc.analyzer.riskLabel,
        riskLevel: sc.analyzer.riskLevel,
        healthScore: sc.analyzer.healthScore ?? null,
        recommendations: sc.analyzer.recommendations,
        explanations: sc.analyzer.explanations,
        analyzedAt: sc.lastAnalyzedAt,
      },
      note: 'Self-check is decision support and is not a medical diagnosis.',
    };

    await sc.safeCopy(JSON.stringify(summary, null, 2));
  }

  if (!profileReady) {
    return (
      <main
        data-p-ui="patient-self-check-page"
        className="min-h-screen overflow-x-clip bg-slate-50 px-3 py-4 text-slate-900 sm:p-6"
      >
        <div className="mx-auto w-full max-w-3xl rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-6">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
            Self-check
          </div>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
            Loading your clinical profile
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            We are retrieving the profile context used for this assessment.
          </p>
        </div>
      </main>
    );
  }

  if (sc.profileContextError) {
    return (
      <main
        data-p-ui="patient-self-check-page"
        className="min-h-screen overflow-x-clip bg-slate-50 px-3 py-4 text-slate-900 sm:p-6"
      >
        <div className="mx-auto w-full max-w-3xl rounded-[24px] border border-amber-200 bg-amber-50/80 p-4 shadow-sm sm:rounded-[28px] sm:p-6">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-800">
            Self-check unavailable
          </div>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
            We could not retrieve your profile context
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            No assessment has been generated. Please retry when your profile can
            be loaded.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 sm:w-auto"
          >
            Back home
          </Link>
        </div>
      </main>
    );
  }

  if (!binaryGender) {
    return (
      <main
        data-p-ui="patient-self-check-page"
        className="min-h-screen overflow-x-clip bg-slate-50 px-3 py-4 text-slate-900 sm:p-6"
      >
        <div className="mx-auto w-full max-w-3xl rounded-[24px] border border-amber-200 bg-amber-50/80 p-4 shadow-sm sm:rounded-[28px] sm:p-6">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-800">
            Profile completion required
          </div>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
            Complete your profile before self-check
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Self-check uses demographic context from your profile. Update your
            profile before continuing rather than changing identity fields inside
            the assessment.
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
      </main>
    );
  }

  const hasAuthoritativeResult =
    sc.hasAnalyzed &&
    Boolean(sc.analyzer.riskLevel) &&
    Boolean(sc.analyzer.riskLabel);

  return (
    <div
      id="selfcheck-root"
      data-p-ui="patient-self-check-page"
      className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fbff_0%,_#f8fafc_38%,_#f1f5f9_100%)] p-4 text-slate-900 md:p-6"
    >
      <div className="mx-auto w-full max-w-7xl min-w-0 space-y-4 sm:space-y-5">
        <section className="min-w-0 overflow-hidden rounded-[24px] border border-white/70 bg-white/85 p-4 shadow-[0_10px_40px_rgba(15,23,42,0.06)] backdrop-blur sm:rounded-[28px] xl:p-5">
          <SelfCheckHeader now={now} bmi={sc.bmi ?? null} />

          <div className="mt-4 min-w-0 overflow-x-auto pb-1">
            <SelfCheckStepper
              step={sc.step}
              onStep={onStep}
              completed={completed}
              canGoSymptoms={canOpenSymptoms}
              canGoResults={sc.canOpenResults}
              symptomsLockedHint="Review Step 1 before continuing."
              resultsLockedHint="Complete Step 2 and receive a valid InsightCore result first."
            />
          </div>
        </section>

        <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-10 xl:gap-6">
          <main className="min-w-0 space-y-4 sm:space-y-5 xl:col-span-7">
            {sc.step === 'data' && (
              <SelfCheckVitalsStep
                vitals={sc.vitals}
                setVitals={sc.setVitals}
                busy={Boolean(sc.analyzer.busy)}
                onNext={goToSymptoms}
              />
            )}

            {sc.step === 'symptoms' && (
              <>
                <SelfCheckSymptomsStep
                  gender={binaryGender}
                  view={sc.view}
                  areas={sc.areas}
                  onChangeGender={sc.setGender}
                  onChangeView={sc.setView}
                  onToggleArea={(key) => sc.toggleArea(key as BodyAreaKey)}
                  symptoms={sc.symptoms}
                  setSymptoms={(updater) =>
                    sc.setSymptoms((prev) => updater(prev) as typeof prev)
                  }
                  busy={Boolean(sc.analyzer.busy)}
                  onBack={() => sc.setStep('data')}
                  onAnalyze={sc.runAnalyze}
                />

                {sc.remoteError ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    {sc.remoteError}
                  </div>
                ) : null}
              </>
            )}

            {sc.step === 'results' && hasAuthoritativeResult ? (
              <SelfCheckResultsStep
                vitals={sc.vitals}
                symptomsSelected={sc.selectedSymptoms}
                areas={bodyAreas}
                riskLabel={sc.analyzer.riskLabel!}
                riskLevel={sc.analyzer.riskLevel!}
                healthScore={sc.analyzer.healthScore ?? null}
                recommendations={sc.analyzer.recommendations}
                explanations={sc.analyzer.explanations}
                onAdjustSymptoms={() => sc.setStep('symptoms')}
                onCopy={copySummary}
              />
            ) : null}

            {sc.step === 'results' && !hasAuthoritativeResult ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-lg font-semibold text-slate-900">
                  Results unavailable
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  A valid InsightCore result has not been received. Return to
                  Step 2 and run the assessment again.
                </p>
                <button
                  type="button"
                  onClick={() => sc.setStep('symptoms')}
                  className="mt-4 rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white"
                >
                  Back to symptoms
                </button>
              </div>
            ) : null}
          </main>

          <aside className="min-w-0 xl:col-span-3">
            <SelfCheckRightRail
              areas={bodyAreas}
              busy={Boolean(sc.analyzer.busy)}
              hasAnalyzed={hasAuthoritativeResult}
              onAnalyze={sc.runAnalyze}
              onCopy={copySummary}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
