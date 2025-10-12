'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Conn = 'connected' | 'disconnected' | 'unknown';

type LastVitals = {
  hr?: number; spo2?: number; temp?: number; sys?: number; dia?: number;
  ts?: string; // generic last timestamp, optional
  src?: string; // generic last source, optional
};

function badge(cls: Conn) {
  if (cls === 'connected') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (cls === 'disconnected') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-gray-50 text-gray-700 border-gray-200';
}

export default function IoMTStripLite() {
  const [wearable, setWearable] = useState<Conn>('unknown');
  const [hm, setHM] = useState<Conn>('unknown');
  const [stetho, setStetho] = useState<Conn>('unknown');
  const [oto, setOto] = useState<Conn>('unknown');

  const [last, setLast] = useState<LastVitals>({});

  // Read any cached status & vitals (non-blocking; no SDKs, no mqtt)
  useEffect(() => {
    const readNow = () => {
      try {
        setWearable((localStorage.getItem('iomt.status.wearable') as Conn) || 'unknown');
        setHM((localStorage.getItem('iomt.status.hm') as Conn) || 'unknown');
        setStetho((localStorage.getItem('iomt.status.stetho') as Conn) || 'unknown');
        setOto((localStorage.getItem('iomt.status.oto') as Conn) || 'unknown');

        const L: LastVitals = {};
        const pickNum = (k: string) => {
          const v = localStorage.getItem(k); if (!v) return undefined;
          const n = Number(v); return Number.isFinite(n) ? n : undefined;
        };
        L.hr = pickNum('iomt.last.hr');
        L.spo2 = pickNum('iomt.last.spo2');
        L.temp = pickNum('iomt.last.temp');
        L.sys = pickNum('iomt.last.sys');
        L.dia = pickNum('iomt.last.dia');
        L.ts = localStorage.getItem('iomt.last.ts') || undefined;
        L.src = localStorage.getItem('iomt.last.src') || undefined;
        setLast(L);
      } catch {}
    };

    readNow();

    // Listen for optional app-wide events (non-breaking)
    const onStatus = () => readNow();
    window.addEventListener('iomt:status', onStatus as any);
    window.addEventListener('iomt:vitals', onStatus as any);
    return () => {
      window.removeEventListener('iomt:status', onStatus as any);
      window.removeEventListener('iomt:vitals', onStatus as any);
    };
  }, []);

  const fmtTs = (s?: string) => s ? new Date(s).toLocaleString() : '—';
  const fmt = (n?: number, dp = 0) =>
    n == null || !Number.isFinite(n) ? '—' : n.toFixed(dp);

  return (
    <section className="bg-white rounded-2xl shadow-sm border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-slate-900">IoMT Quick View</h3>
        <div className="flex gap-2">
          <Link href="/iomt" className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-sm hover:bg-teal-700">
            Open IoMT
          </Link>
          <Link href="/charts" className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700">
            Charts
          </Link>
        </div>
      </div>

      {/* Connections */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <div className={`text-xs border rounded-lg px-2 py-1 ${badge(wearable)}`}>
          Wearable: <strong className="ml-1 capitalize">{wearable}</strong>
        </div>
        <div className={`text-xs border rounded-lg px-2 py-1 ${badge(hm)}`}>
          Health Monitor: <strong className="ml-1 capitalize">{hm}</strong>
        </div>
        <div className={`text-xs border rounded-lg px-2 py-1 ${badge(stetho)}`}>
          Stethoscope: <strong className="ml-1 capitalize">{stetho}</strong>
        </div>
        <div className={`text-xs border rounded-lg px-2 py-1 ${badge(oto)}`}>
          Otoscope: <strong className="ml-1 capitalize">{oto}</strong>
        </div>
      </div>

      {/* Tiny vitals row (mock → overridden if app fills localStorage) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="border rounded-xl p-3">
          <div className="text-[11px] text-zinc-500 mb-1">{fmtTs(last.ts)}</div>
          <div className="text-xs text-zinc-500">HR</div>
          <div className="text-xl font-semibold">{fmt(last.hr)} bpm</div>
          <div className="text-[11px] text-zinc-500 mt-1">{last.src ?? '—'}</div>
        </div>
        <div className="border rounded-xl p-3">
          <div className="text-[11px] text-zinc-500 mb-1">{fmtTs(last.ts)}</div>
          <div className="text-xs text-zinc-500">SpO₂</div>
          <div className="text-xl font-semibold">{fmt(last.spo2)} %</div>
          <div className="text-[11px] text-zinc-500 mt-1">{last.src ?? '—'}</div>
        </div>
        <div className="border rounded-xl p-3">
          <div className="text-[11px] text-zinc-500 mb-1">{fmtTs(last.ts)}</div>
          <div className="text-xs text-zinc-500">Temp</div>
          <div className="text-xl font-semibold">{fmt(last.temp, 2)} °C</div>
          <div className="text-[11px] text-zinc-500 mt-1">{last.src ?? '—'}</div>
        </div>
        <div className="border rounded-xl p-3">
          <div className="text-[11px] text-zinc-500 mb-1">{fmtTs(last.ts)}</div>
          <div className="text-xs text-zinc-500">SYS</div>
          <div className="text-xl font-semibold">{fmt(last.sys)} mmHg</div>
          <div className="text-[11px] text-zinc-500 mt-1">Health Monitor</div>
        </div>
        <div className="border rounded-xl p-3">
          <div className="text-[11px] text-zinc-500 mb-1">{fmtTs(last.ts)}</div>
          <div className="text-xs text-zinc-500">DIA</div>
          <div className="text-xl font-semibold">{fmt(last.dia)} mmHg</div>
          <div className="text-[11px] text-zinc-500 mt-1">Health Monitor</div>
        </div>
      </div>

      {/* Helper note (only when unknown) */}
      {(wearable === 'unknown' || hm === 'unknown' || stetho === 'unknown' || oto === 'unknown') && (
        <p className="mt-3 text-[12px] text-slate-500">
          Status shows <em>Unknown</em> until the IoMT pane connects. Opening IoMT will refresh these automatically.
        </p>
      )}
    </section>
  );
}
