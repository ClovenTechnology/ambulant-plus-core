'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { connectBle, subscribe } from '@/src/devices/ble';

type ViewTab = 'capture' | 'history' | 'thresholds';

type BPRecord = {
  id: string;
  timestamp: string;
  systolic: number;
  diastolic: number;
  pulse?: number;
  unit?: 'mmHg' | 'kPa';
  cuffStatus?: string;
  raw?: any;
};

type Props = {
  onSave?: (rec: BPRecord) => Promise<void> | void;
  initialHistory?: BPRecord[];
  unit?: 'mmHg' | 'kPa';
  deviceKey?: string;
  defaultTab?: ViewTab;
};

// tiny classnames helper
const cn = (...a: Array<string | false | undefined>) => a.filter(Boolean).join(' ');
const uid = (p = '') => p + Math.random().toString(36).slice(2, 9);
const nowISO = () => new Date().toISOString();

const BP_MIN_MAX = { sys: [60, 260] as const, dia: [30, 200] as const, pulse: [30, 220] as const };
const within = (v: number, [lo, hi]: readonly [number, number]) => v >= lo && v <= hi;
const toKpa = (mmHg: number) => Math.round(mmHg * 0.133322 * 10) / 10;

type BPState = 'idle' | 'connecting' | 'subscribed' | 'inflating' | 'measuring' | 'done' | 'error';

