'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { connectBle, subscribe } from '@/src/devices/ble';

type ViewTab = 'capture' | 'history' | 'thresholds';

export type Spo2Record = {
  id: string;
  timestamp: string;
  spo2?: number;          // %
  pulse?: number;         // bpm
  perfIndex?: number;     // optional (if device provides)
  unit?: '%';
  source?: 'ble' | 'sim';
  raw?: any;
};

type Props = {
  onSave?: (rec: Spo2Record) => Promise<void> | void;
  initialHistory?: Spo2Record[];
  defaultTab?: ViewTab;
  patientId?: string; // optional; ignored in this component (kept for signature parity)
};

// tiny helper
const cn = (...a: Array<string | false | undefined>) => a.filter(Boolean).join(' ');
const uid = (p='') => p + Math.random().toString(36).slice(2,9);
const nowISO = () => new Date().toISOString();

// Lightweight de-dupe window
const DEDUPE_MS = 10_000;

// Try to parse HR from common 0x2A37 payload
function parseHrDV(dv: DataView) {
  try {
    if (!dv || dv.byteLength < 2) return null;
    const flags = dv.getUint8(0);
    const is16 = (flags & 0x01) === 0x01;
    if (is16 && dv.byteLength >= 3) return dv.getUint16(1, true);
    return dv.getUint8(1);
  } catch { return null; }
}

// Some vendor devices provide SpO₂ via ASCII in the same stream – best-effort
function parseSpo2FromAscii(dv: DataView) {
  try {
    const txt = new TextDecoder().decode(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength)).trim();
    if (!txt) return null;
    // Look for patterns like "SpO2:97" "97%" "SPO2,97,HR,75" etc.
    const nums = txt.match(/\d{2,3}/g)?.map(Number) ?? [];
    const spo2 = nums.find(n => n >= 70 && n <= 100);
    const hr   = nums.find(n => n >= 30 && n <= 230);
    if (spo2 != null || hr != null) return { spo2, pulse: hr, raw: { ascii: txt } };
  } catch {}
  return null;
}

