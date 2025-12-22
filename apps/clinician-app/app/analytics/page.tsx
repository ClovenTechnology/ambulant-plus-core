// apps/clinician-app/app/analytics/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_APIGW_BASE ?? 'http://localhost:3010';

type PlanTier = 'free' | 'basic' | 'pro' | 'host';

type MePlanSummary = {
  planTier: PlanTier;
  clinicianName: string;
};

export default function ClinicianAnalyticsHubPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [plan, setPlan] = useState<MePlanSummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`${API}/analytics/clinicians/me/meta`, {
          cache: 'no-store',
          headers: {
            'x-role': 'clinician',
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const js = (await res.json().catch(() => null)) as MePlanSummary | null;
        if (cancelled) return;
        setPlan(
          js || {
            planTier: 'basic',
            clinicianName: 'Demo clinician',
          },
        );
      } catch (e: any) {
        console.error('[analytics hub] failed', e);
        if (cancelled) return;
        setErr(e?.message || 'Failed to load analytics meta; using demo.');
        setPlan({
          planTier: 'basic',
          clinicianName: 'Demo clinician',
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const planTier = plan?.planTier ?? 'basic';

  const upgradeCta = (
    <Link
      href="/payout"
      className="inline-flex items-center rounded-full border border-indigo-600 px-3 py-1.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50"
    >
      Upgrade plan →
    </Link>
  );

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Analytics &amp; performance
          </h1>
          <p className="text-sm text-gray-500">
            See how your consult volumes, punctuality and earnings trends evolve over time.
          </p>
          {plan && (
            <p className="mt-1 text-[11px] text-gray-500">
              Signed in as <span className="font-medium">{plan.clinicianName}</span> · Plan:{' '}
              <span className="uppercase">{plan.planTier}</span>
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 text-[11px] text-gray-500">
          {loading && <span>Loading…</span>}
          {err && <span className="max-w-xs text-right text-amber-700">{err}</span>}
        </div>
      </header>

      {/* Plan gating */}
      {planTier === 'free' && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-2">
          <div className="font-semibold text-[13px]">Analytics are not available on the Free plan.</div>
          <p>
            Upgrade to <span className="font-semibold">Basic</span> to unlock your own performance dashboard, or to{' '}
            <span className="font-semibold">Pro / Host</span> to see deeper insights and team analytics.
          </p>
          {upgradeCta}
        </section>
      )}

      {planTier !== 'free' && (
        <section className="grid gap-4 md:grid-cols-2 text-sm">
          <button
            type="button"
            onClick={() => router.push('/analytics/me')}
            className="text-left border rounded-xl bg-white p-4 hover:shadow-sm transition flex flex-col justify-between gap-2"
          >
            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-1">
                My consult performance
              </h2>
              <p className="text-xs text-gray-600">
                Consult volumes, punctuality, overruns, earnings and patient mix for your own activity.
              </p>
            </div>
            <span className="text-xs text-indigo-700 mt-1">Open personal analytics →</span>
          </button>

          {(planTier === 'pro' || planTier === 'host') && (
            <button
              type="button"
              onClick={() => router.push('/analytics/team')}
              className="text-left border rounded-xl bg-white p-4 hover:shadow-sm transition flex flex-col justify-between gap-2"
            >
              <div>
                <h2 className="text-sm font-semibold text-gray-900 mb-1">
                  Team / practice analytics
                </h2>
                <p className="text-xs text-gray-600">
                  Track performance of clinicians, admin staff and nurses attached to your practice.
                </p>
              </div>
              <span className="text-xs text-indigo-700 mt-1">Open team analytics →</span>
            </button>
          )}

          {planTier === 'basic' && (
            <div className="rounded-xl border border-dashed bg-slate-50 p-4 text-xs text-gray-600 space-y-2">
              <div className="font-semibold text-[13px]">Team analytics locked on Basic.</div>
              <p>
                Upgrade to <span className="font-semibold">Pro</span> or{' '}
                <span className="font-semibold">Host / Practice</span> to unlock team-wide performance dashboards
                (clinicians, admin and nurses).
              </p>
              {upgradeCta}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
