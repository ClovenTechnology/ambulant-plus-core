'use client';

import React, { useMemo, useRef, useState } from 'react';
import { exportCsv, exportSvgAsPng } from './export';

export type BpPoint = { ts: number; sys: number; dia: number };

export default function BpChart({ data }: { data: BpPoint[] }) {
  const pad = 36, H = 280, W = 820;
  const svgRef = useRef<SVGSVGElement>(null);

  const [hi, lo] = useMemo(() => {
    const s = Math.max(...data.map(d => d.sys), 140);
    const i = Math.min(...data.map(d => d.dia), 55);
    const top = Math.ceil((s + 10) / 5) * 5;
    const bot = Math.floor((i - 10) / 5) * 5;
    return [top, bot];
  }, [data]);

  const x = (i: number) => pad + (i * (W - pad * 2)) / Math.max(1, data.length - 1);
  const y = (v: number) => pad + ( (hi - v) * (H - pad * 2) ) / Math.max(1, hi - lo);

  const sysPath = useMemo(() => data.map((d, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(d.sys)}`).join(' '), [data]);
  const diaPath = useMemo(() => data.map((d, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(d.dia)}`).join(' '), [data]);

  const [iHover, setIHover] = useState<number | null>(null);

  function nearestIndex(px: number) {
    const b = svgRef.current?.getBoundingClientRect();
    if (!b) return null;
    const rel = px - b.left;
    let best = 0, dist = 1e12;
    for (let i = 0; i < data.length; i++) {
      const dx = Math.abs(x(i) - rel);
      if (dx < dist) { dist = dx; best = i; }
    }
    return best;
  }

  function onExportPng() {
    if (svgRef.current) exportSvgAsPng(svgRef.current, 'bp-chart.png');
  }
  function onExportCsv() {
    exportCsv('bp.csv', data.map(d => ({
      timestamp: new Date(d.ts).toISOString(), systolic: d.sys, diastolic: d.dia,
    })));
  }

  return (
    <div className="relative rounded-2xl border bg-[#0b1020] text-white p-4 overflow-hidden">
      {/* neon grid aura */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.06),_transparent_60%)]" />

      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] text-teal-300/80 tracking-wide">Cardio</div>
          <div className="text-xl font-semibold -mt-0.5">Blood Pressure</div>
          <div className="text-[11px] text-gray-400/80">SYS / DIA · Hover to inspect</div>
        </div>
        <div className="flex gap-2">
          <button onClick={onExportPng} className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-xs">Export PNG</button>
          <button onClick={onExportCsv} className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs">Export CSV</button>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none"
        onMouseMove={(e) => setIHover(nearestIndex(e.clientX))}
        onMouseLeave={() => setIHover(null)}
      >
        <defs>
          <linearGradient id="sys-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="1"/>
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.2"/>
          </linearGradient>
          <linearGradient id="dia-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="1"/>
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.2"/>
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* horizontal grid */}
        {Array.from({ length: Math.floor((hi - lo)/5)+1 }).map((_,k) => {
          const val = lo + k*5;
          return (
            <g key={k}>
              <line x1={pad} x2={W-pad} y1={y(val)} y2={y(val)} stroke="#1f2a44" strokeWidth={1}/>
              <text x={6} y={y(val)+3} fontSize={10} fill="#6b7280">{val}</text>
            </g>
          );
        })}

        {/* SYS / DIA lines */}
        <path d={sysPath} fill="none" stroke="url(#sys-grad)" strokeWidth={2.5} filter="url(#glow)"/>
        <path d={diaPath} fill="none" stroke="url(#dia-grad)" strokeWidth={2.5} filter="url(#glow)"/>

        {/* vertical connecting bars */}
        {data.map((d, i) => (
          <line
            key={i}
            x1={x(i)} x2={x(i)}
            y1={y(d.sys)} y2={y(d.dia)}
            stroke={iHover===i ? '#a5b4fc' : '#64748b'}
            strokeOpacity={iHover===i ? 0.9 : 0.35}
            strokeWidth={iHover===i ? 2 : 1}
          />
        ))}

        {/* animated dots */}
        {data.map((d,i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(d.sys)} r={iHover===i ? 4.5 : 3.2} fill="#ef4444">
              <animate attributeName="r" values="3.2;3.8;3.2" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx={x(i)} cy={y(d.dia)} r={iHover===i ? 4.5 : 3.2} fill="#3b82f6">
              <animate attributeName="r" values="3.2;3.8;3.2" dur="2s" repeatCount="indefinite" />
            </circle>
          </g>
        ))}
      </svg>

      {/* unified tooltip with BOTH values + timestamp */}
      {iHover !== null && (
        <div
          className="absolute pointer-events-none bg-black/80 backdrop-blur rounded-md px-2.5 py-1.5 text-[12px] shadow-lg"
          style={{
            left: `calc(${(x(iHover)/W)*100}% - 60px)`,
            top: `calc(${(y((data[iHover].sys + data[iHover].dia)/2)/H)*100}% - 48px)`,
          }}
        >
          <div className="font-semibold">
            {new Date(data[iHover].ts).toLocaleString()}
          </div>
          <div className="flex gap-2 mt-0.5">
            <span className="text-red-400">SYS: {data[iHover].sys}</span>
            <span className="text-blue-300">DIA: {data[iHover].dia}</span>
          </div>
        </div>
      )}

      <div className="mt-2 flex items-center gap-3 text-xs">
        <div className="inline-flex items-center gap-1 text-red-300">
          <span className="inline-block h-2 w-4 bg-red-500" /> SYS
        </div>
        <div className="inline-flex items-center gap-1 text-blue-300">
          <span className="inline-block h-2 w-4 bg-blue-500" /> DIA
        </div>
      </div>
    </div>
  );
}
