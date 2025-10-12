// apps/clinician-app/components/NexRingPanel.tsx
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

const GW = process.env.NEXT_PUBLIC_GATEWAY_ORIGIN || process.env.NEXT_PUBLIC_GATEWAY_BASE || '';

type Metrics = {
  ts?: number;
  hr?: number; spo2?: number; rr?: number; hrv?: number; rhr?: number;
  steps?: number; calories?: number;
  readiness?: number; sleepScore?: number;
  stress?: number; // 0..100
  sleepStages?: { rem?: number; deep?: number; light?: number }; // minutes
};

function b64ToU16(b64: string) {
  const bin = atob(b64);
  const len = bin.length;
  const u8 = new Uint8Array(len);
  for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);
  return new Uint16Array(u8.buffer);
}

export default function NexRingPanel({ roomId }: { roomId?: string }) {
  const [m, setM] = useState<Metrics>({});
  const [connected, setConnected] = useState(false);

  const ppgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const ringRef = useRef<number[]>([]);
  const maxPts = 1000;

  const url = useMemo(() => {
    const base = (GW || '').replace(/\/+$/,'');
    const path = `/api/insight/stream?session=${encodeURIComponent(roomId || 'default')}`;
    return base ? `${base}${path}` : path;
  }, [roomId]);

  useEffect(() => {
    const c = ppgCanvasRef.current;
    if (!c) return;
    let raf = 0;
    const draw = () => {
      const ctx = c.getContext('2d')!;
      const w = c.width, h = c.height;
      ctx.clearRect(0,0,w,h);
      ctx.strokeStyle = '#111';
      ctx.beginPath();
      const arr = ringRef.current;
      if (arr.length) {
        for (let i = 0; i < w; i++) {
          const idx = Math.floor((i / w) * arr.length);
          const v = arr[idx];
          const y = h - Math.floor((v / 65535) * h);
          if (i === 0) ctx.moveTo(i, y); else ctx.lineTo(i, y);
        }
      }
      ctx.stroke();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const es = new EventSource(url);
    const onFrame = (e: MessageEvent) => {
      try {
        const obj = JSON.parse(e.data);
        const kind = String(obj.kind || '');
        if (kind === 'ppg_u16' && obj.b64) {
          const u16 = b64ToU16(obj.b64);
          // keep last N
          const r = ringRef.current;
          for (let i = 0; i < u16.length; i++) r.push(u16[i]);
          while (r.length > maxPts) r.shift();
        } else if (kind === 'nexring_metrics' || kind === 'wearable_metrics') {
          const meta = obj.meta || {};
          if (!meta.vendor || /nexring/i.test(meta.vendor)) {
            setM((prev) => ({ ...prev, ...obj.metrics, ts: obj.ts || Date.now() }));
          }
        }
      } catch {}
    };
    const onAi = () => {}; // reserved
    es.addEventListener('frame', onFrame);
    es.addEventListener('ai', onAi);
    es.addEventListener('ready', () => setConnected(true));
    es.onerror = () => {};
    return () => { try { es.close(); } catch {} };
  }, [url]);

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-600">SSE: {connected ? 'connected' : '—'}</div>
      <div className="grid grid-cols-2 gap-2">
        <Tile label="HR" value={num(m.hr, 'bpm')} />
        <Tile label="SpO₂" value={num(m.spo2, '%')} />
        <Tile label="Respiratory Rate" value={num(m.rr, '/min')} />
        <Tile label="HRV" value={num(m.hrv, 'ms')} />
        <Tile label="Resting HR" value={num(m.rhr, 'bpm')} />
        <Tile label="Steps" value={num(m.steps)} />
        <Tile label="Calories" value={num(m.calories, 'kcal')} />
        <Tile label="Readiness" value={num(m.readiness, '/100')} />
        <Tile label="Sleep Score" value={num(m.sleepScore, '/100')} />
        <Tile label="Stress" value={num(m.stress, '/100')} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
        <div>REM: {num(m.sleepStages?.rem, 'm')}</div>
        <div>Deep: {num(m.sleepStages?.deep, 'm')}</div>
        <div>Light: {num(m.sleepStages?.light, 'm')}</div>
      </div>

      <div className="space-y-1">
        <div className="text-xs text-gray-500">PPG preview</div>
        <canvas ref={ppgCanvasRef} width={560} height={96} className="w-full rounded border bg-white" />
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-3 bg-white">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
function num(v?: number, unit?: string) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return unit ? `${Number(v).toFixed(0)} ${unit}` : `${Number(v).toFixed(0)}`;
}
