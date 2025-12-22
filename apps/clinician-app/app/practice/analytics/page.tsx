// apps/clinician-app/app/practice/analytics/page.tsx
'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_APIGW_BASE ?? 'http://localhost:3010';

type PracticeAnalyticsSummary = {
  ok: boolean;
  practiceName: string;
  planTier: 'host' | 'pro' | 'basic' | 'free';
  totalMembers: number;
  totalClinicians: number;
  totalNurses: number;
  totalAdmin: number;
  last30dSessions: number;
  avgPunctualityPct: number;
  avgOverrunMinutes: number;
};

function fallbackSummary(): PracticeAnalyticsSummary {
  return {
    ok: true,
    practiceName: 'Demo Multi-Clinic Practice',
    planTier: 'host',
    totalMembers: 18,
    totalClinicians: 9,
    totalNurses: 4,
    totalAdmin: 5,
    last30dSessions: 420,
    avgPunctualityPct: 92,
    avgOverrunMinutes: 4,
  };
}

export default function PracticeAnalyticsPage() {
  const [summary, setSummary] = useState<PracticeAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`${API}/practice/analytics/summary`, {
          cache: 'no-store',
          headers: {
            'x-role': 'clinician',
            'x-scope': 'practice',
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const js = (await res.json().catch(() => null)) as PracticeAnalyticsSummary | null;
        if (cancelled) return;
        setSummary(js ?? fallbackSummary());
      } catch (e: any) {
        if (cancelled) return;
        console.warn('[practice/analytics] demo fallback', e?.message);
        setErr('Using demo data; practice analytics API not wired yet.');
        setSummary(fallbackSummary());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const planTier = summary?.planTier ?? 'basic';

  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Practice analytics
          </h1>
          <p className="text-sm text-gray-500">
            Volumes, punctuality and overruns across your whole practice.
          </p>
          {summary && (
            <p className="mt-1 text-xs text-gray-500">
              {summary.practiceName} · Plan:{' '}
              <span className="uppercase">{planTier}</span>
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-gray-500">
          {loading && <span>Loading…</span>}
          {err && (
            <span className="max-w-xs text-right text-amber-700">
              {err}
            </span>
          )}
        </div>
      </header>

      {planTier === 'free' && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-2">
          <div className="text-[13px] font-semibold">
            Practice analytics is not available on Free.
          </div>
          <p>
            Upgrade to <span className="font-semibold">Basic</span> for
            clinician-level analytics, or{' '}
            <span className="font-semibold">Pro / Host</span> for
            practice-wide analytics.
          </p>
        </section>
      )}

      {summary && (
        <>
          <section className="grid gap-4 sm:grid-cols-3 text-sm">
            <KpiCard
              label="Members"
              primary={`${summary.totalMembers} total`}
              secondary={`${summary.totalClinicians} clinicians • ${summary.totalNurses} nurses • ${summary.totalAdmin} admin`}
            />
            <KpiCard
              label="Sessions (last 30 days)"
              primary={summary.last30dSessions.toString()}
              secondary="All consults linked to this practice"
            />
            <KpiCard
              label="Punctuality"
              primary={`${summary.avgPunctualityPct.toFixed(0)}%`}
              secondary={`Average overrun ${summary.avgOverrunMinutes.toFixed(
                1,
              )} min`}
            />
          </section>

          <section className="rounded-lg border bg-white p-4 text-xs text-gray-700 space-y-2">
            <h2 className="text-sm font-semibold text-slate-900">
              Where this will grow
            </h2>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                Per-clinician practice view consolidating volumes, punctuality
                and earnings (respecting your case visibility rules).
              </li>
              <li>
                Department-level dashboards for service lines
                (e.g. Cardiology, Mental Health, Occupational Health).
              </li>
              <li>
                InsightCore overlays for high-risk patients, no-show patterns
                and adherence for chronic programs.
              </li>
            </ul>
            <p className="pt-1 text-[11px] text-gray-500">
              Back-end can expose this via a practice-scoped endpoint, e.g.{' '}
              <code className="rounded bg-gray-100 px-1 py-0.5">
                /practice/analytics/summary
              </code>{' '}
              and deeper views under{' '}
              <code className="rounded bg-gray-100 px-1 py-0.5">
                /practice/analytics/members
              </code>
              .
            </p>
          </section>
        </>
      )}
    </main>
  );
}

function KpiCard({
  label,
  primary,
  secondary,
}: {
  label: string;
  primary: string;
  secondary?: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{primary}</div>
      {secondary && (
        <div className="mt-0.5 text-[11px] text-gray-500">
          {secondary}
        </div>
      )}
    </div>
  );
}
