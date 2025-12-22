'use client';

import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import type { Vitals } from '@/types';
import MiniMeterDonut from './MiniMeterDonut';
import { motion } from 'framer-motion';

interface VitalsTrendChartProps {
  vitals: Vitals & { bpSeries?: any[] };
}

export default function VitalsTrendChart({ vitals }: VitalsTrendChartProps) {
  const data = useMemo(() => ({
    labels: vitals.bpSeries?.map((p) => p.date) || ['Day 1', 'Day 2', 'Day 3'],
    datasets: [
      {
        label: 'HR (bpm)',
        data: [vitals.hr - 2, vitals.hr, vitals.hr + 1],
        borderColor: '#6366F1',
        backgroundColor: '#6366F120',
        tension: 0.3,
      },
      {
        label: 'Temp (°C)',
        data: [parseFloat(vitals.temp) - 0.2, parseFloat(vitals.temp), parseFloat(vitals.temp) + 0.3],
        borderColor: '#F97316',
        backgroundColor: '#F9731620',
        tension: 0.3,
      },
      {
        label: 'SpO₂ (%)',
        data: [vitals.spo2 - 1, vitals.spo2, vitals.spo2 + 0],
        borderColor: '#10B981',
        backgroundColor: '#10B98120',
        tension: 0.3,
      },
    ],
  }), [vitals]);

  const options: ChartOptions<'line'> = {
    responsive: true,
    plugins: { legend: { position: 'top' } },
    scales: { y: { beginAtZero: false } },
  };

  const isAlert = useMemo(() => (
    vitals.hr < 50 || vitals.hr > 120 ||
    parseFloat(vitals.temp) < 35 || parseFloat(vitals.temp) > 38 ||
    vitals.spo2 < 92
  ), [vitals]);

  // Heartbeat pulse animation variants
  const pulseVariants = {
    normal: { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
    alert: {
      boxShadow: ['0 0 15px 4px rgba(239,68,68,0.5)', '0 0 25px 8px rgba(239,68,68,0.7)', '0 0 15px 4px rgba(239,68,68,0.5)'],
    },
  };

  const gradientVariants = {
    hidden: { opacity: 0 },
    pulse: { opacity: [0, 0.6, 0], transition: { duration: 1.2, repeat: Infinity, repeatType: 'loop' } },
  };

  return (
    <motion.div
      className="relative space-y-4 p-2 rounded-xl"
      animate={isAlert ? 'alert' : 'normal'}
      variants={pulseVariants}
    >
      {/* Gradient overlay */}
      {isAlert && (
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0))' }}
          variants={gradientVariants}
          initial="hidden"
          animate="pulse"
        />
      )}

      {/* MINI METERS */}
      <div className="grid grid-cols-3 gap-2 relative z-10">
        <MiniMeterDonut value={vitals.hr} max={200} unit="bpm" label="HR" />
        <MiniMeterDonut value={parseFloat(vitals.temp)} max={45} unit="°C" label="Temp" />
        <MiniMeterDonut value={vitals.spo2} max={100} unit="%" label="SpO₂" />
      </div>

      {/* LINE TREND */}
      <div className="bg-white rounded-xl p-2 shadow-sm relative z-10">
        <Line data={data} options={options} height={120} />
      </div>
    </motion.div>
  );
}