export default function BloodPressure({
  onSave,
  initialHistory = [],
  unit = 'mmHg',
  deviceKey = 'duecare.health-monitor',
  defaultTab = 'capture',
}: Props) {
  const [tab, setTab] = useState<ViewTab>(defaultTab);
  const [history, setHistory] = useState<BPRecord[]>(initialHistory.slice(0, 500));
  const [state, setState] = useState<BPState>('idle');
  const [msg, setMsg] = useState<string | null>(null);

  const unsubRef = useRef<null | (() => void)>(null);
  const connRef = useRef<any | null>(null);
  const timers = useRef<{ connect?: any; read?: any }>({});
  const lastRef = useRef<BPRecord | null>(null);

  useEffect(() => setTab(defaultTab), [defaultTab]);
  useEffect(() => () => { void stopBleBPListener(); }, []); // cleanup

  // --- Parsing ---
  function parseBPFromDV(dv: DataView) {
    try {
      const len = dv.byteLength;
      // Simple vendor packing u16/u16/u8
      if (len >= 5) {
        const sys = dv.getUint16(0, true);
        const dia = dv.getUint16(2, true);
        const pulse = dv.getUint8(4);
        if (within(sys, BP_MIN_MAX.sys) && within(dia, BP_MIN_MAX.dia)) {
          return { systolic: sys, diastolic: dia, pulse, raw: { format: 'u16/u16/u8' } };
        }
      }
      // IEEE 11073-ish
      if (len >= 7) {
        const flags = dv.getUint8(0);
        const sys = dv.getUint16(1, true);
        const dia = dv.getUint16(3, true);
        const pulse = len >= 9 ? dv.getUint16(7, true) : undefined;
        if (within(sys, BP_MIN_MAX.sys) && within(dia, BP_MIN_MAX.dia)) {
          return { systolic: sys, diastolic: dia, pulse, raw: { format: 'ieee-11073', flags } };
        }
      }
      // ASCII fallback: "SYS/DIA,PULSE" or "SYS DIA PULSE"
      try {
        const txt = new TextDecoder().decode(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength)).trim();
        if (txt) {
          const nums = txt.split(/[,\s/]+/).map(Number).filter((n) => !Number.isNaN(n));
          if (nums.length >= 2) {
            let [sys, dia, pulse] = nums;
            if (sys < dia) [sys, dia] = [dia, sys];
            if (within(sys, BP_MIN_MAX.sys) && within(dia, BP_MIN_MAX.dia)) {
              return { systolic: sys, diastolic: dia, pulse, raw: { format: 'ascii', text: txt } };
            }
          }
        }
      } catch {}
    } catch (e) {
      console.warn('BP parse error', e);
    }
    return null;
  }

  // --- Quality rules ---
  function accept(rec: BPRecord) {
    const last = lastRef.current;
    const dup =
      last &&
      rec.systolic === last.systolic &&
      rec.diastolic === last.diastolic &&
      Date.now() - Date.parse(last.timestamp) < 10_000;
    if (dup) return false;
    const bigJump =
      last && (Math.abs(rec.systolic - last.systolic) > 50 || Math.abs(rec.diastolic - last.diastolic) > 40);
    if (bigJump) rec.raw = { ...rec.raw, flag: 'outlier' };
    lastRef.current = rec;
    return true;
  }
  function redact(rec: BPRecord): BPRecord {
    const { raw, ...rest } = rec;
    return { ...rest, raw: raw?.format ? { format: raw.format } : undefined };
  }
  async function pushRecord(rec: BPRecord) {
    if (!accept(rec)) return;
    setHistory((h) => [rec, ...h].slice(0, 500));
    try {
      await onSave?.(redact(rec));
    } catch (e) {
      console.warn('save failed', e);
    }
  }

  // --- BLE lifecycle ---
  async function startBleBPListener() {
    if (!('bluetooth' in navigator)) {
      setMsg('Web Bluetooth not supported');
      setState('error');
      return;
    }
    setState('connecting');
    setMsg('Connecting…');

    timers.current.connect = setTimeout(() => {
      setMsg('Connection timeout');
      setState('error');
      void stopBleBPListener();
    }, 10_000);

    try {
      const conn = await connectBle(deviceKey as any);
      clearTimeout(timers.current.connect);
      connRef.current = conn;

      setState('subscribed');
      setMsg('Subscribing…');

      timers.current.read = setTimeout(() => {
        setMsg('No reading (timeout)');
        setState('error');
        void stopBleBPListener();
      }, 45_000);

      const unsubscribe = await subscribe(conn as any, 'bp', (dv: DataView) => {
        if (state !== 'measuring') setState('measuring');
        const parsed = parseBPFromDV(dv);
        if (!parsed) {
          setMsg('Unrecognized BP payload');
          return;
        }
        const rec: BPRecord = {
          id: uid('bp-'),
          timestamp: nowISO(),
          systolic: parsed.systolic,
          diastolic: parsed.diastolic,
          pulse: parsed.pulse,
          unit: 'mmHg',
          cuffStatus: 'locked',
          raw: parsed.raw,
        };
        // Add to history immediately; display will remain hidden until measuring completes
        void pushRecord(rec);
        setMsg(`BP ${rec.systolic}/${rec.diastolic} mmHg • pulse ${rec.pulse ?? '—'}`);
        clearTimeout(timers.current.read);
        try { unsubscribe(); } catch {}
        try { conn.stopAll?.(); } catch {}
        unsubRef.current = null;
        connRef.current = null;
        setState('done'); // reveal latest now
      });

      unsubRef.current = unsubscribe;
      setState('inflating');
      setMsg('Measuring — cuff inflating…');
    } catch (err: any) {
      clearTimeout(timers.current.connect);
      setMsg(`BLE error: ${err?.message || String(err)}`);
      setState('error');
    }
  }
  async function stopBleBPListener() {
    try { unsubRef.current?.(); } catch {}
    try { connRef.current?.stopAll?.(); } catch {}
    unsubRef.current = null;
    connRef.current = null;
    clearTimeout(timers.current.connect);
    clearTimeout(timers.current.read);
    setState('idle');
    setMsg('Stopped');
  }

  // --- Display helpers ---
  function displayValue(sys?: number, dia?: number) {
    if (sys == null || dia == null) return '—/—';
    return unit === 'kPa' ? `${toKpa(sys)}/${toKpa(dia)}` : `${sys}/${dia}`;
  }
  const unitLabel = unit === 'kPa' ? 'kPa' : 'mmHg';

  const measuring = ['connecting', 'subscribed', 'inflating', 'measuring'].includes(state);

  // Only show "Latest" after measuring stops (sync with spinner)
  const canShowLatest = !measuring && history.length > 0;
  const visibleLatest = canShowLatest ? history[0] : undefined;

  const sparkData = useMemo(
    () => history.slice(0, 10).map((h) => Math.round(h.diastolic + (h.systolic - h.diastolic) / 3)),
    [history]
  );

  const PrimaryBtn = measuring ? (
    <button
      className="px-3 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700"
      onClick={stopBleBPListener}
      aria-label="Stop blood pressure measurement"
    >
      Stop
    </button>
  ) : (
    <button
      className="px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
      onClick={startBleBPListener}
      aria-label="Start blood pressure measurement"
    >
      Start
    </button>
  );

  // Simulate with measuring delay so ring & latest stay in sync
  async function simulateOnce() {
    if (measuring) return;
    setState('measuring');
    setMsg('Simulating…');
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 600)); // brief delay
    const sys = 100 + Math.floor(Math.random() * 40);
    const dia = 60 + Math.floor(Math.random() * 25);
    const pulse = 55 + Math.floor(Math.random() * 40);
    const rec: BPRecord = {
      id: uid('bp-'),
      timestamp: nowISO(),
      systolic: sys,
      diastolic: dia,
      pulse,
      unit: 'mmHg',
      cuffStatus: 'locked',
      raw: { simulated: true },
    };
    await pushRecord(rec);
    setState('done'); // reveal now
    setMsg(`Simulated ${sys}/${dia} mmHg`);
  }

  return (
    <div className="space-y-3">
      {/* Tabs (no Device tab) */}
      <div className="flex items-center gap-2">
        {(['capture', 'history', 'thresholds'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-3 py-1.5 rounded-xl border text-xs md:text-sm',
              tab === t ? 'bg-slate-900 text-white' : 'bg-white hover:bg-slate-50'
            )}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
        <div className="ml-auto">{PrimaryBtn}</div>
      </div>

      {/* CAPTURE */}
      {tab === 'capture' && (
        <>
          <div className="flex gap-3 items-center">
            <button
              className="px-3 py-1.5 border rounded-xl bg-white hover:bg-slate-50"
              onClick={simulateOnce}
              disabled={measuring}
              aria-label="Simulate blood pressure"
            >
              Simulate
            </button>
            <div className="text-xs text-gray-500 ml-auto" aria-live="polite">
              {msg}
            </div>
          </div>

          <div className="p-4 rounded-2xl border bg-white flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500">Latest</div>
              <div className="mt-0.5 text-2xl font-semibold tabular-nums">
                {visibleLatest ? (
                  <>
                    {displayValue(visibleLatest.systolic, visibleLatest.diastolic)}{' '}
                    <span className="text-base text-gray-500">{unitLabel}</span>
                  </>
                ) : (
                  <>
                    {'—/—'} <span className="text-base text-gray-500">{unitLabel}</span>
                  </>
                )}
              </div>
              <div className="text-xs text-gray-500">
                {visibleLatest
                  ? `${new Date(visibleLatest.timestamp).toLocaleString()} • Pulse ${visibleLatest.pulse ?? '—'} bpm`
                  : (measuring ? 'Measuring…' : 'Attach cuff and start a reading')}
              </div>

              {history.length > 1 && (
                <div className="mt-2 text-xs text-gray-500 inline-flex items-center gap-2">
                  Trend
                  <svg width={80} height={22} aria-hidden>
                    <path
                      d={((pts: number[]) => {
                        if (!pts.length) return '';
                        const min = Math.min(...pts), max = Math.max(...pts);
                        const norm = pts.map((v) => 22 - ((v - min) / (max - min || 1)) * 18);
                        const step = 80 / (pts.length - 1 || 1);
                        return norm.map((y, i) => `${i ? 'L' : 'M'} ${i * step},${y}`).join(' ');
                      })(sparkData)}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      opacity=".6"
                    />
                  </svg>
                </div>
              )}
            </div>

            {/* Rotating ring (kept) */}
            <div className="relative w-12 h-12">
              <div
                className={cn(
                  'absolute inset-0 rounded-full border-4',
                  measuring ? 'border-indigo-300 border-t-indigo-600 animate-spin' : 'border-slate-200'
                )}
              />
            </div>
          </div>
        </>
      )}

      {/* HISTORY */}
      {tab === 'history' && (
        <div className="space-y-2">
          {history.length === 0 && (
            <div className="p-3 border rounded-xl bg-white text-sm text-gray-500">No readings yet</div>
          )}
          {history.map((h) => (
            <div key={h.id} className="flex justify-between p-2 border rounded-xl bg-white">
              <div>
                <div className="font-medium tabular-nums">
                  {displayValue(h.systolic, h.diastolic)}{' '}
                  <span className="text-xs text-gray-500">{unitLabel}</span>
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(h.timestamp).toLocaleString()} • Pulse {h.pulse ?? '—'} bpm
                </div>
              </div>
              <div className="text-xs text-gray-400">{h.cuffStatus}</div>
            </div>
          ))}
        </div>
      )}

      {/* THRESHOLDS */}
      {tab === 'thresholds' && (
        <div className="p-3 border rounded-xl bg-white space-y-3 text-sm">
          <div className="font-medium">Alert thresholds</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <label className="flex items-center gap-2">
              Systolic max <input type="number" defaultValue={140} className="border rounded p-1 w-20" />
            </label>
            <label className="flex items-center gap-2">
              Systolic min <input type="number" defaultValue={90} className="border rounded p-1 w-20" />
            </label>
            <label className="flex items-center gap-2">
              Diastolic max <input type="number" defaultValue={90} className="border rounded p-1 w-20" />
            </label>
            <label className="flex items-center gap-2">
              Diastolic min <input type="number" defaultValue={60} className="border rounded p-1 w-20" />
            </label>
          </div>
          <button className="px-3 py-1.5 rounded-xl border bg-white">Save</button>
        </div>
      )}
    </div>
  );
}
