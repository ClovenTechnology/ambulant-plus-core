'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

type Maturity =
  | 'LIVE'
  | 'PARTIAL'
  | 'RESEARCH'
  | 'READINESS'
  | 'PLANNED';

type SourceResult = {
  ok: boolean;
  status: number;
  body: any;
};

type ControlPlanePayload = {
  ok: boolean;
  asAt: string;
  sourceAuthority: string;
  mode: string;
  sourceSummary: {
    available: number;
    total: number;
  };
  sources: Record<string, SourceResult>;
};

type Capability = {
  title: string;
  maturity: Maturity;
  summary: string;
  evidence: string;
};

const CAPABILITIES: Capability[] = [
  {
    title: 'Clinical context & feature fabric',
    maturity: 'LIVE',
    summary:
      'Builds a provenance-aware clinical context and feature vector from connected observations and patient context.',
    evidence:
      'ContextEngine, FeatureFabric, provenance weighting, evidence reliability and bias-aware adjustment are present in the primary orchestrator.',
  },
  {
    title: 'Personal baselines & drift',
    maturity: 'LIVE',
    summary:
      'Supports longitudinal personal baselines, temporal windows, circadian profiles, trend interpretation and baseline deviation.',
    evidence:
      'Baseline stores and baseline Studio read models persist and query RuntimeEvent-backed baseline state.',
  },
  {
    title: 'Episodes, alerts & insights',
    maturity: 'LIVE',
    summary:
      'Groups inference into episodes, evaluates alerts and generates role-aware, baseline-aware insight output.',
    evidence:
      'EpisodeEngine, AlertEngineV2 and InsightGeneratorV2 are in the active orchestration path.',
  },
  {
    title: 'Clinical pathways',
    maturity: 'LIVE',
    summary:
      'Runs deterministic and composite pathway families including maternal, recovery, adherence, baseline deviation, sleep trajectory and allergy risk.',
    evidence:
      'These pathway engines are instantiated directly by the current InsightCoreOrchestrator.',
  },
  {
    title: 'Uncertainty & abstention',
    maturity: 'LIVE',
    summary:
      'Combines measurement, inference and clinical uncertainty and can abstain rather than emit overconfident output.',
    evidence:
      'MeasurementUncertaintyEngine, ClinicalUncertaintyEngine, InferenceUncertaintyEngine, UncertaintyComposer and AbstentionPolicy are active.',
  },
  {
    title: 'Evidence provenance & lineage',
    maturity: 'LIVE',
    summary:
      'Tracks source priority, device provenance, reliability, evidence trace and inference lineage.',
    evidence:
      'AcquisitionContextResolver, provenance-aware feature fabric, trace and lineage stores are present.',
  },
  {
    title: 'Cohort intelligence',
    maturity: 'PARTIAL',
    summary:
      'Provides demographic, chronic, maternal, risk, burden and research cohort read models.',
    evidence:
      'The Gateway exposes multiple persisted cohort intelligence endpoints, but programme-level downstream action loops remain incomplete.',
  },
  {
    title: 'Research isolation',
    maturity: 'LIVE',
    summary:
      'Separates research-only inference from deployable inference and keeps selected research engines default-off.',
    evidence:
      'ResearchOutputSeparator and ResearchIsolationPolicy are active; seizure/autonomic research engines default to disabled.',
  },
  {
    title: 'FHIR / OMOP intelligence packaging',
    maturity: 'PARTIAL',
    summary:
      'Projects intelligence into FHIR and OMOP-oriented operational, deployment, analytical and research envelopes.',
    evidence:
      'Standards packaging is already emitted by the ingest pipeline; external integration certification remains separate.',
  },
  {
    title: 'Model registry & experimentation',
    maturity: 'READINESS',
    summary:
      'Contains model registry, experiment registry, rollout and production model-adapter abstractions.',
    evidence:
      'ML and experiment infrastructure exists, but the primary orchestrator does not yet call a certified production ML scoring client.',
  },
  {
    title: 'Advanced ML scoring',
    maturity: 'READINESS',
    summary:
      'Designed for deterministic-only, ML-only or hybrid scoring through a production adapter boundary.',
    evidence:
      'ProductionModelAdapter and ProductionScoringStrategy exist; validated ML scoring is not currently certified in the primary ingest path.',
  },
  {
    title: 'Closed-loop predictive care',
    maturity: 'PLANNED',
    summary:
      'Should connect predictions to follow-up timing, adherence, CarePort, MedReach, clinician action and measured outcomes.',
    evidence:
      'The monorepo contains the necessary operational domains, but a unified outcome-learning loop is not yet certified as complete.',
  },
];

