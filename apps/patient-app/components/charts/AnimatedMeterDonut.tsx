'use client';

import React, { useEffect, useState } from 'react';
import { ArcElement, Chart as ChartJS, Tooltip } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip);

interface AnimatedMeterDonutProps {
  value: number; // current health score
  max?: number;  // max value, default 100
  size?: number; // pixel width/height, default 120
  unit?: string; // optional unit, default '%'
}

export default function AnimatedMeterDonut({
  value,
  max = 100,
  size = 120,
  unit = '%',
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

  const data = {
    datasets: [
      {
        data: [displayValue, max - displayValue],
        backgroundColor: [getColor(), '#E5E7EB'], // active + gray
        borderWidth: 0,
        cutout: '70%',
        borderRadius: 8,
      },
    ],
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <Doughnut data={data} width={size} height={size} />
      <div className="absolute text-center mt-[-70px] font-semibold text-lg text-gray-800">
        {displayValue}
        <span className="text-sm text-gray-500">{unit}</span>
      </div>
    </div>
  );
}
