'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface MiniMeterDonutProps {
  value: number;
  max: number;
  unit?: string;
  label?: string;
}

export default function MiniMeterDonut({ value, max, unit = '', label = '' }: MiniMeterDonutProps) {
  const [displayValue, setDisplayValue] = useState(0);

  // Animate number count up
  useEffect(() => {
    let start = displayValue;
    const end = value;
    const step = (end - start) / 20;
    if (step === 0) return;
    const interval = setInterval(() => {
      start += step;
      if ((step > 0 && start >= end) || (step < 0 && start <= end)) {
        setDisplayValue(end);
        clearInterval(interval);
      } else setDisplayValue(start);
    }, 20);
    return () => clearInterval(interval);
  }, [value]);

  // Determine color and pulse based on thresholds
  let color = '#10B981'; // green default
  let pulse = false;

  if (label === 'HR' && (value < 50 || value > 120)) { color = '#EF4444'; pulse = true; }
  if (label === 'Temp' && (value < 35 || value > 38)) { color = '#EF4444'; pulse = true; }
  if (label === 'SpO₂' && value < 92) { color = '#EF4444'; pulse = true; }

  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  // Pulse timing synced with VitalsTrendChart (0.6s)
  const pulseAnimation = pulse
    ? { scale: [1, 1.15, 1] }
    : { scale: 1 };

  const pulseTransition = {
    duration: 0.6,
    repeat: pulse ? Infinity : 0,
    repeatType: 'mirror' as const,
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-16 h-16">
        <svg className="transform -rotate-90 w-full h-full">
          <circle
            cx="50%"
            cy="50%"
            r="28"
            stroke="#E5E7EB"
            strokeWidth="6"
            fill="transparent"
          />
          <motion.circle
            cx="50%"
            cy="50%"
            r="28"
            stroke={color}
            strokeWidth="6"
            fill="transparent"
            strokeDasharray={2 * Math.PI * 28}
            strokeDashoffset={2 * Math.PI * 28 * (1 - percentage / 100)}
            initial={{ strokeDashoffset: 2 * Math.PI * 28 }}
            animate={{ strokeDashoffset: 2 * Math.PI * 28 * (1 - percentage / 100) }}
            transition={{ duration: 0.6 }}
          />
        </svg>

        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center text-xs font-medium"
          animate={pulseAnimation}
          transition={pulseTransition}
        >
          <span>{Math.round(displayValue)}{unit}</span>
          {label && <span className="text-gray-500">{label}</span>}
        </motion.div>
      </div>
    </div>
  );
}
