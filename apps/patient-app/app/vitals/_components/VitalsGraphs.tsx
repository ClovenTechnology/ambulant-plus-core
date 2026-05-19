// apps/patient-app/app/vitals/_components/VitalsGraphs.tsx
'use client';

import React, { useMemo } from 'react';

import { fmt2 } from '../../../src/lib/number';
import BpChart from '@/components/charts/BpChart';
import VitalSparkline from './VitalSparkline';
import {
  isSensitiveMetric,
  statusForGlucose,
  statusForHr,
  statusForSpo2,
  statusForTemp,
  type Status,
} from '../_lib/vitals-ui';

type GraphTab = 'bp' | 'hr' | 'spo2' | 'temp' | 'glucose' | 'steps';

type BpInputPoint = {
  ts: string;
  sys: number;
  dia: number;
};

type SparklineData = {
  bpPoints: BpInputPoint[];
  bpSys: Array<number | null>;
  bpDia: Array<number | null>;
  bp_ts: string[];
  hr: Array<number | null>;
  hr_ts: string[];
  spo2: Array<number | null>;
  spo2_ts: string[];
  temp: Array<number | null>;
  temp_ts: string[];
  glucose: Array<number | null>;
  glucose_ts: string[];
  steps: Array<number | null>;
};

type VitalsGraphsProps = {
  graphTab: GraphTab;
  setGraphTab: (tab: GraphTab) => void;
  discreet: boolean;
  hideSensitive: boolean;
  unitC: boolean;
  glucoseMgDl: boolean;
  sparklineData: SparklineData;
  currentTabBadge: { text: string; className: string };
  deviceSetForWindow: string;
  sensitiveTabHidden: boolean;
};

type BpChartData = NonNullable<React.ComponentProps<typeof BpChart>['data']>;
type BpChartPoint = BpChartData[number];

function toFiniteTimestamp(value: string, fallbackIndex: number): number {
  const parsed = Date.parse(value);

  if (Number.isFinite(parsed)) return parsed;

  return fallbackIndex;
}

function normaliseBpChartData(points: BpInputPoint[]): BpChartData {
  return points
    .map((point, index): BpChartPoint | null => {
      const sys = Number(point.sys);
      const dia = Number(point.dia);

      if (!Number.isFinite(sys) || !Number.isFinite(dia)) return null;

      return {
        ts: toFiniteTimestamp(point.ts, index),
        sys,
        dia,
      } as BpChartPoint;
    })
    .filter((point): point is BpChartPoint => point !== null);
}

function tabLabel(tab: GraphTab, locked: boolean) {
  if (tab === 'bp') return locked ? '🔒 Blood Pressure' : 'Blood Pressure';
  if (tab === 'hr') return 'Heart Rate';
  if (tab === 'spo2') return 'SpO₂';
  if (tab === 'temp') return 'Body Temp';
  if (tab === 'glucose') return locked ? '🔒 Glucose' : 'Glucose';
  return 'Steps';
}

function graphCaption(
  graphTab: GraphTab,
  unitC: boolean,
  glucoseMgDl: boolean,
) {
  if (graphTab === 'bp') return 'BP (sys/dia mmHg) — recent readings';
  if (graphTab === 'hr') return 'Heart Rate (bpm) — recent readings';
  if (graphTab === 'spo2') return 'SpO₂ (%) — recent readings';

  if (graphTab === 'temp') {
    return `Temp (${unitC ? '°C' : '°F'}) — recent readings`;
  }

  if (graphTab === 'glucose') {
    return `Glucose (${glucoseMgDl ? 'mg/dL' : 'mmol/L'}) — recent readings`;
  }

  return 'Steps — recent intervals';
}

function EmptyChartState({ label }: { label: string }) {
  return (
    <div className="grid min-h-[72px] place-items-center rounded-lg border border-dashed bg-slate-50 p-4 text-xs text-slate-500">
      {label}
    </div>
  );
}

