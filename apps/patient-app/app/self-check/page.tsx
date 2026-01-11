//apps/patient-app/app/self-check/page.tsx
'use client';

import React, { useMemo } from 'react';

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
import type { BodyHint } from '@/components/selfcheck/bodymap/BodyMap2D';

export default function SelfCheckPage() {
  const now = useNow(1000);
  const sc = useSelfCheckState();

  // ✅ Smart hints resolver (vitals + symptoms → per-area coaching hints)
  const getBodyHint = useBodyMapHints({ vitals: sc.vitals, symptoms: sc.symptoms });

  // ✅ Adapter: your areas are now front/back keys like "front:shoulders"
  const getHintForKey = useMemo(() => {
    return (k: string): BodyHint | null => {
      const parts = String(k).split(':');
      if (parts.length < 2) return null;

      const side = parts[0] as 'front' | 'back';
      const area = parts.slice(1).join(':') as any;

      if (side !== 'front' && side !== 'back') return null;

      try {
        return getBodyHint({ area, side });
      } catch {
        return null;
      }
    };
  }, [getBodyHint]);

  async function copySummary() {
    await sc.safeCopy({
      vitals: sc.vitals,
      symptoms: sc.symptoms,
      bmi: sc.bmi,
      bodyAreas: sc.areas, // front/back keys
      bodyAreasLegacy: sc.areas.map((k) => k.split(':')[1]),
      score: sc.analyzer.healthScore,
      risk: sc.analyzer.riskLabel,
      analyzedAt: sc.lastAnalyzedAt ? new Date(sc.lastAnalyzedAt).toISOString() : null,
    });
  }

  const completed: Partial<Record<SelfCheckStep, boolean>> = {
    data: sc.step !== 'data',
    symptoms: sc.step === 'results' || sc.hasAnalyzed,
    results: sc.hasAnalyzed,
  };

  const onStep = (s: SelfCheckStep) => {
    if (s === 'results' && !sc.canOpenResults) return;
    sc.setStep(s);
  };

  return (
    <div id="selfcheck-root" className="min-h-screen bg-slate-50 text-slate-900 p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <SelfCheckHeader now={now} bmi={sc.bmi ?? null} />

        <SelfCheckStepper
          step={sc.step}
          onStep={onStep}
          completed={completed}
          canGoResults={sc.canOpenResults}
          lockedHint="Run Analyze to unlock results."
        />

        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
          {/* Left */}
          <div className="lg:col-span-7 space-y-4">
            {sc.step === 'data' && (
              <SelfCheckVitalsStep
                vitals={sc.vitals}
                setVitals={(updater) => sc.setVitals(updater)}
                abnormal={sc.abnormal}
                riskColor={sc.riskColor}
                riskLabel={sc.analyzer.riskLabel}
                busy={!!sc.analyzer.busy}
                onNext={() => sc.setStep('symptoms')}
                onAnalyze={sc.runAnalyze}
              />
            )}

            {sc.step === 'symptoms' && (
              <SelfCheckSymptomsStep
                gender={sc.gender}
                view={sc.view}
                areas={sc.areas}
                onChangeGender={sc.setGender}
                onChangeView={sc.setView}
                onToggleArea={sc.toggleArea}
                symptoms={sc.symptoms}
                setSymptoms={(updater) => sc.setSymptoms(updater)}
                busy={!!sc.analyzer.busy}
                onBack={() => sc.setStep('data')}
                onAnalyze={sc.runAnalyze}
                // ✅ smart hints for both tooltip + hint strip
                getHintForKey={getHintForKey}
              />
            )}

            {/* Hard guard: if you somehow get to results without analyzing */}
            {sc.step === 'results' && !sc.hasAnalyzed && (
              <div className="bg-white/80 border border-slate-200 rounded-2xl shadow-sm p-4">
                <div className="text-lg font-semibold text-slate-900">Results are locked</div>
                <div className="text-sm text-slate-600 mt-1">
                  Run analysis first, then we’ll generate your score, trends, and action plan.
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => sc.setStep('symptoms')}
                    className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold hover:bg-slate-50"
                    type="button"
                  >
                    Go back
                  </button>
                  <button
                    onClick={sc.runAnalyze}
                    disabled={!!sc.analyzer.busy}
                    className="px-4 py-2 rounded-xl bg-cyan-600 text-white font-semibold hover:opacity-95 disabled:opacity-50"
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
                areas={sc.areas}
                busy={!!sc.analyzer.busy}
                riskColor={sc.riskColor}
                riskLabel={sc.analyzer.riskLabel}
                riskLevel={sc.analyzer.riskLevel}
                healthScore={sc.analyzer.healthScore}
                recommendations={sc.analyzer.recommendations}
                explanations={sc.analyzer.explanations}
                confidence={sc.confidence}
                timeline={sc.timeline}
                onAdjustSymptoms={() => sc.setStep('symptoms')}
                onCopy={copySummary}
              />
            )}
          </div>

          {/* Right */}
          <div className="lg:col-span-3">
            <SelfCheckRightRail
              cardio={sc.cardioAnalytics.cardio}
              hypeIndex={sc.cardioAnalytics.hypeIndex}
              stress={sc.stressAnalytics}
              trendSummary={sc.trendSummary}
              areas={sc.areas}
              gender={sc.gender}
              view={sc.view}
              busy={!!sc.analyzer.busy}
              onAnalyze={sc.runAnalyze}
              onCopy={copySummary}
            />
          </div>
        </div>
      </div>

      {sc.analyzer.healthScore > 85 && (
        <div className="pointer-events-none fixed inset-0 -z-0 opacity-20">
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-200 via-transparent to-violet-200" />
        </div>
      )}
    </div>
  );
}
