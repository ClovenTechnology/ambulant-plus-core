'use client';

import React from 'react';
import Link from 'next/link';

import { fmt2 } from '../../../src/lib/number';
import { formatDateTime } from '../../../src/lib/date';
import {
  prettyDevice,
  statusForBp,
  statusForGlucose,
  statusForHr,
  statusForSpo2,
  statusForTemp,
  worstStatus,
  type Status,
  type Vital,
} from '../_lib/vitals-ui';

type VitalsTimelineProps = {
  groupedByDay: Array<[string, Vital[]]>;
  chartsRangeParams: URLSearchParams;
  discreet: boolean;
  hideSensitive: boolean;
  unitC: boolean;
  glucoseMgDl: boolean;
  displayValue: (opts: { value: string; sensitive?: boolean }) => string;
  displayBadge: (
    status: Status,
    sensitive?: boolean,
  ) => { text: string; className: string };
  onAddNote: (vital: Vital) => void;
};

export default function VitalsTimeline(props: VitalsTimelineProps) {
  const {
    groupedByDay,
    chartsRangeParams,
    discreet,
    hideSensitive,
    unitC,
    glucoseMgDl,
    displayValue,
    displayBadge,
    onAddNote,
  } = props;

  return (
    <div className="space-y-4">
      {groupedByDay.map(([dayKey, items]) => (
        <section key={dayKey} className="space-y-2">
          <div className="text-xs font-semibold text-gray-500">{dayKey}</div>

          <div className="space-y-2">
            {items.map((v) => {
              const hrStatus = discreet ? 'unknown' : statusForHr(v.hr);
              const bpStatus = discreet
                ? 'unknown'
                : hideSensitive
                ? 'unknown'
                : statusForBp(v.sys, v.dia);
              const spo2Status = discreet ? 'unknown' : statusForSpo2(v.spo2);
              const tempStatus = discreet ? 'unknown' : statusForTemp(v.temp_c);
              const glucoseStatus = discreet
                ? 'unknown'
                : hideSensitive
                ? 'unknown'
                : statusForGlucose(v.glucose_mg_dl);

              const worst = worstStatus([
                hrStatus,
                bpStatus,
                spo2Status,
                tempStatus,
                glucoseStatus,
              ]);

              const stripe = discreet
                ? 'border-l-2 border-slate-300 bg-white'
                : worst === 'critical'
                ? 'border-l-2 border-red-500 bg-red-50/40'
                : worst === 'warning'
                ? 'border-l-2 border-amber-400 bg-amber-50/40'
                : worst === 'normal'
                ? 'border-l-2 border-emerald-400 bg-white'
                : 'border-l-2 border-slate-300 bg-white';

              const hasNotes = !!v.__annotations?.length;

              const hrBadge = displayBadge(hrStatus, false);
              const bpBadge = displayBadge(bpStatus, true);
              const spo2Badge = displayBadge(spo2Status, false);
              const tempBadge = displayBadge(tempStatus, false);
              const glucoseBadge = displayBadge(glucoseStatus, true);

              const timeStr = new Date(v.ts).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              const tempValue = (() => {
                if (v.temp_c == null) return '—';
                const val = unitC ? v.temp_c : (v.temp_c * 9) / 5 + 32;
                return `${fmt2(val)}${unitC ? ' °C' : ' °F'}`;
              })();

              const glucoseValue = (() => {
                if (v.glucose_mg_dl == null) return '—';
                return glucoseMgDl
                  ? `${fmt2(v.glucose_mg_dl)} mg/dL`
                  : `${fmt2(v.glucose_mg_dl / 18)} mmol/L`;
              })();

              const showNotes = hasNotes && !discreet && !hideSensitive;

              const q = new URLSearchParams(chartsRangeParams);
              q.set('point', v.id);
              const chartHref = `/charts?${q.toString()}`;

              return (
                <div
                  key={v.id}
                  className={`flex flex-col gap-3 rounded-xl px-4 py-3 text-xs md:flex-row md:items-center md:justify-between ${stripe}`}
                >
                  <div className="flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{timeStr}</span>
                      <span className="inline-flex items-center rounded-full bg-slate-100/70 px-2 py-0.5 text-slate-700 backdrop-blur">
                        {prettyDevice(v.device)}
                      </span>
                      {discreet && (
                        <span className="inline-flex items-center rounded-full bg-slate-900 px-2 py-0.5 text-[10px] text-white">
                          Discreet
                        </span>
                      )}
                      {hideSensitive && (
                        <span className="inline-flex items-center rounded-full bg-slate-900 px-2 py-0.5 text-[10px] text-white">
                          Sensitive hidden
                        </span>
                      )}
                    </div>

                    {showNotes && (
                      <div className="text-[11px] text-gray-500">
                        {v.__annotations?.slice(-2).map((a) => a.text).join(' • ')}
                      </div>
                    )}
                    {hasNotes && (discreet || hideSensitive) && (
                      <div className="text-[11px] text-gray-400">Notes hidden</div>
                    )}
                  </div>

                  <div className="grid flex-[2] grid-cols-2 gap-2 text-[11px] md:grid-cols-3">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">HR</span>
                      <span className="font-medium">
                        {displayValue({
                          value: v.hr != null ? `${fmt2(v.hr)} bpm` : '—',
                        })}
                      </span>
                      <span className={`inline-flex rounded px-1.5 py-0.5 ${hrBadge.className}`}>
                        {hrBadge.text}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">BP</span>
                      <span className="font-medium">
                        {displayValue({
                          value:
                            v.sys != null && v.dia != null
                              ? `${fmt2(v.sys)}/${fmt2(v.dia)} mmHg`
                              : '—',
                          sensitive: true,
                        })}
                      </span>
                      <span className={`inline-flex rounded px-1.5 py-0.5 ${bpBadge.className}`}>
                        {bpBadge.text}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">SpO₂</span>
                      <span className="font-medium">
                        {displayValue({
                          value: v.spo2 != null ? `${fmt2(v.spo2)}%` : '—',
                        })}
                      </span>
                      <span className={`inline-flex rounded px-1.5 py-0.5 ${spo2Badge.className}`}>
                        {spo2Badge.text}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">Temp</span>
                      <span className="font-medium">{displayValue({ value: tempValue })}</span>
                      <span className={`inline-flex rounded px-1.5 py-0.5 ${tempBadge.className}`}>
                        {tempBadge.text}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">Glucose</span>
                      <span className="font-medium">
                        {displayValue({
                          value: glucoseValue,
                          sensitive: true,
                        })}
                      </span>
                      <span className={`inline-flex rounded px-1.5 py-0.5 ${glucoseBadge.className}`}>
                        {glucoseBadge.text}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-gray-400">
                      <span>{discreet ? '—' : formatDateTime(v.ts)}</span>
                    </div>
                  </div>

                  <div className="flex flex-row gap-1 md:flex-col md:items-end">
                    <button
                      onClick={() => onAddNote(v)}
                      className="rounded-2xl border border-slate-200 bg-white px-2 py-1 text-[11px] shadow-sm hover:bg-slate-50 disabled:opacity-60"
                      type="button"
                      disabled={discreet}
                      title={discreet ? 'Notes disabled in Discreet mode' : 'Add a note'}
                    >
                      Add Note(s)
                    </button>

                    <Link href={chartHref} className="text-[11px] text-blue-600 underline">
                      Chart
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}