const DEVELOPER_NOTES = [
  {
    title: 'Context propagation gap',
    status: 'PARTIAL' as Maturity,
    body:
      'The orchestrator accepts age, gender, conditions, allergies, medication, encounters, rollout records and experiment assignments. The current ingest pipeline forwards a smaller subset centred on vitals, lifestyle, prior alerts and existing episodes. The next intelligence sprint should close this gap through one canonical longitudinal context assembler.',
  },
  {
    title: 'Production ML execution',
    status: 'READINESS' as Maturity,
    body:
      'ML boundaries and production scoring abstractions exist, but the current orchestrator directly executes deterministic and pathway engines. Do not market model performance until a scoring client, validation cohort, calibration evidence, drift monitoring and governed rollout are connected.',
  },
  {
    title: 'Studio write-route governance',
    status: 'READINESS' as Maturity,
    body:
      'This Admin Control Center is deliberately read-only. Raw Studio mutation controls should not be exposed here until every write path is protected by canonical password-backed Admin identity and server-side scope enforcement.',
  },
  {
    title: 'Research safety',
    status: 'LIVE' as Maturity,
    body:
      'Research outputs are separated from deployable outputs and selected research engines are default-off. Preserve that boundary while adding experiments or predictive models.',
  },
];

function maturityClass(value: Maturity) {
  if (value === 'LIVE') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }

  if (value === 'PARTIAL') {
    return 'border-sky-200 bg-sky-50 text-sky-800';
  }

  if (value === 'RESEARCH') {
    return 'border-violet-200 bg-violet-50 text-violet-800';
  }

  if (value === 'READINESS') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function MaturityBadge({
  value,
}: {
  value: Maturity;
}) {
  return (
    <span
      className={[
        'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide',
        maturityClass(value),
      ].join(' ')}
    >
      {value}
    </span>
  );
}

function Metric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-gray-950">
        {value}
      </div>
      <div className="mt-2 text-[11px] leading-5 text-gray-500">
        {helper}
      </div>
    </div>
  );
}

function asNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number
    : 0;
}

function sourceLabel(key: string) {
  const labels: Record<string, string> = {
    dashboard: 'Runtime dashboard',
    cohort: 'Cohort intelligence',
    evaluationModels: 'Model evaluation',
    evaluationFamilies: 'Pathway-family evaluation',
    runtimeDrift: 'Runtime drift',
    governanceAudit: 'Governance audit',
    compliance: 'Compliance summary',
    runtimePlan: 'Runtime execution plan',
    researchPipelines: 'Research pipelines',
    experiments: 'Experiment registry',
  };

  return labels[key] || key;
}

