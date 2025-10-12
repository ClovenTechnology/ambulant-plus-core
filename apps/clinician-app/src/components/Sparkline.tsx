'use client';

import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Point = { t: string; v: number };

export default function Sparkline({
  data,
  color = '#2563eb',
  height = 48,
  hideAxis = true,
  showTooltip = true,
  gradientId,
}: {
  data: Point[];
  color?: string;
  height?: number;
  hideAxis?: boolean;
  showTooltip?: boolean;
  gradientId?: string;
}) {
  const gid = gradientId || `grad-${Math.random().toString(36).slice(2, 9)}`;

  // Recharts expects data points in increasing x order; assume server returns time-sorted
  const normalized = Array.isArray(data) ? data.map((d) => ({ ...d, date: d.t })) : [];

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={normalized}>
          <defs>
            <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {!hideAxis && <XAxis dataKey="date" tick={{ fontSize: 10 }} />}
          {!hideAxis && <YAxis hide={false} tick={{ fontSize: 10 }} />}

          {showTooltip && (
            <Tooltip
              cursor={false}
              formatter={(value: any) => [`${value}`, '']}
              labelFormatter={(label: any) => {
                try {
                  return new Date(label).toLocaleString();
                } catch {
                  return String(label);
                }
              }}
            />
          )}

          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gid})`}
            dot={{ r: 2 }}
            activeDot={{ r: 6 }}
            isAnimationActive
            animationDuration={600}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
