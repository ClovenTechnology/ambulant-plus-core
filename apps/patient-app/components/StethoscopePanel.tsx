'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

type PcmChunk = { ts: number; sampleRate: number; samples: Int16Array };
const GW = process.env.NEXT_PUBLIC_GATEWAY_ORIGIN || process.env.NEXT_PUBLIC_GATEWAY_BASE || '';

function b64ToInt16(b64: string) {
  const bin = atob(b64);
  const len = bin.length;
  const u8 = new Uint8Array(len);
  for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);
  return new Int16Array(u8.buffer);
}

class WavRecorder {
  private chunks: PcmChunk[] = [];
  constructor(private sampleRate: number) {}
  push(c: PcmChunk) { if (c.sampleRate === this.sampleRate) this.chunks.push(c); }
  flush(): Blob {
    const totalSamples = this.chunks.reduce((n, c) => n + c.samples.length, 0);
    const dataBytes = totalSamples * 2;
    const buf = new ArrayBuffer(44 + dataBytes);
    const view = new DataView(buf);
    const u8 = new Uint8Array(buf);
    u8.set([0x52,0x49,0x46,0x46], 0);
    view.setUint32(4, 36 + dataBytes, true);
    u8.set([0x57,0x41,0x56,0x45], 8);
    u8.set([0x66,0x6D,0x74,0x20], 12);
    view.setUint32(16, 16, true);
    view.setUint16(20, 1,  true);
    view.setUint16(22, 1,  true);
    view.setUint32(24, this.sampleRate, true);
    view.setUint32(28, this.sampleRate * 2, true);
    view.setUint16(32, 2,  true);
    view.setUint16(34, 16, true);
    u8.set([0x64,0x61,0x74,0x61], 36);
    view.setUint32(40, dataBytes, true);
    let off = 44;
    for (const c of this.chunks) {
      const s16 = new Int16Array(buf, off, c.samples.length);
      s16.set(c.samples);
      off += c.samples.length * 2;
    }
    this.chunks = [];
    return new Blob([buf], { type: 'audio/wav' });
  }
}

export default function StethoscopePanel({ roomId }: { roomId?: string }) {
  const [connected, setConnected] = useState(false);
  const [liveSpeaker, setLiveSpeaker] = useState(true);
  const [sampleRate, setSampleRate] = useState(8000);

  const acRef = useRef<AudioContext | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const ringRef = useRef<Float32Array>(new Float32Array(8000 * 3));
  const ringPosRef = useRef(0);

  const recRef = useRef<WavRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [wavUrl, setWavUrl] = useState<string | null>(null);
  const [recSecs, setRecSecs] = useState(0);
  const recStartRef = useRef<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const c = canvasRef.current;
      if (c) {
        const ctx = c.getContext('2d')!;
        const w = c.width, h = c.height;
        ctx.clearRect(0,0,w,h);
        ctx.strokeStyle = '#111';
        ctx.beginPath();
        const buf = ringRef.current;
        const len = buf.length;
        for (let x = 0; x < w; x++) {
          const i = Math.floor((x / w) * len);
          const y = Math.floor((buf[i] * 0.5 + 0.5) * h);
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const attachAudio = (s16: Int16Array, rate: number) => {
    if (!liveSpeaker) return;
    if (!acRef.current) acRef.current = new AudioContext({ sampleRate: rate });
    const ac = acRef.current;
    const f32 = new Float32Array(s16.length);
    for (let i = 0; i < s16.length; i++) f32[i] = Math.max(-1, Math.min(1, s16[i] / 32768));
    const buf = ac.createBuffer(1, f32.length, rate);
    buf.copyToChannel(f32, 0, 0);
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.connect(ac.destination);
    src.start();
  };

  const onFrame = (obj: any) => {
    if (!obj || obj.kind !== 'stethoscope_pcm16' || !obj.b64) return;
    const rate = obj.sampleRate || 8000;
    setSampleRate(rate);
    const s16 = b64ToInt16(obj.b64);

    const ring = ringRef.current;
    const pos = ringPosRef.current;
    for (let i = 0; i < s16.length; i++) {
      ring[(pos + i) % ring.length] = Math.max(-1, Math.min(1, s16[i] / 32768));
    }
    ringPosRef.current = (pos + s16.length) % ring.length;

    attachAudio(s16, rate);

    if (recording) {
      if (!recRef.current) recRef.current = new WavRecorder(rate);
      recRef.current.push({ ts: Date.now(), sampleRate: rate, samples: s16 });
      if (recStartRef.current == null) recStartRef.current = Date.now();
      setRecSecs(Math.round((Date.now() - recStartRef.current) / 1000));
    }
  };

  const url = useMemo(() => {
    const base = GW?.replace(/\/+$/, '') || '';
    const path = `/api/insight/stream?session=${encodeURIComponent(roomId || 'default')}`;
    return base ? `${base}${path}` : path;
  }, [roomId]);

  const connect = () => {
    if (esRef.current) return;
    const es = new EventSource(url, { withCredentials: false });
    es.addEventListener('frame', (e) => {
      try { onFrame(JSON.parse((e as MessageEvent).data)); } catch {}
    });
    es.addEventListener('ready', () => setConnected(true));
    es.onerror = () => {};
    esRef.current = es;
    setConnected(true);
  };

  const disconnect = () => {
    try { esRef.current?.close(); } catch {}
    esRef.current = null;
    setConnected(false);
  };

  const startRec = () => {
    setWavUrl((u) => { if (u) URL.revokeObjectURL(u); return null; });
    recRef.current = new WavRecorder(sampleRate);
    recStartRef.current = null;
    setRecSecs(0);
    setRecording(true);
  };

  const stopRec = () => {
    const blob = recRef.current?.flush();
    recRef.current = null;
    setRecording(false);
    recStartRef.current = null;
    setRecSecs(0);
    if (blob) setWavUrl(URL.createObjectURL(blob));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {!connected
          ? <button className="px-2 py-1 border rounded text-xs" onClick={connect}>Connect</button>
          : <button className="px-2 py-1 border rounded text-xs" onClick={disconnect}>Disconnect</button>}
        <label className="text-xs flex items-center gap-1">
          <input type="checkbox" checked={liveSpeaker} onChange={e => setLiveSpeaker(e.target.checked)} /> Live speaker
        </label>
        {!recording
          ? <button className="px-2 py-1 border rounded text-xs" onClick={startRec} disabled={!connected}>Start recording</button>
          : <button className="px-2 py-1 border rounded text-xs" onClick={stopRec}>Stop & prepare WAV</button>}
        {recording && <span className="text-xs text-gray-600">REC {recSecs}s @ {sampleRate}Hz</span>}
      </div>

      <canvas ref={canvasRef} width={560} height={96} className="w-full rounded border bg-white" />

      <div className="flex items-center gap-2">
        <a className={`px-2 py-1 border rounded text-xs ${wavUrl ? '' : 'pointer-events-none opacity-50'}`}
           href={wavUrl ?? '#'} download={`stethoscope_${Date.now()}.wav`}>
          Download WAV
        </a>
      </div>
    </div>
  );
}
