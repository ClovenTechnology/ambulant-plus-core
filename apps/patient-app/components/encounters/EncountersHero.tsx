// apps/patient-app/components/encounters/EncountersHero.tsx
'use client';

import React from 'react';

export default function EncountersHero({
  totalCases,
  openCases,
  referredCases,
  completedEncounters,
}: {
  totalCases: number;
  openCases: number;
  referredCases: number;
  completedEncounters: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-white px-5 py-5 shadow-sm sm:px-6 sm:py-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-emerald-500/10" />

      <div className="relative">
        <div className="max-w-2xl">
          <div className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
            Care intelligence
          </div>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            Your encounters
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-[15px]">
            Track active cases, review recent clinician touchpoints, and move quickly into the next step of care.
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Total cases" value={totalCases} />
          <StatTile label="Open cases" value={openCases} />
          <StatTile label="Referred cases" value={referredCases} />
          <StatTile label="Completed encounters" value={completedEncounters} />
        </div>
      </div>
    </section>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</div>
    </div>
  );
}