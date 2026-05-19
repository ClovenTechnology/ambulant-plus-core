// apps/patient-app/components/charts/VitalsTrendChart.tsx
'use client';

import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import type { ChartData, ChartOptions } from 'chart.js';
import { motion, type Variants } from 'framer-motion';

import type { Vitals } from '@/types';
import MiniMeterDonut from './MiniMeterDonut';

interface VitalsTrendChartProps {
  vitals: Vitals;
}

type TrendPoint = {
  label: string;
  hr: number | null;
  temp: number | null;
  spo2: number | null;
};

type ObjectLike = {
  [key: string]: unknown;
};

function isObjectLike(value: unknown): value is ObjectLike {
  return value !== null && typeof value === 'object';
}

function readField(source: unknown, key: string): unknown {
  if (!isObjectLike(source)) return undefined;
  return source[key];
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function readFirstNumber(source: unknown, keys: string[]): number | null {
  for (const key of keys) {
    const value = toFiniteNumber(readField(source, key));
    if (value !== null) return value;
  }

  return null;
}

function formatPointLabel(point: unknown, index: number): string {
  const raw =
    readField(point, 'date') ??
    readField(point, 'ts') ??
    readField(point, 'time') ??
    readField(point, 'timestamp') ??
    readField(point, 'createdAt') ??
    readField(point, 'recordedAt') ??
    null;

  if (raw) {
    const date = new Date(raw as any);

    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    }

    return String(raw);
  }

  return `Reading ${index + 1}`;
}

function readSeries(vitals: Vitals): unknown[] {
  const maybeSeries = readField(vitals, 'bpSeries');
  return Array.isArray(maybeSeries) ? maybeSeries : [];
}

function buildTrendPoints(vitals: Vitals): TrendPoint[] {
  const currentHr = toFiniteNumber(readField(vitals, 'hr'));
  const currentTemp = toFiniteNumber(readField(vitals, 'temp'));
  const currentSpo2 = toFiniteNumber(readField(vitals, 'spo2'));

  const points = readSeries(vitals)
    .map((point, index): TrendPoint => {
      const hr = readFirstNumber(point, [
        'hr',
        'heartRate',
        'heart_rate',
        'heartRateBpm',
        'heart_rate_bpm',
      ]);

      const temp = readFirstNumber(point, [
        'temp',
        'temp_c',
        'temperature',
        'temperatureC',
        'temperature_c',
      ]);

      const spo2 = readFirstNumber(point, [
        'spo2',
        'SpO2',
        'oxygen',
        'oxygenSaturation',
        'oxygen_saturation',
      ]);

      return {
        label: formatPointLabel(point, index),
        hr,
        temp,
        spo2,
      };
    })
    .filter(
      (point) =>
        point.hr !== null || point.temp !== null || point.spo2 !== null,
    );

  if (points.length > 0) return points;

  if (currentHr !== null || currentTemp !== null || currentSpo2 !== null) {
    return [
      {
        label: 'Current',
        hr: currentHr,
        temp: currentTemp,
        spo2: currentSpo2,
      },
    ];
  }

  return [];
}

function hasCurrentAlert(vitals: Vitals): boolean {
  const hr = toFiniteNumber(readField(vitals, 'hr'));
  const temp = toFiniteNumber(readField(vitals, 'temp'));
  const spo2 = toFiniteNumber(readField(vitals, 'spo2'));

  return (
    (hr !== null && (hr < 50 || hr > 120)) ||
    (temp !== null && (temp < 35 || temp > 38)) ||
    (spo2 !== null && spo2 < 92)
  );
}

export default function VitalsTrendChart({ vitals }: VitalsTrendChartProps) {
  const hrValue = toFiniteNumber(readField(vitals, 'hr')) ?? 0;
  const tempValue = toFiniteNumber(readField(vitals, 'temp')) ?? 0;
  const spo2Value = toFiniteNumber(readField(vitals, 'spo2')) ?? 0;

  const trendPoints = useMemo(() => buildTrendPoints(vitals), [vitals]);

  const data = useMemo<ChartData<'line', Array<number | null>, string>>(
    () => ({
      labels: trendPoints.map((point) => point.label),
      datasets: [
        {
          label: 'HR (bpm)',
          data: trendPoints.map((point) => point.hr),
          borderColor: '#6366F1',
          backgroundColor: '#6366F120',
          tension: 0.3,
          spanGaps: true,
        },
        {
          label: 'Temp (°C)',
          data: trendPoints.map((point) => point.temp),
          borderColor: '#F97316',
          backgroundColor: '#F9731620',
          tension: 0.3,
          spanGaps: true,
        },
        {
          label: 'SpO₂ (%)',
          data: trendPoints.map((point) => point.spo2),
          borderColor: '#10B981',
          backgroundColor: '#10B98120',
          tension: 0.3,
          spanGaps: true,
        },
      ],
    }),
    [trendPoints],
  );

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
    },
    scales: {
      y: {
        beginAtZero: false,
      },
    },
  };

  const isAlert = useMemo(() => hasCurrentAlert(vitals), [vitals]);

  const pulseVariants: Variants = {
    normal: {
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    },
    alert: {
      boxShadow: [
        '0 0 15px 4px rgba(239,68,68,0.5)',
        '0 0 25px 8px rgba(239,68,68,0.7)',
        '0 0 15px 4px rgba(239,68,68,0.5)',
      ],
      transition: {
        duration: 1.2,
        repeat: Infinity,
        repeatType: 'loop',
      },
    },
  };

  const gradientVariants: Variants = {
    hidden: {
      opacity: 0,
    },
    pulse: {
      opacity: [0, 0.6, 0],
      transition: {
        duration: 1.2,
        repeat: Infinity,
        repeatType: 'loop',
      },
    },
  };

  return (
    <motion.div
      className="relative space-y-4 rounded-xl p-2"
      animate={isAlert ? 'alert' : 'normal'}
      variants={pulseVariants}
    >
      {isAlert && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{
            background:
              'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0))',
          }}
          variants={gradientVariants}
          initial="hidden"
          animate="pulse"
        />
      )}

      <div className="relative z-10 grid grid-cols-3 gap-2">
        <MiniMeterDonut value={hrValue} max={200} unit="bpm" label="HR" />
        <MiniMeterDonut value={tempValue} max={45} unit="°C" label="Temp" />
        <MiniMeterDonut value={spo2Value} max={100} unit="%" label="SpO₂" />
      </div>

      <div className="relative z-10 rounded-xl bg-white p-2 shadow-sm">
        {trendPoints.length > 0 ? (
          <div className="h-[120px]">
            <Line data={data} options={options} />
          </div>
        ) : (
          <div className="grid h-[120px] place-items-center rounded-lg border border-dashed bg-slate-50 text-xs text-slate-500">
            No trend readings available yet.
          </div>
        )}
      </div>
    </motion.div>
  );
}