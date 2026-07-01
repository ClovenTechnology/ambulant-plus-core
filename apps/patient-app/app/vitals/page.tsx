// apps/patient-app/app/vitals/page.tsx
// apps/patient-app/app/vitals/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import VitalsPanel from './_components/VitalsPanel';
import VitalsSidebar from './_components/VitalsSidebar';
import {
  isoDate,
  todayDateStr,
  vitalsRangeQuery,
  type VitalsRange,
} from './_lib/vitals-ui';

const queryClient = new QueryClient();

export default function VitalsPage() {
  const [range, setRange] = useState<VitalsRange>('20');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const [discreet, setDiscreet] = useState(false);
  const [hideSensitive, setHideSensitive] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const r = window.localStorage.getItem('vitals:range');
      const cs = window.localStorage.getItem('vitals:customStart');
      const ce = window.localStorage.getItem('vitals:customEnd');
      const d = window.localStorage.getItem('vitals:discreet');
      const hs = window.localStorage.getItem('vitals:hideSensitive');

      if (
        r === '20' ||
        r === '7d' ||
        r === '30d' ||
        r === '90d' ||
        r === '1y' ||
        r === 'custom'
      ) {
        setRange(r);
      }

      if (typeof cs === 'string') setCustomStart(cs);
      if (typeof ce === 'string') setCustomEnd(ce);
      if (d === 'true' || d === 'false') setDiscreet(d === 'true');
      if (hs === 'true' || hs === 'false') setHideSensitive(hs === 'true');

      if (r === 'custom' && !cs && !ce) {
        const end = todayDateStr();
        const start = isoDate(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));
        setCustomStart(start);
        setCustomEnd(end);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('vitals:range', range);
    } catch {}
  }, [range]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('vitals:customStart', customStart);
    } catch {}
  }, [customStart]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('vitals:customEnd', customEnd);
    } catch {}
  }, [customEnd]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('vitals:discreet', String(discreet));
    } catch {}
  }, [discreet]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('vitals:hideSensitive', String(hideSensitive));
    } catch {}
  }, [hideSensitive]);

  const chartsHref = useMemo(() => {
    const q = vitalsRangeQuery(range, customStart, customEnd);
    return `/charts?${q.toString()}`;
  }, [range, customStart, customEnd]);

  const rangeLabel = useMemo(() => {
    switch (range) {
      case '20':
        return 'Last 20 readings';
      case '7d':
        return 'Last 7 days';
      case '30d':
        return 'Last 30 days';
      case '90d':
        return 'Last 90 days';
      case '1y':
        return 'Last 12 months';
      case 'custom':
        if (customStart && customEnd) return `${customStart} → ${customEnd}`;
        if (customStart) return `From ${customStart}`;
        if (customEnd) return `Until ${customEnd}`;
        return 'Custom range';
      default:
        return 'Vitals timeline';
    }
  }, [range, customStart, customEnd]);

  return (
    <QueryClientProvider client={queryClient}>
      <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.10),_transparent_24%),linear-gradient(to_bottom,_#f8fafc,_#eef2ff_35%,_#f8fafc_100%)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-120px] top-[-120px] h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />
          <div className="absolute right-[-80px] top-16 h-72 w-72 rounded-full bg-emerald-200/25 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-violet-200/20 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <section className="overflow-hidden rounded-[32px] border border-white/60 bg-white/70 p-5 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-7">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 shadow-sm">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  Health dashboard
                </div>

                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  Vitals
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-[15px]">
                  A refined overview of live and historical measurements from connected
                  devices, designed to feel calm, premium, and clinically clear.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <InfoPill label="Timeline" value={rangeLabel} />
                  <InfoPill
                    label="Privacy"
                    value={
                      discreet
                        ? 'Discreet mode on'
                        : hideSensitive
                        ? 'Sensitive values hidden'
                        : 'Standard view'
                    }
                  />
                  <InfoPill label="Sources" value="Health Monitor • NexRing" />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                <Link
                  href={chartsHref}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-800"
                >
                  Open Live Charts
                </Link>

                <Link
                  href={chartsHref}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white/85 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
                >
                  Fullscreen Viewer
                </Link>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <HeroMetricCard
                title="Vitals timeline"
                value={range === '20' ? '20' : range === 'custom' ? 'Custom' : range.toUpperCase()}
                subtitle="Active viewing window"
              />
              <HeroMetricCard
                title="Privacy state"
                value={discreet ? 'On' : hideSensitive ? 'Partial' : 'Off'}
                subtitle="Live masking preferences"
              />
              <HeroMetricCard
                title="Connected sources"
                value="2"
                subtitle="Health Monitor + NexRing"
              />
            </div>
          </section>

          <section className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.65fr)_380px]">
            <div className="min-w-0">
              <div className="rounded-[30px] border border-white/60 bg-white/75 p-3 shadow-[0_16px_55px_rgba(15,23,42,0.07)] backdrop-blur-xl sm:p-4">
                <VitalsPanel
                  range={range}
                  setRange={setRange}
                  customStart={customStart}
                  setCustomStart={setCustomStart}
                  customEnd={customEnd}
                  setCustomEnd={setCustomEnd}
                  discreet={discreet}
                  setDiscreet={setDiscreet}
                  hideSensitive={hideSensitive}
                  setHideSensitive={setHideSensitive}
                />
              </div>
            </div>

            <aside className="space-y-5">
              <div className="rounded-[30px] border border-white/60 bg-white/75 p-3 shadow-[0_16px_55px_rgba(15,23,42,0.07)] backdrop-blur-xl sm:p-4">
                <VitalsSidebar discreet={discreet} />
              </div>

              <div className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.96))] p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Experience
                </div>
                <h2 className="mt-2 text-base font-semibold text-slate-900">
                  Reading summary
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  This panel summarises your recent readings and wearable trends in one patient-facing view.
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
              </div>
            </aside>
          </section>
        </div>
      </main>
    </QueryClientProvider>
  );
}

function InfoPill(props: { label: string; value: string }) {
  const { label, value } = props;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/85 px-3 py-1.5 text-xs text-slate-600 shadow-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}

function HeroMetricCard(props: { title: string; value: string; subtitle: string }) {
  const { title, value, subtitle } = props;

  return (
    <div className="rounded-[24px] border border-white/80 bg-white/80 p-4 shadow-sm backdrop-blur">
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
        {title}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
    </div>
  );
}