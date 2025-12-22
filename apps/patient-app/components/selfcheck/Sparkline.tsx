'use client';

import React from 'react';

export default function Sparkline({ points }: { points?: number[] }) {
  if (!Array.isArray(points) || points.length === 0) return null;
  const w = 92, h = 26;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const norm = (v: number) => (max === min ? h / 2 : h - ((v - min) / (max - min)) * h);
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i / (points.length - 1)) * w} ${norm(p)}`)
    .join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="inline-block align-middle">
      <path d={d} fill="none" stroke="url(#s)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <defs>
        <linearGradient id="s" x1="0" x2="1">
          <stop offset="0" stopColor="#06b6d4" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
    </svg>
  );
}
