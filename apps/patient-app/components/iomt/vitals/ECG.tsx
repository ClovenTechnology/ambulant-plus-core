'use client';
import React, { useEffect, useRef, useState } from 'react';
import { connectBle, subscribe } from '@/src/devices/ble';

type EcgRecord = {
  id: string;
  timestamp: string;
  durationSec?: number;
  rhr?: number;   // resting / avg HR or derived
  rawSummary?: any;
};

type Props = {
  onSave?: (rec: EcgRecord) => Promise<void> | void;
  ECGCanvas?: React.ComponentType<{ running: boolean; samples?: number[] }>; // optional canvas UI component
  patientId?: string;
};

const uid = (p='') => p + Math.random().toString(36).slice(2,9);
const nowISO = () => new Date().toISOString();

/**
 * ECG component:
 * - subscribes to 'ecg_wave' characteristic (high sample rate) and forwards chunked samples to /api/iomt/push
 * - optionally renders ECGCanvas if provided
 * - stops after user stops, and creates a summary record that can be persisted via onSave
 */
export default function ECG({ onSave, ECGCanvas, patientId }: Props) {
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const connRef = useRef<any|null>(null);
  const unsubRef = useRef<() => void | null>(null);
  const samplesRef = useRef<number[]>([]); // local short buffer for canvas
  const startAtRef = useRef<number | null>(null);

  function decodeEcgSamples(dv: DataView) {
    // ECG vendor often sends 16-bit signed PCM samples at 250Hz
    const out: number[] = [];
    try {
      for (let i=0; i+1 < dv.byteLength; i += 2) {
        out.push(dv.getInt16(i, true));
      }
    } catch (e) { console.warn('ecg decode', e); }
    return out;
  }

  async function startStreaming() {
    setMsg('Requesting device...');
    setRunning(true);
    samplesRef.current = [];
    startAtRef.current = Date.now();
    try {
      const conn = await connectBle('duecare.health-monitor');
      connRef.current = conn;
      setMsg('Connected — subscribing to ECG waveform...');
      const unsub = await subscribe(conn, 'ecg_wave', (dv: DataView) => {
        const samples = decodeEcgSamples(dv);
        if (samples.length) {
          // buffer for canvas (keep last N samples)
          samplesRef.current = samplesRef.current.concat(samples).slice(-2500); // keep ~10s @250Hz
          // POST lightweight aggregated value to live push for clinician view (throttle)
          // we send the average amplitude as a simple proxy; if you want full waveform, send chunked arrays
          const avg = Math.round(samples.reduce((a,b)=>a+b,0)/samples.length);
          fetch('/api/iomt/push', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ roomId: patientId || 'default', type: 'ecg', value: avg, unit: 'a.u.' })
          }).catch(()=>{});
        }
      });
      unsubRef.current = unsub;
      setMsg('ECG streaming (live) — keep fingers on electrodes.');
    } catch (e: any) {
      console.error('ECG start error', e);
      setMsg(`BLE error: ${e?.message || e}`);
      setRunning(false);
    }
  }

  async function stopStreaming() {
    try { unsubRef.current?.(); } catch {}
    try { connRef.current?.stopAll?.(); } catch {}
    const started = startAtRef.current;
    const duration = started ? Math.round((Date.now() - started) / 1000) : undefined;
    // create summary record; you can extend this to compute HR/VF etc
    const rec: EcgRecord = { id: uid('ecg-'), timestamp: nowISO(), durationSec: duration, rawSummary: { samplesCount: samplesRef.current.length } };
    try { await onSave?.(rec); } catch (e) { console.warn('ecg onSave failed', e); }
    unsubRef.current = null; connRef.current = null;
    startAtRef.current = null;
    setRunning(false);
    setMsg(`Stopped — duration ${duration ?? 0}s`);
  }

  // expose a small UI for previewing samples if ECGCanvas not provided
  const CanvasPreview = () => {
    const canvasRef = useRef<HTMLCanvasElement|null>(null);
    useEffect(() => {
      const id = setInterval(() => {
        const c = canvasRef.current;
        if (!c) return;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        const w = c.width, h = c.height;
        ctx.clearRect(0,0,w,h);
        const samples = samplesRef.current.slice(-Math.floor(w/2)); // reduce to width
        if (!samples.length) return;
        ctx.beginPath();
        ctx.moveTo(0, h/2 - (samples[0]/32768) * (h/2));
        for (let i=1; i<samples.length; i++) {
          const x = (i / samples.length) * w;
          const y = h/2 - (samples[i]/32768) * (h/2);
          ctx.lineTo(x,y);
        }
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 1;
        ctx.stroke();
      }, 60);
      return () => clearInterval(id);
    }, []);
    return <canvas ref={canvasRef} width={600} height={120} className="w-full h-28 bg-black/60" aria-hidden />;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">ECG</h3>
          <div className="text-xs text-gray-500">Place fingers on electrodes and press Start. ECG streams to clinician live view.</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => running ? stopStreaming() : startStreaming()} className={`px-3 py-1 rounded ${running ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>{running ? 'Stop' : 'Start'}</button>
          <button className="px-2 py-1 border rounded bg-white">Open Viewer</button>
        </div>
      </div>

      <div className="rounded border bg-[#0b1020] p-2 text-slate-200">
        {ECGCanvas ? <ECGCanvas running={running} samples={samplesRef.current.slice(-1000)}/> : <CanvasPreview />}
        <div className="mt-2 text-xs text-gray-400">{msg}</div>
      </div>
    </div>
  );
}