export default function BloodOxygen({
  onSave,
  initialHistory = [],
  defaultTab = 'capture',
}: Props) {
  const [tab, setTab] = useState<ViewTab>(defaultTab);
  useEffect(()=> setTab(defaultTab), [defaultTab]);

  const [history, setHistory] = useState<Spo2Record[]>(initialHistory.slice(0, 500));
  const [state, setState] = useState<'idle'|'connecting'|'measuring'|'done'|'error'>('idle');
  const [msg, setMsg] = useState<string | null>(null);

  const connRef = useRef<any | null>(null);
  const unsubPpgRef = useRef<null | (() => void)>(null);
  const unsubHrRef  = useRef<null | (() => void)>(null);
  const lastRef = useRef<Spo2Record | null>(null);
  const timers = useRef<{ connect?: any; read?: any }>({});

  const measuring = state==='connecting' || state==='measuring';

  // accept de-dup
  function accept(rec: Spo2Record) {
    const last = lastRef.current;
    const dup = last && rec.spo2 === last.spo2 && rec.pulse === last.pulse &&
      Date.now() - Date.parse(last.timestamp) < DEDUPE_MS;
    if (dup) return false;
    lastRef.current = rec;
    return true;
  }

  async function pushRecord(rec: Spo2Record) {
    if (!accept(rec)) return;
    setHistory((h) => [rec, ...h].slice(0, 500));
    try { await onSave?.({ ...rec, raw: rec.raw?.format ? { format: rec.raw.format } : rec.raw }); } catch (e) { console.warn('save spo2 failed', e); }
  }

  // Decode PPG packets to a simple rolling indicator (optional)
  function decodePpgAverage(dv: DataView) {
    try {
      if (!dv || dv.byteLength < 2) return null;
      const arr: number[] = [];
      for (let i = 0; i + 1 < dv.byteLength; i += 2) arr.push(dv.getUint16(i, true));
      if (!arr.length) return null;
      const avg = Math.round(arr.reduce((a,b)=>a+b,0) / arr.length);
      return avg; // arbitrary units
    } catch { return null; }
  }

  async function startBle() {
    if (!('bluetooth' in navigator)) { setMsg('Web Bluetooth not supported'); setState('error'); return; }
    setState('connecting'); setMsg('Connecting…');

    timers.current.connect = setTimeout(() => {
      setMsg('Connection timeout');
      setState('error');
      void stopBle();
    }, 10_000);

    try {
      const conn = await connectBle('duecare.health-monitor');
      clearTimeout(timers.current.connect);
      connRef.current = conn;

      setState('measuring');
      setMsg('Listening for SpO₂/HR…');

      // Subscribe PPG (optional visual or QoS)
      try {
        unsubPpgRef.current = await subscribe(conn, 'spo2_wave', (dv: DataView) => {
          const avg = decodePpgAverage(dv);
          if (avg != null) {
            // keep UI alive
            setMsg(`Streaming PPG… (${avg})`);
          } else {
            // maybe ascii SpO₂ on this characteristic:
            const parsedAscii = parseSpo2FromAscii(dv);
            if (parsedAscii?.spo2 || parsedAscii?.pulse) {
              const rec: Spo2Record = { id: uid('s-'), timestamp: nowISO(), spo2: parsedAscii.spo2, pulse: parsedAscii.pulse, unit:'%', source:'ble', raw:{ format:'ascii' } };
              void pushRecord(rec);
              setMsg(`SpO₂ ${rec.spo2 ?? '—'}% · HR ${rec.pulse ?? '—'} bpm`);
              // stays in measuring until user stops
            }
          }
        });
      } catch (e) {
        console.info('PPG subscribe not available', e);
      }

      // Subscribe HR measurement characteristic (0x2A37)
      try {
        unsubHrRef.current = await subscribe(conn, 'hr', (dv: DataView) => {
          const hr = parseHrDV(dv);
          if (hr) {
            const rec: Spo2Record = { id: uid('s-'), timestamp: nowISO(), spo2: undefined, pulse: hr, unit:'%', source:'ble', raw:{ format:'hr' } };
            void pushRecord(rec);
            setMsg(`HR ${hr} bpm`);
          }
        });
      } catch (e) {
        console.info('HR subscribe not available', e);
      }

      // Reading watchdog
      timers.current.read = setTimeout(() => {
        setMsg('No spot reading yet — still listening…');
      }, 30_000);
    } catch (err: any) {
      clearTimeout(timers.current.connect);
      setMsg(`BLE error: ${err?.message || String(err)}`);
      setState('error');
    }
  }

  async function stopBle() {
    try { unsubPpgRef.current?.(); } catch {}
    try { unsubHrRef.current?.(); } catch {}
    try { connRef.current?.stopAll?.(); } catch {}
    unsubPpgRef.current = null; unsubHrRef.current = null; connRef.current = null;
    clearTimeout(timers.current.connect); clearTimeout(timers.current.read);
    setState('idle'); setMsg('Stopped');
  }

  async function simulateOnce() {
    if (measuring) return;
    setState('measuring'); setMsg('Simulating…');
    await new Promise(r => setTimeout(r, 600));
    const spo2 = 94 + Math.floor(Math.random() * 5); // 94-98%
    const pulse = 55 + Math.floor(Math.random() * 40);
    const rec: Spo2Record = { id: uid('s-'), timestamp: nowISO(), spo2, pulse, unit:'%', source:'sim', raw:{ simulated:true } };
    await pushRecord(rec);
    setState('done'); setMsg(`Simulated SpO₂ ${spo2}% · HR ${pulse} bpm`);
  }

  // Spinner-sync: only show latest after measuring stops
  const canShowLatest = !measuring && history.length > 0;
  const latest = canShowLatest ? history[0] : undefined;

  const sparkValues = useMemo(() =>
    history.slice(0, 20)
      .map(h => (typeof h.spo2 === 'number' ? h.spo2 : (h.pulse ? Math.min(100, Math.round(80 + h.pulse/4)) : undefined)))
      .filter((v): v is number => typeof v==='number')
      .reverse()
  , [history]);

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex items-center gap-2">
        {(['capture','history','thresholds'] as const).map(t => (
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
            ? <button className="px-3 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700" onClick={stopBle}>Stop</button>
            : <button className="px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700" onClick={startBle}>Start</button>
          }
        </div>
      </div>

      {/* CAPTURE */}
      {tab==='capture' && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Blood Oxygen (SpO₂ + HR)</h3>
              <div className="text-xs text-gray-500">Place finger on sensor and press Start. Device streams PPG & HR.</div>
            </div>
          </div>

          <div className="flex gap-3 items-center">
            <button className="px-3 py-1.5 border rounded-xl bg-white hover:bg-slate-50" onClick={simulateOnce} disabled={measuring}>Simulate</button>
            <div className="text-xs text-gray-500 ml-auto" aria-live="polite">{msg}</div>
          </div>

          <div className="p-4 border rounded-2xl bg-white flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500">Latest</div>
              <div className="mt-0.5 text-2xl font-semibold tabular-nums">
                {latest ? (
                  <>
                    {latest.spo2 != null ? `${latest.spo2}%` : '—'}
                    <span className="text-base text-gray-500">{latest.pulse != null ? ` · ${latest.pulse} bpm` : ''}</span>
                  </>
                ) : (
                  '—'
                )}
              </div>
              <div className="text-xs text-gray-500">
                {latest ? new Date(latest.timestamp).toLocaleString() : (measuring ? 'Measuring…' : 'Ready to measure')}
              </div>
            </div>

            {/* ring + spark */}
            <div className="flex items-center gap-4">
              <div className="relative w-12 h-12">
                <div
                  className={cn(
                    'absolute inset-0 rounded-full border-4',
                    measuring ? 'border-indigo-300 border-t-indigo-600 animate-spin' : 'border-slate-200'
                  )}
                />
              </div>
              <div className="text-xs text-gray-500">
                <svg width={120} height={28} aria-hidden>
                  <path
                    d={((pts:number[])=>{
                      if(!pts.length) return '';
                      const min=Math.min(...pts), max=Math.max(...pts);
                      const norm=pts.map(v => 26 - ((v-min)/(max-min||1))*22);
                      const step = 120/(pts.length-1||1);
                      return norm.map((y,i)=>`${i?'L':'M'} ${i*step},${y}`).join(' ');
                    })(sparkValues)}
                    fill="none" stroke="currentColor" strokeWidth="2" opacity=".6"
                  />
                </svg>
              </div>
            </div>
          </div>
        </>
      )}

      {/* HISTORY */}
      {tab==='history' && (
        <div className="space-y-2">
          {history.length===0 && <div className="p-3 border rounded-xl bg-white text-sm text-gray-500">No readings yet</div>}
          {history.map(h => (
            <div key={h.id} className="flex justify-between p-2 border rounded-xl bg-white">
              <div>
                <div className="font-medium">
                  {h.spo2 != null ? `${h.spo2}%` : '—'} {h.pulse != null ? `· ${h.pulse} bpm` : ''}
                </div>
                <div className="text-xs text-gray-500">{new Date(h.timestamp).toLocaleString()}</div>
              </div>
              <div className="text-xs text-gray-400">{h.source === 'sim' ? 'Sim' : 'Device'}</div>
            </div>
          ))}
        </div>
      )}

      {/* THRESHOLDS */}
      {tab==='thresholds' && (
        <div className="p-3 border rounded-xl bg-white space-y-3 text-sm">
          <div className="font-medium">Alert thresholds</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <label className="flex items-center gap-2">SpO₂ min (%) <input type="number" defaultValue={92} className="border rounded p-1 w-24" /></label>
            <label className="flex items-center gap-2">HR max (bpm) <input type="number" defaultValue={120} className="border rounded p-1 w-24" /></label>
            <label className="flex items-center gap-2">HR min (bpm) <input type="number" defaultValue={40} className="border rounded p-1 w-24" /></label>
          </div>
          <button className="px-3 py-1.5 rounded-xl border bg-white">Save</button>
        </div>
      )}
    </div>
  );
}
