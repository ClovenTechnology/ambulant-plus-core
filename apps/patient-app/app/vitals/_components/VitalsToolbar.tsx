'use client';

import React from 'react';
import { exportElementAsPdf, shareFile } from '@/components/charts/export';
import { isoDate, todayDateStr, type VitalsRange } from '../_lib/vitals-ui';

type VitalsToolbarProps = {
  range: VitalsRange;
  setRange: (r: VitalsRange) => void;
  customStart: string;
  setCustomStart: (v: string) => void;
  customEnd: string;
  setCustomEnd: (v: string) => void;

  discreet: boolean;
  setDiscreet: (v: boolean) => void;
  hideSensitive: boolean;
  setHideSensitive: (v: boolean) => void;

  unitC: boolean;
  setUnitC: React.Dispatch<React.SetStateAction<boolean>>;
  glucoseMgDl: boolean;
  setGlucoseMgDl: React.Dispatch<React.SetStateAction<boolean>>;

  view: 'list' | 'graph';
  setView: (v: 'list' | 'graph') => void;

  exportRef: React.RefObject<HTMLElement | null>;
  downloadCSV: () => void;

  exportDisabledReason: string | null;
  lastUpdateLabel: string;
};

const rangeButtons: Array<{ key: VitalsRange; label: string }> = [
  { key: '20', label: 'Last 20' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: '1y', label: '1 year' },
  { key: 'custom', label: 'Custom' },
];

export default function VitalsToolbar(props: VitalsToolbarProps) {
  const {
    range,
    setRange,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    discreet,
    setDiscreet,
    hideSensitive,
    setHideSensitive,
    unitC,
    setUnitC,
    glucoseMgDl,
    setGlucoseMgDl,
    view,
    setView,
    exportRef,
    downloadCSV,
    exportDisabledReason,
    lastUpdateLabel,
  } = props;

  return (
    <div className="flex flex-col gap-4 border-b border-slate-100 px-5 pb-3 pt-4 md:flex-row md:items-start md:justify-between">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2">
            <label className="text-sm text-gray-600">Temp</label>
            <button
              onClick={() => setUnitC((c) => !c)}
              className="rounded-2xl border border-slate-200 bg-white px-2.5 py-1 text-xs shadow-sm hover:bg-slate-50"
              type="button"
            >
              {unitC ? '°C' : '°F'}
            </button>
          </div>

          <div className="inline-flex items-center gap-2">
            <label className="text-sm text-gray-600">Glucose</label>
            <button
              onClick={() => setGlucoseMgDl((g) => !g)}
              className="rounded-2xl border border-slate-200 bg-white px-2.5 py-1 text-xs shadow-sm hover:bg-slate-50"
              type="button"
            >
              {glucoseMgDl ? 'mg/dL' : 'mmol/L'}
            </button>
          </div>

          <div className="ml-0 inline-flex items-center rounded-full bg-slate-100 p-1 text-xs md:ml-2">
            <span className="mr-2 pl-2 text-slate-500">Range</span>
            {rangeButtons.map((btn) => (
              <button
                key={btn.key}
                onClick={() => {
                  if (btn.key === 'custom') {
                    if (!customStart && !customEnd) {
                      const end = todayDateStr();
                      const start = isoDate(
                        new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
                      );
                      setCustomStart(start);
                      setCustomEnd(end);
                    }
                  }
                  setRange(btn.key);
                }}
                className={`rounded-full px-3 py-1 ${
                  range === btn.key
                    ? 'bg-white shadow-sm text-slate-900'
                    : 'text-slate-500'
                }`}
                type="button"
              >
                {btn.label}
              </button>
            ))}
          </div>

          <div className="ml-0 inline-flex items-center rounded-full bg-slate-100 p-0.5 text-xs md:ml-3">
            <button
              onClick={() => setView('list')}
              className={`rounded-full px-3 py-1 ${
                view === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
              }`}
              type="button"
            >
              List
            </button>
            <button
              onClick={() => setView('graph')}
              className={`rounded-full px-3 py-1 ${
                view === 'graph' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
              }`}
              type="button"
            >
              Graph
            </button>
          </div>

          <div className="ml-0 inline-flex items-center gap-2 md:ml-2">
            <button
              onClick={() => setDiscreet(!discreet)}
              className={`rounded-full border px-3 py-1 text-xs ${
                discreet
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-gray-200 bg-white text-gray-700'
              }`}
              type="button"
              aria-pressed={discreet}
              title="Mask values and disable tooltips"
            >
              {discreet ? '🙈 Discreet' : 'Discreet'}
            </button>
            <button
              onClick={() => setHideSensitive(!hideSensitive)}
              className={`rounded-full border px-3 py-1 text-xs ${
                hideSensitive
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-gray-200 bg-white text-gray-700'
              }`}
              type="button"
              aria-pressed={hideSensitive}
              title="Hide sensitive metrics (BP + Glucose)"
            >
              {hideSensitive ? '🔒 Sensitive hidden' : 'Hide sensitive'}
            </button>
          </div>
        </div>

        {range === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <span className="text-gray-500">From</span>
            <input
              type="date"
              className="rounded-2xl border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              className="rounded-2xl border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
            <span className="text-[11px] text-gray-400">(Leave “to” empty for open-ended)</span>
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={downloadCSV}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm hover:bg-slate-50 disabled:opacity-50"
            title={exportDisabledReason ?? 'Export CSV'}
            aria-label="Export vitals as CSV file"
            type="button"
            disabled={!!exportDisabledReason}
          >
            📥 CSV
          </button>

          <button
            onClick={async () => {
              const el = exportRef.current;
              if (!el) return;
              const base = discreet || hideSensitive ? 'vitals-redacted' : 'vitals';
              await exportElementAsPdf(el, `${base}-${new Date().toISOString()}.pdf`);
            }}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm hover:bg-slate-50 disabled:opacity-50"
            title={exportDisabledReason ?? 'Export PDF'}
            aria-label="Export vitals as PDF file"
            type="button"
            disabled={!!exportDisabledReason}
          >
            📥 PDF
          </button>

          <button
            onClick={async () => {
              const el = exportRef.current;
              if (!el) return;
              const canvas = await import('html2canvas').then((m) => m.default(el));
              canvas.toBlob(async (blob) => {
                if (!blob) return;
                await shareFile({
                  blob,
                  filename: `${
                    discreet || hideSensitive ? 'vitals-redacted' : 'vitals'
                  }-${Date.now()}.png`,
                  text: 'Vitals snapshot',
                });
              });
            }}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm hover:bg-slate-50 disabled:opacity-50"
            aria-label="Share vitals snapshot"
            type="button"
            disabled={!!exportDisabledReason}
          >
            Share
          </button>
        </div>

        <div className="text-[11px] text-gray-400" aria-live="polite">
          {lastUpdateLabel ? `Updated ${lastUpdateLabel}` : 'Awaiting first reading…'}
        </div>
      </div>
    </div>
  );
}