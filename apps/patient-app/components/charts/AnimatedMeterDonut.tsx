'use client';

import React, { useEffect, useState } from 'react';
import { ArcElement, Chart as ChartJS, Tooltip } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip);

interface AnimatedMeterDonutProps {
  value: number; // current health score
  max?: number; // max value, default 100
  size?: number; // pixel width/height, default 120
  unit?: string; // optional unit, default '%'
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
  const [displayValue, setDisplayValue] = useState(0);

  // Animate value change
  useEffect(() => {
    let start = displayValue;
    const end = value;
    const duration = 600; // ms
    const stepTime = 16; // roughly 60fps
    const steps = Math.ceil(duration / stepTime);
    const increment = (end - start) / steps;

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      start += increment;
      setDisplayValue(Math.round(start));
      if (currentStep >= steps) clearInterval(interval);
    }, stepTime);

    return () => clearInterval(interval);
  }, [value]);

  // Color based on value
  const getColor = () => {
    if (value >= 80) return '#10B981'; // green
    if (value >= 50) return '#FBBF24'; // yellow
    return '#EF4444'; // red
  };

  const safeMax = Math.max(max, 1);
  const safeDisplayValue = Math.min(Math.max(displayValue, 0), safeMax);
  const activeColor = color || getColor();

  const data = {
    datasets: [
      {
        data: [safeDisplayValue, Math.max(safeMax - safeDisplayValue, 0)],
        backgroundColor: [activeColor, '#E5E7EB'], // active + gray
        borderWidth: 0,
        cutout: '70%',
        borderRadius: 8,
      },
    ],
  };

  return (
    <div className="relative inline-flex flex-col items-center justify-center">
      <Doughnut data={data} width={size} height={size} />
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
