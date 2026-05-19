'use client';

import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

function LegendBadge({ symbol, text }: { symbol: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
      <span>{symbol}</span>
      <span className="text-slate-700">{text}</span>
    </span>
  );
}

export default function LadyCenterCalendarPanel(props: {
  show: boolean;
  onToggle: () => void;
  currentMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  weekdayLabels: string[];
  calendarCells: React.ReactNode[];
  sensitiveHidden: boolean;
  onReveal: () => void;
  symptomChoices: string[];
  quickDateLabel: string;
  quickSymptoms: string[];
  pendingSymptoms: string[];
  onToggleSymptom: (s: string) => void;
  onConfirmSymptoms: () => void;
  onResetSymptoms: () => void;
  symptomIntensity: number[];
  allZeroSymptoms: boolean;
}) {
  const {
    show,
    onToggle,
    currentMonth,
    onPrevMonth,
    onNextMonth,
    weekdayLabels,
    calendarCells,
    sensitiveHidden,
    onReveal,
    symptomChoices,
    quickDateLabel,
    pendingSymptoms,
    onToggleSymptom,
    onConfirmSymptoms,
    onResetSymptoms,
    symptomIntensity,
    allZeroSymptoms,
  } = props;

  return (
    <div className="mt-4">
      <button
        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <ChevronDown className={`h-4 w-4 transition ${show ? 'rotate-0' : '-rotate-90'}`} />
          <span className="text-sm font-semibold text-slate-900">Calendar</span>
          <span className="text-xs text-slate-500">Windows, ovulation markers, notes</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
            onClick={(e) => {
              e.stopPropagation();
              onPrevMonth();
            }}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-sm font-medium text-slate-900">
            {currentMonth.toLocaleString('default', { month: 'long' })} {currentMonth.getFullYear()}
          </div>
          <button
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
            onClick={(e) => {
              e.stopPropagation();
              onNextMonth();
            }}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </button>

      {show ? (
        <div className={`mt-3 rounded-2xl border border-slate-200 bg-white p-4 ${sensitiveHidden ? 'blur-sm select-none' : ''}`}>
          <div className="mb-2 grid grid-cols-7 gap-2 text-xs text-slate-500">
            {weekdayLabels.map((w) => (
              <div key={w} className="text-center">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">{calendarCells}</div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <LegendBadge symbol="💧" text="Period" />
            <LegendBadge symbol="🟦" text="Follicular" />
            <LegendBadge symbol="🔴" text="Luteal" />
            <LegendBadge symbol="⭐" text="Ovulation" />
            <LegendBadge symbol="🌿" text="Fertile window" />
            <LegendBadge symbol="🧪" text="Positive test" />
            <LegendBadge symbol="◌" text="Predicted" />
          </div>

          <div id="lady-quick-symptoms" className="mt-5 space-y-2">
            <div className="text-sm font-semibold text-slate-900">
              Quick symptoms <span className="font-normal text-slate-500">(for {quickDateLabel})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {symptomChoices.map((s) => {
                const active = pendingSymptoms.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => onToggleSymptom(s)}
                    aria-pressed={active}
                    className={[
                      'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition',
                      active
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    {s.replace(/_/g, ' ')}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                onClick={onConfirmSymptoms}
              >
                Confirm symptoms
              </button>
              <button
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={onResetSymptoms}
              >
                Reset
              </button>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-1 text-sm font-semibold text-slate-900">Symptom heatmap (last 28 days)</div>
            {allZeroSymptoms ? (
              <div className="rounded-xl border border-dashed p-4 text-xs text-slate-500">
                No symptoms logged yet. Add symptoms to unlock richer insights.
              </div>
            ) : (
              <div className="grid gap-1 overflow-x-auto" style={{ gridTemplateColumns: 'repeat(28, 12px)' }}>
                {symptomIntensity.map((n, idx) => (
                  <div
                    key={idx}
                    title={`Day ${idx + 1}: ${n} symptom${n === 1 ? '' : 's'}`}
                    className={[
                      'h-3 w-3 rounded',
                      n === 0 ? 'bg-slate-200' : n === 1 ? 'bg-blue-200' : n === 2 ? 'bg-amber-300' : 'bg-rose-400',
                    ].join(' ')}
                  />
                ))}
              </div>
            )}
          </div>

          {sensitiveHidden ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl">
              <button
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow hover:bg-slate-800"
                onClick={onReveal}
              >
                Tap to reveal
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}