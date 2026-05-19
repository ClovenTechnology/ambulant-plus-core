'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';

import MoodGauge from '@/components/MoodGauge';
import HealthScore from '@/components/HealthScore';
import TimelineHistory from '@/components/TimelineHistory';

import type { Vital } from '@/src/hooks/selfcheck/useSelfCheckState';
import { labelBodyAreaKey, type BodyAreaKey } from '@/components/selfcheck/BodyMap2D';

function Pill(props: { tone: 'slate' | 'cyan' | 'amber' | 'rose' | 'emerald'; children: React.ReactNode }) {
  const cls =
    props.tone === 'emerald'
      ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
      : props.tone === 'cyan'
      ? 'bg-cyan-100 text-cyan-900 border-cyan-200'
      : props.tone === 'amber'
      ? 'bg-amber-100 text-amber-900 border-amber-200'
      : props.tone === 'rose'
      ? 'bg-rose-100 text-rose-900 border-rose-200'
      : 'bg-slate-100 text-slate-900 border-slate-200';

  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${cls}`}>{props.children}</span>;
}

export default function SelfCheckResultsStep(props: {
  vitals: Vital[];
  symptomsSelected: string[];
  areas: BodyAreaKey[];

  busy: boolean;
  riskColor: string;
  riskLabel: string;
  riskLevel: 'low' | 'medium' | 'high';

  healthScore: number;
  recommendations: string[];
  explanations: { feature: string; impact: number; note?: string | null }[];

  confidence: { level: 'Low' | 'Moderate' | 'High'; note: string };

  timeline: { date: string; score: number }[];

  onAdjustSymptoms: () => void;
  onCopy: () => void;
}) {
  const router = useRouter();
  const {
    vitals,
    symptomsSelected,
    areas,
    riskColor,
    riskLabel,
    riskLevel,
    healthScore,
    recommendations,
    explanations,
    confidence,
    timeline,
    onAdjustSymptoms,
    onCopy,
  } = props;

  const abnormal = useMemo(() => {
    return vitals
      .map((v) =>
        typeof v.value === 'number' && v.min != null && v.max != null && (v.value < v.min || v.value > v.max)
          ? v.label
          : null
      )
      .filter(Boolean) as string[];
  }, [vitals]);

  const actionPlan = useMemo(() => {
    // Confidence-aware guidance. Non-diagnostic language.
    if (riskLevel === 'high') {
      return {
        title: 'Action plan: act quickly',
        tone: 'rose' as const,
        bullets: [
          'If you feel severe symptoms or feel unsafe, seek urgent help now.',
          'Consider booking a teleconsult to review your readings and symptoms.',
          'Re-check vitals in a calmer setting if possible (rest, hydrate, sit).',
        ],
        primary: 'Book Teleconsult',
      };
    }
    if (riskLevel === 'medium') {
      return {
        title: 'Action plan: schedule a review',
        tone: 'amber' as const,
        bullets: [
          'Monitor symptoms and trends over the next hours.',
          'If symptoms persist or worsen, book a teleconsult for guidance.',
          'Re-check vitals (especially HR/BP/temperature) and compare trends.',
        ],
        primary: 'Book Teleconsult',
      };
    }
    // low
    return {
      title: 'Action plan: monitor & optimize',
      tone: confidence.level === 'Low' ? ('slate' as const) : ('emerald' as const),
      bullets: [
        'Your inputs suggest lower risk right now, but this is not a diagnosis.',
        'If you feel unwell, re-check vitals later and watch for changes.',
        'Use the body map + symptoms to track patterns you can share with a clinician.',
      ],
      primary: 'Browse Clinicians',
    };
  }, [riskLevel, confidence.level]);

  return (
    <div className="space-y-4">
      <div className="bg-white/80 border border-slate-200 rounded-2xl shadow-sm p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500">Step 3</div>
            <div className="text-lg font-semibold text-slate-900">Results</div>
            <div className="text-sm text-slate-600 mt-1">
              Confidence: <span className="font-semibold text-slate-900">{confidence.level}</span>{' '}
              <span className="text-slate-500">· {confidence.note}</span>
            </div>
          </div>

          <div className={`px-3 py-2 rounded-xl ${riskColor} shadow-sm`}>
            <div className="text-xs opacity-90">Status</div>
            <div className="font-bold">{riskLabel}</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-6 items-center">
          <MoodGauge level={75} />
          <HealthScore score={healthScore} />
        </div>

        {/* Action Plan (worldclass feel) */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-900">{actionPlan.title}</div>
            <Pill tone={actionPlan.tone}>{riskLevel.toUpperCase()} SIGNAL</Pill>
          </div>

          <ul className="mt-3 list-disc ml-5 text-sm text-slate-700 space-y-1">
            {actionPlan.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>

          <div className="mt-3 text-xs text-slate-500">
            This self-check summarizes patterns and trends. It’s not a medical diagnosis.
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => router.push('/clinicians')}
              className="px-4 py-2 rounded-xl bg-cyan-600 text-white font-semibold hover:opacity-95"
              type="button"
            >
              {actionPlan.primary}
            </button>

            <button
              onClick={onCopy}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold hover:bg-slate-50"
              type="button"
            >
              Share / Copy summary
            </button>

            <button
              onClick={onAdjustSymptoms}
              className="ml-auto px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold hover:opacity-95"
              type="button"
            >
              Adjust Symptoms
            </button>
          </div>
        </div>

        {/* Trust layer: “What we saw” */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div className="text-sm font-semibold text-slate-900">What we saw</div>
            <div className="mt-2 text-sm text-slate-700 space-y-1">
              <div>
                <span className="text-slate-500">Flags:</span>{' '}
                <span className="font-semibold">{abnormal.length ? abnormal.join(', ') : 'None'}</span>
              </div>
              <div>
                <span className="text-slate-500">Symptoms:</span>{' '}
                <span className="font-semibold">{symptomsSelected.length ? symptomsSelected.join(', ') : 'None'}</span>
              </div>
              <div>
                <span className="text-slate-500">Body areas:</span>{' '}
                <span className="font-semibold">{areas.length ? areas.map(labelBodyAreaKey).join(', ') : 'None'}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 md:col-span-2">
            <div className="text-sm font-semibold text-slate-900 mb-2">Recommendations</div>
            {recommendations.length === 0 ? (
              <div className="text-sm text-slate-600">No recommendations yet.</div>
            ) : (
              <ul className="list-disc ml-5 text-sm text-slate-700 space-y-1">
                {recommendations.slice(0, 6).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Explanations */}
        <div className="mt-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <div className="text-sm font-semibold text-slate-900 mb-2">What influenced this score</div>
          {explanations.length === 0 ? (
            <div className="text-sm text-slate-600">No factors yet.</div>
          ) : (
            <div className="space-y-2">
              {explanations.slice(0, 6).map((e, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <div className="text-sm text-slate-700">
                    {e.feature}{' '}
                    {e.note ? <span className="text-xs text-slate-500 ml-1">{e.note}</span> : null}
                  </div>
                  <div className={`text-sm font-semibold ${e.impact < 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {(e.impact > 0 ? '+' : '') + (Math.round(e.impact * 100) / 100)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white/80 border border-slate-200 rounded-2xl shadow-sm p-4">
        <div className="text-sm font-semibold mb-3 text-slate-900">Recent timeline</div>
        <TimelineHistory entries={timeline.slice(-6)} />
      </div>
    </div>
  );
}