export default function InsightCoreControlCenter() {
  const [data, setData] =
    useState<ControlPlanePayload | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState<string | null>(null);

  const load = useCallback(
    async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          '/api/admin/insightcore/control-plane',
          {
            credentials: 'include',
            cache: 'no-store',
          },
        );

        const body = await response
          .json()
          .catch(() => null);

        if (!response.ok || body?.ok !== true) {
          throw new Error(
            body?.error ||
              `InsightCore control plane returned HTTP ${response.status}`,
          );
        }

        setData(body);
      }
      catch (cause: any) {
        setData(null);
        setError(
          cause?.message ||
            'InsightCore control-plane data is unavailable.',
        );
      }
      finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = useMemo(
    () =>
      data
        ?.sources
        ?.dashboard
        ?.body
        ?.metrics || {},
    [data],
  );

  const sourceRows = Object.entries(
    data?.sources || {},
  );

  const availableText = data
    ? `${data.sourceSummary.available}/${data.sourceSummary.total}`
    : '—';

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <section className="rounded-3xl border bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-4xl">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Ambulant+ Intelligence
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              InsightCore Control Center
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200">
              Clinical-intelligence observability, predictive-care readiness,
              longitudinal baselines, evidence provenance, research isolation,
              evaluation and governance across the Ambulant+ ecosystem.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs">
                Read-only Admin surface
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs">
                Gateway-backed
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs">
                No demo intelligence
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/settings/insightcore"
              className="rounded-xl border border-white/20 bg-white px-4 py-2 text-sm font-medium text-slate-950"
            >
              InsightCore settings
            </Link>
            <Link
              href="/settings/insightcore/simulator"
              className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white"
            >
              Simulator
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-amber-950">
            InsightCore live data unavailable
          </div>
          <div className="mt-1 text-sm text-amber-900">
            {error}
          </div>
          <div className="mt-2 text-xs text-amber-800">
            No synthetic intelligence is substituted when live sources fail.
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric
          label="Clinical episodes"
          value={asNumber(metrics.totalEpisodes).toLocaleString()}
          helper="Persisted InsightCore episode events."
        />
        <Metric
          label="High / critical"
          value={asNumber(metrics.highOrCriticalEpisodes).toLocaleString()}
          helper="High or critical episodes in the latest episode window."
        />
        <Metric
          label="Risk alerts"
          value={asNumber(metrics.totalAlerts).toLocaleString()}
          helper="Persisted InsightCore risk-alert events."
        />
        <Metric
          label="Evidence traces"
          value={asNumber(metrics.totalTraces).toLocaleString()}
          helper="Explainability trace records."
        />
        <Metric
          label="Lineage records"
          value={asNumber(metrics.totalLineageRecords).toLocaleString()}
          helper="Inference and evidence lineage records."
        />
        <Metric
          label="Control-plane sources"
          value={availableText}
          helper="Read-only InsightCore sources responding now."
        />
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-950">
              Intelligence capability map
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">
              This map distinguishes working runtime capability from partial
              integration, research-only logic and future production readiness.
              It is intentionally stricter than marketing language.
            </p>
          </div>
          <div className="text-xs text-gray-500">
            LIVE ≠ clinically validated ML unless explicitly stated
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CAPABILITIES.map((capability) => (
            <article
              key={capability.title}
              className="rounded-2xl border bg-slate-50/60 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-950">
                  {capability.title}
                </h3>
                <MaturityBadge value={capability.maturity} />
              </div>
              <p className="mt-3 text-sm leading-6 text-gray-700">
                {capability.summary}
              </p>
              <p className="mt-3 border-t pt-3 text-[11px] leading-5 text-gray-500">
                {capability.evidence}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-950">
            Live source health
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Read-only checks against existing InsightCore Studio Gateway sources.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b bg-slate-50 text-gray-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 font-medium">State</th>
                  <th className="px-3 py-2 font-medium text-right">HTTP</th>
                </tr>
              </thead>
              <tbody>
                {sourceRows.map(([key, source]) => (
                  <tr key={key} className="border-b last:border-b-0">
                    <td className="px-3 py-3 font-medium text-gray-900">
                      {sourceLabel(key)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={[
                          'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                          source.ok
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-amber-200 bg-amber-50 text-amber-800',
                        ].join(' ')}
                      >
                        {source.ok ? 'AVAILABLE' : 'UNAVAILABLE'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-600">
                      {source.status}
                    </td>
                  </tr>
                ))}
                {!sourceRows.length ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-3 py-6 text-center text-gray-500"
                    >
                      {loading
                        ? 'Loading InsightCore sources…'
                        : 'No source status returned.'}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {data?.asAt ? (
            <div className="mt-3 text-[11px] text-gray-400">
              Source check: {new Date(data.asAt).toLocaleString()}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-950">
            Precision &amp; predictive-care destination
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            The target is not a generic AI dashboard. InsightCore should turn
            Ambulant+ longitudinal data into patient-specific baselines,
            calibrated risk trajectories, prevention opportunities and
            explainable next-best actions while preserving clinician authority.
          </p>

          <div className="mt-4 space-y-3 text-sm">
            {[
              'Patient-specific normal ranges and deviation trajectories',
              '24-hour, 7-day and 30-day risk horizons where clinically valid',
              'Deterioration, adherence and follow-up-risk prediction',
              'CarePort and MedReach outcome signals feeding longitudinal state',
              'Subgroup calibration, drift and safety monitoring',
              'Clinician-facing evidence trace, uncertainty and abstention',
              'Outcome-linked feedback before any model retraining',
            ].map((item) => (
              <div
                key={item}
                className="rounded-xl border bg-slate-50 px-3 py-2 text-gray-700"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-amber-950">
              Developer readiness notes
            </h2>
            <p className="mt-1 text-sm text-amber-900">
              Internal implementation notes are intentionally visible here
              because this is an Admin-only control surface.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {DEVELOPER_NOTES.map((note) => (
            <article
              key={note.title}
              className="rounded-xl border border-amber-200 bg-white/70 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-950">
                  {note.title}
                </h3>
                <MaturityBadge value={note.status} />
              </div>
              <p className="mt-2 text-xs leading-6 text-gray-700">
                {note.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            href: '/analytics/medical',
            title: 'Medical analytics',
            body: 'Syndromic and clinical analytics without mock fallback.',
          },
          {
            href: '/analytics/patient-engagement',
            title: 'Patient engagement',
            body: 'Engagement, adherence and longitudinal utilisation.',
          },
          {
            href: '/patients',
            title: 'Patient operations',
            body: 'Operational patient context and InsightCore flags.',
          },
          {
            href: '/reports',
            title: 'Reports',
            body: 'Governed reporting and research surfaces.',
          },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="text-sm font-semibold text-gray-950">
              {item.title}
            </div>
            <div className="mt-2 text-xs leading-5 text-gray-600">
              {item.body}
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
