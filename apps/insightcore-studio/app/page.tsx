import { gatewayBase } from '@/src/lib/env';
async function getDashboard() {
  try {
    const base = gatewayBase();
    const r = await fetch(`${base}/api/insightcore/studio/dashboard`, {
      cache: 'no-store',
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => ({ metrics: null }));
    return j.metrics;
  } catch {
    return null;
  }
}

async function getDashboardDetail() {
  try {
    const base = gatewayBase();
    const r = await fetch(`${base}/api/insightcore/studio/dashboard/detail`, {
      cache: 'no-store',
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => ({ snapshot: null }));
    return j.snapshot;
  } catch {
    return null;
  }
}

import Link from 'next/link';

function Section({
  title,
  children,
}: {
  title: string;
  children: string[];
}) {
  return (
    <div>
      <div className="text-sm uppercase tracking-wider text-slate-400">{title}</div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {children.map((href) => (
          <Link
            key={href}
            href={href}
            className="rounded-[28px] border border-white/10 bg-white/5 p-5 transition-transform duration-200 hover:-translate-y-1"
          >
            <div className="text-lg font-semibold">{href}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function InsightCoreStudioHome() {
  const metrics = await getDashboard();
  const detail = await getDashboardDetail();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="text-sm font-medium uppercase tracking-[0.28em] text-cyan-300/80">
          InsightCore Studio
        </div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Research, governance and clinical intelligence control surface
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
          Review evidence traces, lineage, pathways, alerts and governed intelligence behavior from one shared operational environment.
        </p>

        {/* METRICS */}
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {metrics ? (
            <>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <div className="text-sm text-slate-400">Episodes</div>
                <div className="mt-2 text-3xl font-semibold">{metrics.totalEpisodes}</div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <div className="text-sm text-slate-400">High/Critical</div>
                <div className="mt-2 text-3xl font-semibold">{metrics.highOrCriticalEpisodes}</div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <div className="text-sm text-slate-400">Traces</div>
                <div className="mt-2 text-3xl font-semibold">{metrics.totalTraces}</div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <div className="text-sm text-slate-400">Lineage</div>
                <div className="mt-2 text-3xl font-semibold">{metrics.totalLineageRecords}</div>
              </div>
            </>
          ) : (
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-slate-300 md:col-span-4">
              Dashboard metrics are not available yet.
            </div>
          )}
        </div>

        {/* DETAIL */}
        <div className="mt-6 rounded-[24px] border border-white/10 bg-white/5 p-5">
          {detail ? (
            <>
              <div className="text-sm text-slate-400">Operator notes</div>
              <div className="mt-3 space-y-2">
                {(detail.notes || []).map((note: string) => (
                  <div key={note} className="text-sm text-slate-300">
                    {note}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-slate-300">
              Detailed operator snapshot not available yet.
            </div>
          )}
        </div>

        {/* NEW STRUCTURED NAV */}
        <div className="mt-10 space-y-10">

          {/* CORE */}
          <Section title="Core Intelligence">
            {[
              '/episodes',
              '/trace',
              '/lineage',
              '/baseline',
              '/runtime',
            ]}
          </Section>

          {/* DOMAIN */}
          <Section title="Domain Intelligence">
            {[
              '/domain',
              '/domain/sleep-trajectory',
              '/domain/baseline-state',
              '/domain/autonomic',
            ]}
          </Section>

          {/* RESEARCH */}
          <Section title="Research">
            {[
              '/research/pipelines',
              '/cohort',
              '/cohort/research',
            ]}
          </Section>

          {/* EVALUATION */}
          <Section title="Evaluation">
            {[
              '/evaluation',
              '/evaluation/models',
              '/evaluation/runtime-drift',
              '/evaluation/baseline-drift',
            ]}
          </Section>

          {/* GOVERNANCE */}
          <Section title="Governance & Compliance">
            {[
              '/governance/compliance',
              '/governance/runtime-policy',
              '/governance/rollout-safety',
              '/governance/policy-drift',
            ]}
          </Section>

        </div>
      </div>
    </main>
  );
}
