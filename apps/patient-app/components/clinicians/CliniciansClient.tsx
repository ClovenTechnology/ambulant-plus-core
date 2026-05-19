// apps/patient-app/components/clinicians/CliniciansClient.tsx
'use client';

import React from 'react';
import Link from 'next/link';

type Props = { userId: string | null };

export default function CliniciansClient({ userId }: Props) {
  const qs = new URLSearchParams();
  if (userId) qs.set('uid', userId);

  const href = `/clinicians${qs.toString() ? `?${qs.toString()}` : ''}`;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.10),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.12),_transparent_24%),linear-gradient(180deg,_#f8fbff_0%,_#eef5ff_42%,_#f8faff_100%)]">
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <div className="absolute left-[-12%] top-[-8%] h-[420px] w-[420px] rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="absolute right-[-8%] top-[10%] h-[360px] w-[360px] rounded-full bg-fuchsia-300/15 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[18%] h-[300px] w-[300px] rounded-full bg-indigo-300/10 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-10">
        <div className="rounded-[32px] border border-white/60 bg-white/82 backdrop-blur-2xl shadow-[0_24px_80px_rgba(15,23,42,0.10)] p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 shadow-sm">
                Ambulant+ clinician directory
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                Find the right clinician
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                The upgraded clinician discovery experience now lives on the main directory page.
                Use the full directory to search, compare, shortlist favourites, and book with live pricing
                and availability behavior.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <Link
                href="/auto-triage"
                className="px-3.5 py-2 rounded-full border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50"
              >
                Back
              </Link>
              <Link
                href={href}
                className="px-4 py-2 rounded-full bg-slate-950 text-white text-sm hover:bg-slate-800 shadow-sm"
              >
                Open clinicians
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-white/70 bg-white/82 p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Discovery
              </div>
              <div className="mt-2 text-base font-semibold text-slate-900">
                Search and filter
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Browse clinicians by specialty, location, pricing, insurance acceptance, language,
                experience, and availability.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/70 bg-white/82 p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Comparison
              </div>
              <div className="mt-2 text-base font-semibold text-slate-900">
                Shortlist with confidence
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Pin clinicians, compare trust signals, pricing, experience, languages, and next
                availability in one place.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/70 bg-white/82 p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Booking
              </div>
              <div className="mt-2 text-base font-semibold text-slate-900">
                Continue to live booking
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Open a clinician profile, review their calendar, and continue through the unified
                booking flow.
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-[24px] border border-cyan-100 bg-cyan-50/70 p-4 text-sm text-cyan-900">
            This component is now a lightweight entry point to the canonical clinicians directory, so
            the app no longer maintains two competing clinician discovery experiences.
          </div>
        </div>
      </div>
    </main>
  );
}