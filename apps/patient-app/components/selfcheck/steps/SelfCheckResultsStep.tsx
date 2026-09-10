'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

import HealthScore from '@/components/HealthScore';
import {
  labelBodyAreaKey,
  type BodyAreaKey,
} from '@/components/selfcheck/BodyMap2D';
import type { Vital } from '@/src/hooks/selfcheck/useSelfCheckState';

function riskTone(level: 'low' | 'medium' | 'high') {
  if (level === 'high') return 'border-rose-200 bg-rose-50 text-rose-900';
  if (level === 'medium') return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-emerald-200 bg-emerald-50 text-emerald-900';
}

export default function SelfCheckResultsStep(props: {
  vitals: Vital[];
  symptomsSelected: string[];
  areas: BodyAreaKey[];
  riskLabel: string;
  riskLevel: 'low' | 'medium' | 'high';
  healthScore: number | null;
  recommendations: string[];
  explanations: Array<{
    feature: string;
    impact?: number | null;
    note?: string | null;
  }>;
  onAdjustSymptoms: () => void;
  onCopy: () => void;
}) {
  const router = useRouter();
  const {
    vitals,
    symptomsSelected,
    areas,
    riskLabel,
    riskLevel,
    healthScore,
    recommendations,
    explanations,
    onAdjustSymptoms,
    onCopy,
  } = props;

  const enteredVitals = vitals.filter(
    (vital) =>
      vital.value !== null &&
      vital.value !== undefined &&
      vital.value !== '',
  );

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs text-slate-500">Step 3</div>
            <h2 className="text-lg font-semibold text-slate-900">
              InsightCore result
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              This section is shown only after a valid InsightCore response.
              No local fallback score or risk label is generated.
            </p>
          </div>

          <div className={`rounded-xl border px-3 py-2 ${riskTone(riskLevel)}`}>
            <div className="text-xs opacity-80">Assessment signal</div>
            <div className="font-bold">{riskLabel}</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          {healthScore !== null ? (
            <HealthScore score={healthScore} />
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs text-slate-500">Health score</div>
              <div className="font-semibold text-slate-800">Not provided</div>
            </div>
          )}

        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">
            Recommendations
          </div>
          {recommendations.length ? (
            <ul className="mt-2 ml-5 list-disc space-y-1 text-sm text-slate-700">
              {recommendations.slice(0, 8).map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          ) : (
            <div className="mt-2 text-sm text-slate-600">
              No recommendations were returned.
            </div>
          )}
        </div>

        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">
            What influenced the result
          </div>
          {explanations.length ? (
            <div className="mt-2 space-y-2">
              {explanations.slice(0, 8).map((item, index) => (
                <div key={`${item.feature}-${index}`} className="text-sm text-slate-700">
                  <span className="font-medium text-slate-900">{item.feature}</span>
                  {item.note ? <span className="text-slate-500"> — {item.note}</span> : null}
                  {typeof item.impact === 'number' ? (
                    <span className="ml-2 text-xs text-slate-500">
                      Impact: {item.impact}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-sm text-slate-600">
              No explanatory factors were returned.
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">Vitals provided</div>
            <div className="mt-2 text-sm text-slate-600">
              {enteredVitals.length
                ? enteredVitals
                    .map(
                      (vital) =>
                        `${vital.label}: ${String(vital.value)}${vital.unit ? ` ${vital.unit}` : ''}`,
                    )
                    .join(' • ')
                : 'None'}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">Symptoms provided</div>
            <div className="mt-2 text-sm text-slate-600">
              {symptomsSelected.length ? symptomsSelected.join(', ') : 'None'}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">Body areas</div>
            <div className="mt-2 text-sm text-slate-600">
              {areas.length ? areas.map(labelBodyAreaKey).join(', ') : 'None'}
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs leading-5 text-slate-500">
          Self-check is decision support and is not a diagnosis. If symptoms are
          severe, rapidly worsening, or you feel unsafe, seek urgent medical care.
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => router.push('/clinicians')}
            className="rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white"
          >
            Browse clinicians
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-800"
          >
            Copy patient-safe summary
          </button>
          <button
            type="button"
            onClick={onAdjustSymptoms}
            className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white sm:ml-auto"
          >
            Adjust symptoms
          </button>
        </div>
      </section>
    </div>
  );
}
