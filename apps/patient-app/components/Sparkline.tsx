'use client';

import {
  LineChart, Line, ResponsiveContainer, Tooltip, YAxis, XAxis, Area, AreaChart
} from 'recharts';
import * as React from 'react';

type Pt = { t: number; y: number };

export default function Sparkline({
  data, color = '#06b6d4', height = 64, fill = true, showAxis = false,
}: { data: Pt[]; color?: string; height?: number; fill?: boolean; showAxis?: boolean; }) {
  const id = React.useId();
  if (!data || data.length === 0) return <div className="h-[64px] grid place-items-center text-xs text-gray-400">no data</div>;
  const min = Math.min(...data.map(d => d.y));
  const max = Math.max(...data.map(d => d.y));
  const pad = (max - min) * 0.1 || 1;

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {fill ? (
          <AreaChart data={data} margin={{ top: 4, right: 6, bottom: 0, left: 6 }}>
            <defs>
              <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            {showAxis && <XAxis dataKey="t" hide />}
            <YAxis domain={[min - pad, max + pad]} hide />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
              labelFormatter={(v) => new Date(Number(v)).toLocaleTimeString()}
              formatter={(v) => [v as number, '']}
            />
            <Area dataKey="y" stroke={color} strokeWidth={2} fill={`url(#${id})`} isAnimationActive={false} />
          </AreaChart>
        ) : (
          <LineChart data={data} margin={{ top: 4, right: 6, bottom: 0, left: 6 }}>
            {showAxis && <XAxis dataKey="t" hide />}
            <YAxis domain={[min - pad, max + pad]} hide />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
              labelFormatter={(v) => new Date(Number(v)).toLocaleTimeString()}
              formatter={(v) => [v as number, '']}
            />
            <Line type="monotone" dataKey="y" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
