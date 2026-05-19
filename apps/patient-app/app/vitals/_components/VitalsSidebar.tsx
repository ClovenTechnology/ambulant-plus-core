'use client';

import React from 'react';
import SleepCard from '@/components/charts/SleepCard';
import WearableInsightsCard from './WearableInsightsCard';

type VitalsSidebarProps = {
  discreet: boolean;
};

export default function VitalsSidebar({
  discreet,
}: VitalsSidebarProps) {
  return (
    <div className="space-y-4">
      <WearableInsightsCard discreet={discreet} />

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3">
          <div className="text-sm font-semibold text-slate-900">Sleep</div>
          <div className="text-xs text-slate-500">Recovery and rest snapshot</div>
        </div>

        {discreet ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <div className="mb-1 font-medium">Discreet mode</div>
            <p className="text-xs text-slate-500">Sleep details are masked.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-2">
            <SleepCard sleep={undefined as any} />
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Experience
        </div>
        <h3 className="mt-3 text-sm font-semibold text-slate-900">
          Calm, premium health UI
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This shell adds softer depth, glassmorphism, cleaner spacing, and
          stronger hierarchy without breaking your current vitals workflow.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">
            Soft gradients
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">
            Glass cards
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">
            Premium spacing
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">
            Health-app feel
          </span>
        </div>
      </section>
    </div>
  );
}