// apps/patient-app/components/charts/AnimatedMeterDonut.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';

import { ensureChartRegistration } from '@/lib/chart';

interface AnimatedMeterDonutProps {
  value: number;
  max?: number;
  size?: number;
  unit?: string;
  label?: string;
  color?: string;
}

export default function AnimatedMeterDonut({
  value,
  max = 100,
  size = 120,
  unit = '%',
  label,
  color,
}: AnimatedMeterDonutProps) {
  ensureChartRegistration();

  const [displayValue, setDisplayValue] = useState(0);

  const prevValueRef = useRef(0);

  const safeMax = Math.max(max, 1);
  const clampedValue = Math.min(Math.max(value, 0), safeMax);

  /**
   * Smooth animation WITHOUT stale closure issues
   */
  useEffect(() => {
    const start = prevValueRef.current;
    const end = clampedValue;

    const duration = 600;
    const stepTime = 16;
    const steps = Math.max(1, Math.ceil(duration / stepTime));
    const increment = (end - start) / steps;

    let currentStep = 0;
    let current = start;

    const interval = setInterval(() => {
      currentStep++;
      current += increment;

      if (currentStep >= steps) {
        current = end;
        clearInterval(interval);
      }

      setDisplayValue(Math.round(current));
    }, stepTime);

    prevValueRef.current = end;

    return () => clearInterval(interval);
  }, [clampedValue]);

  /**
   * Color logic (stable + memoised)
   */
  const activeColor = useMemo(() => {
    if (color) return color;
    if (value >= 80) return '#10B981';
    if (value >= 50) return '#FBBF24';
    return '#EF4444';
  }, [color, value]);

  const safeDisplayValue = Math.min(
    Math.max(displayValue, 0),
    safeMax
  );

  /**
   * Chart data memo (prevents unnecessary re-creation → prevents canvas churn)
   */
  const data = useMemo(
    () => ({
      datasets: [
        {
          data: [
            safeDisplayValue,
            Math.max(safeMax - safeDisplayValue, 0),
          ],
          backgroundColor: [activeColor, '#E5E7EB'],
          borderWidth: 0,
          cutout: '70%',
          borderRadius: 8,
        },
      ],
    }),
    [safeDisplayValue, safeMax, activeColor]
  );

  /**
   * Prevent Chart.js internal re-init storms
   */
  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false, // IMPORTANT: avoids flicker/recreate loops
      plugins: {
        tooltip: { enabled: false },
      },
    }),
    []
  );

  return (
    <div
      className="relative inline-flex flex-col items-center justify-center"
      style={{ width: size, height: size }}
    >
      <Doughnut data={data} options={options} />

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="font-semibold text-lg text-gray-800">
          {safeDisplayValue}
          <span className="text-sm text-gray-500">{unit}</span>
        </div>

        {label ? (
          <div className="mt-0.5 max-w-[90px] truncate text-[11px] font-medium text-gray-500">
            {label}
          </div>
        ) : null}
      </div>
    </div>
  );
}