export default function VitalsGraphs(props: VitalsGraphsProps) {
  const {
    graphTab,
    setGraphTab,
    discreet,
    hideSensitive,
    unitC,
    glucoseMgDl,
    sparklineData,
    currentTabBadge,
    deviceSetForWindow,
    sensitiveTabHidden,
  } = props;

  const bpChartData = useMemo(
    () => normaliseBpChartData(sparklineData.bpPoints),
    [sparklineData.bpPoints],
  );

  return (
    <div className="space-y-4">
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(['bp', 'hr', 'spo2', 'temp', 'glucose', 'steps'] as const).map(
            (tab) => {
              const locked =
                hideSensitive &&
                isSensitiveMetric(
                  tab === 'bp'
                    ? 'bp'
                    : tab === 'glucose'
                      ? 'glucose'
                      : tab,
                );

              return (
                <button
                  key={tab}
                  onClick={() => setGraphTab(tab)}
                  className={`rounded-full px-3 py-1 text-xs ${
                    graphTab === tab
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-gray-700'
                  }`}
                  type="button"
                  title={locked ? 'Hidden by Hide sensitive' : undefined}
                >
                  {tabLabel(tab, locked)}
                </button>
              );
            },
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
          <div className="inline-flex items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 ${currentTabBadge.className}`}
            >
              {discreet || sensitiveTabHidden ? '-' : currentTabBadge.text}
            </span>

            <span className="text-gray-500">
              Source: {discreet ? '—' : deviceSetForWindow}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        {sensitiveTabHidden ? (
          <div className="rounded-lg border border-dashed bg-gray-50 p-4 text-sm text-gray-700">
            <div className="mb-1 font-medium">Sensitive metric hidden</div>
            <p className="text-xs text-gray-500">
              Turn off <span className="font-medium">Hide sensitive</span> to
              view this chart.
            </p>
          </div>
        ) : discreet ? (
          <div className="rounded-lg border border-dashed bg-gray-50 p-4 text-sm text-gray-700">
            <div className="mb-1 font-medium">Discreet mode</div>
            <p className="text-xs text-gray-500">
              Values and tooltips are masked. Turn off{' '}
              <span className="font-medium">Discreet</span> to view details.
            </p>

            <div className="mt-3">
              {graphTab === 'bp' && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-lg border bg-white p-2">
                    <div className="mb-1 text-[11px] text-gray-500">
                      Systolic trend
                    </div>
                    <VitalSparkline
                      values={sparklineData.bpSys}
                      timestamps={sparklineData.bp_ts}
                      statusFn={() => 'unknown' as Status}
                      tooltipDisabled
                      valueFormatter={() => '•••'}
                    />
                  </div>

                  <div className="rounded-lg border bg-white p-2">
                    <div className="mb-1 text-[11px] text-gray-500">
                      Diastolic trend
                    </div>
                    <VitalSparkline
                      values={sparklineData.bpDia}
                      timestamps={sparklineData.bp_ts}
                      statusFn={() => 'unknown' as Status}
                      tooltipDisabled
                      valueFormatter={() => '•••'}
                    />
                  </div>
                </div>
              )}

              {graphTab === 'hr' && (
                <VitalSparkline
                  values={sparklineData.hr}
                  timestamps={sparklineData.hr_ts}
                  statusFn={statusForHr}
                  tooltipDisabled
                  valueFormatter={() => '•••'}
                />
              )}

              {graphTab === 'spo2' && (
                <VitalSparkline
                  values={sparklineData.spo2}
                  timestamps={sparklineData.spo2_ts}
                  statusFn={statusForSpo2}
                  tooltipDisabled
                  valueFormatter={() => '•••'}
                />
              )}

              {graphTab === 'temp' && (
                <VitalSparkline
                  values={sparklineData.temp}
                  timestamps={sparklineData.temp_ts}
                  statusFn={statusForTemp}
                  unit={unitC ? '°C' : '°F'}
                  tooltipDisabled
                  valueFormatter={() => '•••'}
                />
              )}

              {graphTab === 'glucose' && (
                <VitalSparkline
                  values={sparklineData.glucose}
                  timestamps={sparklineData.glucose_ts}
                  statusFn={statusForGlucose}
                  unit={glucoseMgDl ? 'mg/dL' : 'mmol/L'}
                  tooltipDisabled
                  valueFormatter={() => '•••'}
                />
              )}

              {graphTab === 'steps' && (
                <VitalSparkline
                  values={sparklineData.steps}
                  statusFn={() => 'normal' as Status}
                  tooltipDisabled
                  valueFormatter={() => '•••'}
                />
              )}
            </div>
          </div>
        ) : (
          <>
            {graphTab === 'bp' &&
              (bpChartData.length > 0 ? (
                <BpChart data={bpChartData} />
              ) : (
                <EmptyChartState label="No blood-pressure readings available for this range." />
              ))}

            {graphTab === 'hr' && (
              <VitalSparkline
                values={sparklineData.hr}
                timestamps={sparklineData.hr_ts}
                statusFn={statusForHr}
                tooltipDisabled={false}
                unit="bpm"
                valueFormatter={(v) => fmt2(v)}
              />
            )}

            {graphTab === 'spo2' && (
              <VitalSparkline
                values={sparklineData.spo2}
                timestamps={sparklineData.spo2_ts}
                statusFn={statusForSpo2}
                tooltipDisabled={false}
                unit="%"
                valueFormatter={(v) => fmt2(v)}
              />
            )}

            {graphTab === 'temp' && (
              <VitalSparkline
                values={sparklineData.temp}
                timestamps={sparklineData.temp_ts}
                statusFn={statusForTemp}
                unit={unitC ? '°C' : '°F'}
                tooltipDisabled={false}
                valueFormatter={(v) => fmt2(v)}
              />
            )}

            {graphTab === 'glucose' && (
              <VitalSparkline
                values={sparklineData.glucose}
                timestamps={sparklineData.glucose_ts}
                statusFn={statusForGlucose}
                unit={glucoseMgDl ? 'mg/dL' : 'mmol/L'}
                tooltipDisabled={false}
                valueFormatter={(v) => fmt2(v)}
              />
            )}

            {graphTab === 'steps' && (
              <VitalSparkline
                values={sparklineData.steps}
                statusFn={() => 'normal' as Status}
                tooltipDisabled={false}
                valueFormatter={(v) => fmt2(v)}
              />
            )}

            <div className="mt-2 text-[11px] text-gray-500">
              {graphCaption(graphTab, unitC, glucoseMgDl)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}