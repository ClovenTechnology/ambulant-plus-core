'use client';

import { ChevronDown } from 'lucide-react';
import { Line } from 'react-chartjs-2';

export default function LadyCenterTimelinePanel(props: {
  show: boolean;
  onToggle: () => void;
  windowDays: 14 | 28 | 90;
  onChangeWindow: (days: 14 | 28 | 90) => void;
  visibleSeries: Record<string, boolean>;
  onToggleSeries: (key: string) => void;
  discreet: boolean;
  sensitiveHidden: boolean;
  onReveal: () => void;
  chartData: any;
  chartOptions: any;
}) {
  const {
    show,
    onToggle,
    windowDays,
    onChangeWindow,
    visibleSeries,
    onToggleSeries,
    discreet,
    sensitiveHidden,
    onReveal,
    chartData,
    chartOptions,
  } = props;

  return (
    <div className="mt-4">
      <button
        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <ChevronDown className={`h-4 w-4 transition ${show ? 'rotate-0' : '-rotate-90'}`} />
          <span className="text-sm font-semibold text-slate-900">Trends</span>
          <span className="text-xs text-slate-500">ΔTemp, HRV, RHR, sleep</span>
        </div>

        <div className="flex items-center gap-2">
          {[14, 28, 90].map((d) => (
            <button
              key={d}
              className={[
                'rounded-xl border px-2.5 py-1 text-xs',
                windowDays === d
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
              ].join(' ')}
              onClick={(e) => {
                e.stopPropagation();
                onChangeWindow(d as 14 | 28 | 90);
              }}
            >
              {d}d
            </button>
          ))}
        </div>
      </button>

      {show ? (
        <div className={`relative mt-3 rounded-2xl border border-slate-200 bg-white p-4 ${sensitiveHidden ? 'blur-sm select-none' : ''}`}>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {[
              ['ΔTemp', 'deltaTemp'],
              ['RHR', 'rhr'],
              ['HRV', 'hrv'],
              ['Resp', 'respRate'],
              ['SpO₂', 'spo2'],
              ['Sleep', 'sleepScore'],
            ].map(([label, key]) => (
              <label key={key} className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-slate-900"
                  checked={!!visibleSeries[key]}
                  onChange={() => onToggleSeries(key)}
                />
                <span className="text-slate-700">{label}</span>
              </label>
            ))}
            {discreet ? (
              <button
                className="ml-auto rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={onReveal}
              >
                Reveal
              </button>
            ) : null}
          </div>

          <div className="mt-3 h-[320px]">
            <Line data={chartData} options={chartOptions} />
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