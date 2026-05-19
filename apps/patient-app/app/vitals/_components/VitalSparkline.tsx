'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Status } from '../_lib/vitals-ui';

const STATUS_COLOR: Record<string, string> = {
  normal: '#10b981',
  warning: '#facc15',
  critical: '#ef4444',
  unknown: '#94a3b8',
};

export type VitalSparklineProps = {
  values: Array<number | null>;
  statusFn: (v?: number) => Status;
  width?: number;
  height?: number;
  unit?: string;
  timestamps?: string[];
  tooltipDisabled?: boolean;
  valueFormatter?: (v: number) => string;
};

type Tip = {
  show: boolean;
  x: number;
  y: number;
  valueText: string;
  status: Status;
  tsText?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function VitalSparkline({
  values,
  statusFn,
  width = 320,
  height = 72,
  unit,
  timestamps,
  tooltipDisabled,
  valueFormatter,
}: VitalSparklineProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  const numericValues = useMemo(
    () => values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v)),
    [values],
  );

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (numericValues.length < 2 || values.length < 2) {
      ctx.strokeStyle = 'rgba(148,163,184,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height - 1);
      ctx.lineTo(width, height - 1);
      ctx.stroke();
      return;
    }

    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);
    const scale = max - min || 1;

    ctx.lineWidth = 2;

    for (let i = 0; i < values.length - 1; i++) {
      const v1 = values[i];
      const v2 = values[i + 1];

      if (typeof v1 !== 'number' || !Number.isFinite(v1)) continue;
      if (typeof v2 !== 'number' || !Number.isFinite(v2)) continue;

      const x1 = (i * width) / (values.length - 1);
      const x2 = ((i + 1) * width) / (values.length - 1);
      const y1 = height - ((v1 - min) / scale) * height;
      const y2 = height - ((v2 - min) / scale) * height;

      const status = statusFn(v1);
      ctx.strokeStyle = STATUS_COLOR[status] || STATUS_COLOR.unknown;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }, [values, numericValues, statusFn, width, height]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const hide = () => setTip(null);

    const handleMouseMove = (e: MouseEvent) => {
      if (tooltipDisabled) return;

      const rect = canvas.getBoundingClientRect();
      const relX = e.clientX - rect.left;

      const n = Math.max(2, values.length);
      const step = rect.width / (n - 1);
      const idx = clamp(Math.round(relX / step), 0, n - 1);

      const raw = values[idx];
      if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        setTip(null);
        return;
      }

      const status = statusFn(raw);
      const ts = timestamps?.[idx];
      const valText = valueFormatter ? valueFormatter(raw) : String(raw);
      const valueText = unit ? `${valText} ${unit}` : valText;

      const approxW = 220;
      const approxH = 88;
      const x = clamp(e.clientX + 12, 8, window.innerWidth - approxW - 8);
      const y = clamp(e.clientY + 12, 8, window.innerHeight - approxH - 8);

      setTip({
        show: true,
        x,
        y,
        valueText,
        status,
        tsText: ts ? new Date(ts).toLocaleString() : undefined,
      });
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', hide);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', hide);
    };
  }, [values, timestamps, statusFn, tooltipDisabled, unit, valueFormatter]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <canvas ref={ref} className="block h-full w-full rounded" />
      {tip?.show && (
        <div
          className="pointer-events-none fixed rounded border border-gray-300 bg-white px-2 py-1 text-xs shadow"
          style={{ left: tip.x, top: tip.y, zIndex: 50 }}
        >
          <div className="text-xs">
            <span className="text-gray-500">Value:</span> {tip.valueText}
          </div>
          <div className="text-xs">
            <span className="text-gray-500">Status:</span> {tip.status}
          </div>
          {tip.tsText && <div className="text-[11px] text-gray-500">{tip.tsText}</div>}
        </div>
      )}
    </div>
  );
}