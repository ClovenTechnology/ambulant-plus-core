// apps/patient-app/components/lady-center/ScreeningChecklist.tsx
'use client';

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

function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        {subtitle ? <div className="mt-0.5 text-xs text-slate-600">{subtitle}</div> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export type ScreeningItemUI = {
  key: string;
  title: string;
  desc: string;
  cadence: string;
  lastDoneISO?: string | null;
  nextDueISO?: string | null;
  status: 'due' | 'ok' | 'overdue' | 'unknown';
};

export default function ScreeningChecklist(props: {
  items: ScreeningItemUI[];
  onReminders: () => void;
  onMarkDone: (key: string) => void;
  onBook: (key: string) => void;
  formatNiceDate: (iso?: string | null) => string;
}) {
  const { items, onReminders, onMarkDone, onBook, formatNiceDate } = props;

  return (
    <Card className="p-5">
      <SectionHeader
        title="Screening & Preventive Care"
        subtitle="Simple reminders, clinician-guided."
        right={
          <button
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={onReminders}
          >
            Reminders
          </button>
        }
      />

      <div className="mt-4 space-y-2">
        {items.map((it) => {
          const tone = it.status === 'overdue' ? 'amber' : it.status === 'ok' ? 'emerald' : 'slate';
          return (
            <div key={it.key} className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{it.title}</div>
                  <div className="mt-0.5 text-xs text-slate-600">{it.desc}</div>
                </div>
                <Pill tone={tone as any}>
                  {it.status === 'ok' ? 'On track' : it.status === 'overdue' ? 'Overdue' : 'Not set'}
                </Pill>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div>
                  <div className="text-slate-500">Last done</div>
                  <div className="font-medium text-slate-800">{formatNiceDate(it.lastDoneISO)}</div>
                </div>
                <div>
                  <div className="text-slate-500">Next due</div>
                  <div className="font-medium text-slate-800">{formatNiceDate(it.nextDueISO)}</div>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  onClick={() => onMarkDone(it.key)}
                >
                  Mark done
                </button>
                <button
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => onBook(it.key)}
                >
                  Book
                </button>
              </div>

              <div className="mt-2 text-[11px] text-slate-500">Cadence: {it.cadence}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
