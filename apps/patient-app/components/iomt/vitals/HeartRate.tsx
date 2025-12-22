'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { connectBle, subscribe } from '@/src/devices/ble';

type ViewTab = 'capture' | 'history' | 'thresholds';

export type HrRecord = {
  id: string;
  timestamp: string;
  hr: number;
  unit?: 'bpm';
  source?: 'ble' | 'sim';
  raw?: any;
};

type Props = {
  onSave?: (rec: HrRecord) => Promise<void> | void;
  initialHistory?: HrRecord[];
  defaultTab?: ViewTab;
};

const cn = (...a: Array<string | false | undefined>) => a.filter(Boolean).join(' ');
const uid = (p='') => p + Math.random().toString(36).slice(2,9);
const nowISO = () => new Date().toISOString();

const DEDUPE_MS = 8_000;

function parseHrDV(dv: DataView) {
  try {
    if (!dv || dv.byteLength < 2) return null;
    const flags = dv.getUint8(0);
    const is16 = (flags & 0x01) === 0x01;
    if (is16 && dv.byteLength >= 3) return dv.getUint16(1, true);
    return dv.getUint8(1);
  } catch { return null; }
}

export default function HeartRate({ onSave, initialHistory = [], defaultTab='capture' }: Props) {
  const [tab, setTab] = useState<ViewTab>(defaultTab);
  useEffect(()=> setTab(defaultTab), [defaultTab]);

  const [history, setHistory] = useState<HrRecord[]>(initialHistory.slice(0, 500));
  const [state, setState] = useState<'idle'|'connecting'|'measuring'|'done'|'error'>('idle');
  const [msg, setMsg] = useState<string | null>(null);

  const connRef = useRef<any | null>(null);
  const unsubRef = useRef<null | (() => void)>(null);
  const lastRef = useRef<HrRecord | null>(null);

  const measuring = state==='connecting' || state==='measuring';

  function accept(rec: HrRecord){
    const last = lastRef.current;
    const dup = last && rec.hr === last.hr && (Date.now() - Date.parse(last.timestamp)) < DEDUPE_MS;
    if (dup) return false;
    lastRef.current = rec;
    return true;
  }

  async function pushRecord(rec: HrRecord){
    if(!accept(rec)) return;
    setHistory(h => [rec, ...h].slice(0, 500));
    try { await onSave?.({ ...rec, raw: rec.raw?.format ? { format: rec.raw.format } : rec.raw }); } catch(e){ console.warn('save hr failed', e); }
  }

  async function startBle(){
    if (!('bluetooth' in navigator)) { setMsg('Web Bluetooth not supported'); setState('error'); return; }
    setMsg('Connecting…'); setState('connecting');
    try {
      const conn = await connectBle('duecare.health-monitor');
      connRef.current = conn;
      const unsub = await subscribe(conn, 'hr', (dv: DataView) => {
        if (state!=='measuring') setState('measuring');
        const hr = parseHrDV(dv);
        if (!hr) return;
        const rec: HrRecord = { id: uid('hr-'), timestamp: nowISO(), hr, unit:'bpm', source:'ble', raw:{ format:'hr' } };
        void pushRecord(rec);
        setMsg(`HR ${hr} bpm`);
        // stays measuring until user stops
      });
      unsubRef.current = unsub;
      setMsg('Listening for HR…');
    } catch (err:any) {
      setMsg(`BLE error: ${err?.message || String(err)}`); setState('error');
    }
  }

  async function stopBle(){
    try { unsubRef.current?.(); } catch {}
    try { connRef.current?.stopAll?.(); } catch {}
    unsubRef.current = null; connRef.current = null;
    setState('idle'); setMsg('Stopped');
  }

  // simulate with measuring delay to sync ring & latest
  async function simulateOnce(){
    if (measuring) return;
    setState('measuring'); setMsg('Simulating…');
    await new Promise(r => setTimeout(r, 500 + Math.random()*500));
    const hr = 55 + Math.floor(Math.random()*55);
    const rec: HrRecord = { id: uid('hr-'), timestamp: nowISO(), hr, unit:'bpm', source:'sim', raw:{ simulated:true } };
    await pushRecord(rec);
    setState('done'); setMsg(`Simulated ${hr} bpm`);
  }

  // Spinner-sync: only show latest after measuring stops
  const canShowLatest = !measuring && history.length > 0;
  const latest = canShowLatest ? history[0] : undefined;

  const sparkValues = useMemo(() => history.slice(0, 20).map(h => h.hr).reverse(), [history]);

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
              <h3 className="text-lg font-semibold">Heart Rate</h3>
              <div className="text-xs text-gray-500">Tap Start to subscribe to HR notifications.</div>
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
                {latest ? `${latest.hr} bpm` : '—'}
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
                <div className="font-medium">{h.hr} bpm</div>
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
            <label className="flex items-center gap-2">HR max (bpm) <input type="number" defaultValue={120} className="border rounded p-1 w-24" /></label>
            <label className="flex items-center gap-2">HR min (bpm) <input type="number" defaultValue={40} className="border rounded p-1 w-24" /></label>
          </div>
          <button className="px-3 py-1.5 rounded-xl border bg-white">Save</button>
        </div>
      )}
    </div>
  );
}
