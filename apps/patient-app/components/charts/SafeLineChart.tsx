'use client';

import { Line } from 'react-chartjs-2';
import { useEffect, useRef } from 'react';
import type { Chart as ChartJS } from 'chart.js';
import { ensureChartRegistration } from '@/lib/chart';

type Props = React.ComponentProps<typeof Line>;

export default function SafeLineChart(props: Props) {
  ensureChartRegistration();

  const chartRef = useRef<ChartJS | null>(null);

  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, []);

  return (
    <Line
      {...props}
      ref={(instance) => {
        chartRef.current = instance as unknown as ChartJS | null;
      }}
    />
  );
}