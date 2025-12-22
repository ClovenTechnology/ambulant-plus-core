'use client';
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { connectBle, subscribe } from '@/src/devices/ble';

type ViewTab = 'capture'|'history'|'thresholds'|'settings';

type TempRecord = {
  id: string;
  timestamp: string;
  celsius?: number;
  fahrenheit?: number;
  unit?: 'C' | 'F';
  raw?: any;
};

type Props = {
  onSave?: (rec: TempRecord) => Promise<void> | void;
  initialHistory?: TempRecord[];
  defaultTab?: ViewTab;
};

const cn = (...a: Array<string | false | undefined>) => a.filter(Boolean).join(' ');
const uid = (p='') => p + Math.random().toString(36).slice(2,9);
const nowISO = () => new Date().toISOString();
const cToF = (c: number) => +(c * 9/5 + 32).toFixed(1);
const fToC = (f: number) => +((f - 32) * 5/9).toFixed(1);

export default function Temperature({ onSave, initialHistory = [], defaultTab='capture' }: Props) {
  const [tab, setTab] = useState<ViewTab>(defaultTab);
  useEffect(()=> setTab(defaultTab), [defaultTab]);

  const [history, setHistory] = useState<TempRecord[]>(initialHistory);
  const [state, setState] = useState<'idle'|'connecting'|'measuring'|'done'|'error'>('idle');
  const [unit, setUnit] = useState<'C'|'F'>(() => {
    if (typeof window === 'undefined') return 'C';
    return (localStorage.getItem('tempUnit') as 'C'|'F') || 'C';
  });
  const [msg, setMsg] = useState<string | null>(null);
  const unsubRef = useRef<() => void | null>(null);
  const connRef = useRef<any | null>(null);

  // Persist display unit
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('tempUnit', unit); } catch {}
    }
  }, [unit]);

  const measuring = state==='connecting' || state==='measuring';

  const pushRecord = async (rec: TempRecord) => {
    setHistory(h => [rec, ...h].slice(0,500));
    try { await onSave?.(rec); } catch (e) { console.warn('save failed', e); }
  };

  function parseTempDV(dv: DataView) {
    try {
      // float32 little-endian
      if (dv.byteLength >= 4) {
        const f = dv.getFloat32(0, true);
        if (f > 20 && f < 50) return { celsius: +f.toFixed(1), raw: { f } };
      }
      // uint16 scaled
      if (dv.byteLength >= 2) {
        const n = dv.getUint16(0, true);
        if (n > 2000 && n < 5000) return { celsius: +(n/100).toFixed(1), raw: { n } };
        if (n > 200 && n < 500)  return { celsius: +(n/10).toFixed(1), raw: { n } };
      }
      // ascii fallback
      try {
        const txt = new TextDecoder().decode(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength)).trim();
        const v = Number(txt.replace(',', '.'));
        if (!Number.isNaN(v)) return { celsius: v > 50 ? fToC(v) : v, raw: { txt } };
      } catch {}
    } catch (err) { console.warn('temp parse error', err); }
    return null;
  }

  async function startBleTempListener() {
    if (!('bluetooth' in navigator)) { setMsg('Web Bluetooth not supported'); setState('error'); return; }
    setMsg('Connecting…'); setState('connecting');
    try {
      const conn = await connectBle('duecare.health-monitor');
      connRef.current = conn;
      const unsub = await subscribe(conn as any, 'temp', (dv: DataView) => {
        if (state!=='measuring') setState('measuring');
        const parsed = parseTempDV(dv);
        if (!parsed) { setMsg('Could not parse temperature payload'); return; }
        const rec: TempRecord = {
          id: uid('t-'),
          timestamp: nowISO(),
          celsius: parsed.celsius,
          fahrenheit: parsed.celsius ? cToF(parsed.celsius) : undefined,
          unit: 'C',
          raw: parsed.raw
        };
        // We can push immediately for history, but we won't *display* it in "Latest" until measuring finishes.
        pushRecord(rec);
        setMsg(`Temp ${rec.celsius?.toFixed(1)}°C`);
        try { unsub(); } catch {}
        try { conn.stopAll?.(); } catch {}
        unsubRef.current = null; connRef.current = null;
        setState('done'); // display will unlock now
      });
      unsubRef.current = unsub;
      setMsg('Measuring — keep sensor pointed at forehead…');
    } catch (err: any) {
      setMsg(`BLE error: ${err?.message || err}`); setState('error');
    }
  }

  async function stopBleTempListener() {
    try { unsubRef.current?.(); } catch {}
    try { connRef.current?.stopAll?.(); } catch {}
    unsubRef.current = null; connRef.current = null;
    setState('idle'); setMsg('Stopped');
  }

  async function simulateTemp() {
    setState('measuring'); setMsg('Simulating…'); await new Promise(r => setTimeout(r, 700));
    const c = +(36 + Math.random() * 1.8).toFixed(1);
    const rec: TempRecord = { id: uid('t-'), timestamp: nowISO(), celsius: c, fahrenheit: cToF(c), unit: 'C', raw:{ simulated:true } };
    await pushRecord(rec);
    setState('done'); // display will unlock now
    setMsg(`Simulated ${rec.celsius}°C`);
  }

  // Helpers to display in chosen unit
  const asUnit = (c?: number, f?: number) =>
    unit === 'C'
      ? (typeof c === 'number' ? c : (typeof f === 'number' ? fToC(f) : undefined))
      : (typeof f === 'number' ? f : (typeof c === 'number' ? cToF(c) : undefined));
  const unitSymbol = unit === 'C' ? '°C' : '°F';

  // Only show "Latest" after measuring stops (sync with spinner)
  const canShowLatest = !measuring && state !== 'connecting' && history.length > 0;
  const visibleLatest = canShowLatest ? history[0] : undefined;

  // Sparkline (still based on history)
  const sparkValues = useMemo(()=> history.slice(0, 20)
    .map(h => asUnit(h.celsius, h.fahrenheit))
    .filter((v): v is number => typeof v==='number')
    .reverse(), [history, unit]);

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex items-center gap-2">
        {(['capture','history','thresholds','settings'] as const).map(t => (
          <button
            key={t}
            onClick={()=>setTab(t)}
            className={cn('px-3 py-1.5 rounded-xl border text-xs md:text-sm',
              tab===t ? 'bg-slate-900 text-white' : 'bg-white hover:bg-slate-50')}
          >
            {t[0].toUpperCase()+t.slice(1)}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {measuring
            ? <button className="px-3 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700" onClick={stopBleTempListener}>Stop</button>
            : <button className="px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700" onClick={startBleTempListener}>Start</button>
          }
        </div>
      </div>

      {/* CAPTURE */}
      {tab==='capture' && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Body Temperature</h3>
              <div className="text-xs text-gray-500">Point sensor to forehead (≤5 cm) then press Start.</div>
            </div>
          </div>

          <div className="flex gap-3 items-center">
            <button className="px-3 py-1.5 border rounded-xl bg-white hover:bg-slate-50" onClick={simulateTemp} disabled={measuring}>Simulate</button>
            <div className="text-xs text-gray-500 ml-auto" aria-live="polite">{msg}</div>
          </div>

          <div className="p-4 border rounded-2xl bg-white flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500">Latest</div>
              <div className="mt-0.5 text-2xl font-semibold tabular-nums">
                {visibleLatest
                  ? `${asUnit(visibleLatest.celsius, visibleLatest.fahrenheit)?.toFixed(1)} ${unitSymbol}`
                  : '—'}
              </div>
              <div className="text-xs text-gray-500">
                {visibleLatest ? new Date(visibleLatest.timestamp).toLocaleString() : (measuring ? 'Measuring…' : 'Ready to measure')}
              </div>
            </div>

            {/* Rotating ring (kept) */}
            <div className="relative w-12 h-12">
              <div className={cn(
                'absolute inset-0 rounded-full border-4',
                measuring ? 'border-indigo-300 border-t-indigo-600 animate-spin' : 'border-slate-200'
              )} />
            </div>
          </div>
        </>
      )}

      {/* HISTORY */}
      {tab==='history' && (
        <div className="space-y-2">
          {history.length===0 && <div className="p-3 border rounded-xl bg-white text-sm text-gray-500">No readings yet</div>}
          {history.map(h => {
            const val = asUnit(h.celsius, h.fahrenheit);
            return (
              <div key={h.id} className="flex justify-between p-2 border rounded-xl bg-white">
                <div>
                  <div className="font-medium">{val != null ? `${val.toFixed(1)} ${unitSymbol}` : '—'}</div>
                  <div className="text-xs text-gray-500">{new Date(h.timestamp).toLocaleString()}</div>
                </div>
                <div className="text-xs text-gray-400">{h.raw?.simulated ? 'Sim' : 'Device'}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* THRESHOLDS (kept simple; inputs in °C by default) */}
      {tab==='thresholds' && (
        <div className="p-3 border rounded-xl bg-white space-y-3 text-sm">
          <div className="font-medium">Alert thresholds</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <label className="flex items-center gap-2">Max °C <input type="number" defaultValue={37.8} step="0.1" className="border rounded p-1 w-24"/></label>
            <label className="flex items-center gap-2">Min °C <input type="number" defaultValue={35.5} step="0.1" className="border rounded p-1 w-24"/></label>
          </div>
          <button className="px-3 py-1.5 rounded-xl border bg-white">Save</button>
        </div>
      )}

      {/* SETTINGS (replaces Devices) */}
      {tab==='settings' && (
        <div className="p-3 border rounded-xl bg-white space-y-3 text-sm">
          <div className="font-medium">Settings</div>
          <fieldset className="flex flex-wrap items-center gap-4">
            <legend className="text-xs text-gray-500 mr-2">Display unit</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="temp-unit" value="C" checked={unit==='C'} onChange={()=>setUnit('C')}/>
              <span>Degree Celsius (°C)</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="temp-unit" value="F" checked={unit==='F'} onChange={()=>setUnit('F')}/>
              <span>Degree Fahrenheit (°F)</span>
            </label>
          </fieldset>
          <div className="text-xs text-gray-500">
            This preference only affects how values are displayed here. Raw readings are captured in °C and converted.
          </div>
        </div>
      )}
    </div>
  );
}
