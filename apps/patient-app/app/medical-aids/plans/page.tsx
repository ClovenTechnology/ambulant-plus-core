'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  SPONSOR_PLANS,
  sponsorTypeLabel,
  type SponsorType,
} from '@/lib/sponsorPlans';

const FILTERS: Array<'ALL' | SponsorType> = [
  'ALL',
  'MEDICAL_AID',
  'HMO',
  'CORPORATE_SPONSOR',
];

function filterLabel(v: 'ALL' | SponsorType) {
  if (v === 'ALL') return 'All sponsors';
  return sponsorTypeLabel(v);
}

export default function MedicalAidPlansMarketplacePage() {
  const [filter, setFilter] = useState<'ALL' | SponsorType>('ALL');
  const [q, setQ] = useState('');

  const plans = useMemo(() => {
    const term = q.trim().toLowerCase();

    return SPONSOR_PLANS.filter((p) => {
      if (filter !== 'ALL' && p.sponsorType !== filter) return false;

      if (!term) return true;

      return [
        p.sponsorName,
        p.name,
        p.summary,
        p.priceLabel,
        ...p.tags,
      ]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [filter, q]);

  return (
    <main data-p-ui="patient-medical-aid-plans-page" className="min-w-0 overflow-x-clip min-h-screen bg-slate-950 px-4 py-8 text-slate-100 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300">
              Ambulant+ Sponsor Marketplace
            </div>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              Medical Aid, HMO and Sponsor Plans
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Compare available cover, sponsor eligibility, chronic-care support,
              virtual consult readiness, and application options.
            </p>
          </div>

          <Link
            href="/medical-aids"
            className="w-fit rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold hover:bg-slate-900"
          >
            View existing policies
          </Link>
        </header>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search plans, sponsors, chronic care, antenatal, rewards..."
              className="rounded-2xl border border-slate-700 bg-slate-950 p-3 text-sm outline-none"
            />

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="rounded-2xl border border-slate-700 bg-slate-950 p-3 text-sm outline-none"
            >
              {FILTERS.map((f) => (
                <option key={f} value={f}>
                  {filterLabel(f)}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => (
            <article
              key={p.id}
              className="rounded-3xl border border-slate-800 bg-slate-900 p-5"
            >
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
                {sponsorTypeLabel(p.sponsorType)}
              </div>

              <h2 className="mt-3 text-xl font-semibold">{p.sponsorName}</h2>
              <div className="mt-1 text-sm font-medium text-slate-300">{p.name}</div>

              <p className="mt-4 text-sm leading-6 text-slate-300">{p.summary}</p>

              <div className="mt-4 text-sm font-semibold text-slate-100">
                {p.priceLabel}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {p.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-5 grid gap-2">
                <Link
                  href={`/join-scheme?planId=${encodeURIComponent(p.id)}`}
                  className="rounded-2xl bg-sky-500 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-sky-400"
                >
                  Apply / link this plan
                </Link>

                <Link
                  href={`/medical-aids/plans/${encodeURIComponent(p.id)}`}
                  className="rounded-2xl border border-slate-700 px-4 py-3 text-center text-sm font-semibold text-slate-200 hover:bg-slate-800"
                >
                  View plan details
                </Link>
              </div>
            </article>
          ))}
        </section>

        {plans.length === 0 && (
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-300">
            No plans match this search yet.
          </div>
        )}

        <section className="rounded-3xl border border-amber-800 bg-amber-950/30 p-4 text-xs leading-5 text-amber-100">
          Plan recommendations must remain consent-based and explainable. Sponsored placements
          should be clearly labelled separately from InsightCore clinical-fit suggestions.
        </section>
      </div>
    </main>
  );
}