// apps/patient-app/components/lady-center/TodaySummaryCard.tsx
'use client';

import Link from 'next/link';
import React from 'react';

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function Pill({
  children,
  tone = 'slate',
}: {
  children: React.ReactNode;
  tone?: 'slate' | 'blue' | 'emerald' | 'amber' | 'rose' | 'violet';
}) {
  const toneCls =
    tone === 'blue'
      ? 'bg-blue-50 text-blue-700 ring-blue-200'
      : tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : tone === 'amber'
      ? 'bg-amber-50 text-amber-800 ring-amber-200'
      : tone === 'rose'
      ? 'bg-rose-50 text-rose-700 ring-rose-200'
      : tone === 'violet'
      ? 'bg-violet-50 text-violet-700 ring-violet-200'
      : 'bg-slate-50 text-slate-700 ring-slate-200';

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ring-1', toneCls)}>
      {children}
    </span>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200/70 bg-white/70 shadow-[0_1px_0_rgba(15,23,42,0.04),0_18px_45px_rgba(2,6,23,0.07)] backdrop-blur',
        className
      )}
    >
      {children}
    </div>
  );
}

function RevealOverlay({ onReveal }: { onReveal: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-2xl">
      <button
        className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow hover:bg-slate-800"
        onClick={onReveal}
      >
        Tap to reveal
      </button>
    </div>
  );
}

function InfoCard(props: { k: string; v: string; discreet: boolean; onReveal: () => void }) {
  const { k, v, discreet, onReveal } = props;
  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-500">{k}</div>
      <div className={cn('mt-1 text-sm font-semibold text-slate-900', discreet ? 'blur-[6px] select-none' : '')}>
        {v}
      </div>
      {discreet ? <RevealOverlay onReveal={onReveal} /> : null}
    </div>
  );
}

export default function TodaySummaryCard(props: {
  summary: {
    title: string;
    subtitle: string;
    primary: { k: string; v: string };
    secondary: Array<{ k: string; v: string }>;
  };
  discreet: boolean;
  sensitiveHidden: boolean;
  onReveal: () => void;
  onFindCare: () => void;
}) {
  const { summary, discreet, sensitiveHidden, onReveal, onFindCare } = props;

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-blue-300/20 via-violet-300/15 to-emerald-300/20 blur-2xl" />
        <div className="absolute -left-20 bottom-[-4rem] h-56 w-56 rounded-full bg-gradient-to-tr from-amber-300/15 via-rose-300/15 to-blue-300/15 blur-2xl" />
      </div>

      <div className="relative p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">{summary.title}</div>
            <div className="mt-1 text-sm text-slate-600">{summary.subtitle}</div>
          </div>
          <div className="flex items-center gap-2">
            {discreet ? (
              <button
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={onReveal}
                title="Reveal for 30 seconds"
              >
                Reveal
              </button>
            ) : null}
            <Link
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              href="/clinicians"
              title="Find clinicians"
              onClick={onFindCare}
            >
              Find care
            </Link>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <InfoCard k={summary.primary.k} v={summary.primary.v} discreet={sensitiveHidden} onReveal={onReveal} />
          {summary.secondary.map((x) => (
            <InfoCard key={x.k} k={x.k} v={x.v} discreet={sensitiveHidden} onReveal={onReveal} />
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Pill tone="blue">Explainable</Pill>
          <Pill tone="emerald">You control tracking</Pill>
          <Pill tone="violet">Export anytime</Pill>
          <span className="text-xs text-slate-500">
            {discreet ? 'Discreet Mode keeps labels neutral and details hidden by default.' : 'Tip: Turn on Discreet Mode for shared screens.'}
          </span>
        </div>
      </div>
    </Card>
  );
}
