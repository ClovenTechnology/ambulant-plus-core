// apps/patient-app/app/sfu/[roomId]/BedsideVitalsCard.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

// Charts already in patient app
import MeterDonut from '../../../components/charts/MeterDonut';
import Sparkline from '../../../components/charts/Sparkline';
import BpChart, { type BpPoint } from '../../../components/charts/BpChart';

import { Card, Collapse, CollapseBtn, Icon, Tabs } from './ui';

/* ------------------------------
   Helpers (sim + vitals)
--------------------------------*/
const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

function broadcastVitals(v: any) {
  const payload = { type: 'vitals', vitals: v };
  try {
    window.postMessage(payload, '*');
  } catch {}
  try {
    window.top && window.top !== window && window.top.postMessage(payload, '*');
  } catch {}
  try {
    window.parent && window.parent !== window && window.parent.postMessage(payload, '*');
  } catch {}
  try {
    window.opener && window.opener.postMessage(payload, '*');
  } catch {}
  try {
    const bc = new BroadcastChannel('ambulant-iomt');
    bc.postMessage(payload);
    setTimeout(() => bc.close(), 50);
  } catch {}
}

type Vitals = {
  ts: number;
  hr: number;
  spo2: number;
  sys: number;
  dia: number;
  map: number;
  rr: number;
  tempC: number;
  glucose: number;
};

function nextSample(prev?: Vitals): Vitals {
  const t = Date.now();
  const base = { hr: 72, spo2: 97.2, sys: 116, dia: 74, map: 88, rr: 16, tempC: 36.8, glucose: 94 };
  const jitter = (m = 0, sd = 1) => (Math.random() - 0.5) * sd * 2 + m;
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

  const v0 = prev ?? ({ ts: t - 1000, ...base } as Vitals);
  const target = {
    hr: clamp(v0.hr + jitter(0, 1.6), 58, 135),
    spo2: clamp(v0.spo2 + jitter(0, 0.25), 93, 100),
    sys: clamp(v0.sys + jitter(0, 2.8), 90, 180),
    dia: clamp(v0.dia + jitter(0, 2.0), 55, 110),
    map: 0,
    rr: clamp(v0.rr + jitter(0, 0.9), 8, 32),
    tempC: clamp(v0.tempC + jitter(0, 0.05), 35.0, 39.8),
    glucose: clamp(v0.glucose + jitter(0, 2.5), 60, 190),
  };
  target.map = Math.round((target.sys + 2 * target.dia) / 3);
  const k = 0.35;

  return {
    ts: t,
    hr: round1(lerp(v0.hr, target.hr, k)),
    spo2: round1(lerp(v0.spo2, target.spo2, k)),
    sys: round1(lerp(v0.sys, target.sys, k)),
    dia: round1(lerp(v0.dia, target.dia, k)),
    map: round1(lerp(v0.map, target.map, k)),
    rr: round1(lerp(v0.rr, target.rr, k)),
    tempC: round1(lerp(v0.tempC, target.tempC, k)),
    glucose: Math.round(lerp(v0.glucose, target.glucose, k)),
  };
}

const fmt = (x?: number | string) => (x === undefined || x === null || Number.isNaN(Number(x)) ? '—' : String(x));

/* ------------------------------
   Component
--------------------------------*/
type DeviceTab = 'wearable' | 'monitor' | 'stetho' | 'otoscope';

export function BedsideVitalsCard({
  dense,
  open,
  onToggleOpen,
  vitalsEnabled,
}: {
  dense?: boolean;
  open: boolean;
  onToggleOpen: () => void;
  vitalsEnabled: boolean;
}) {
  return (
    <Card
      title="Bedside Monitor (live)"
      toolbar={<CollapseBtn open={open} onClick={onToggleOpen} />}
      dense={dense}
    >
      <Collapse open={open}>
        <BedsideDeck vitalsEnabled={vitalsEnabled} />
        <div className="mt-2 text-xs text-gray-500">
          Streams via <code className="px-1 rounded bg-gray-100">BroadcastChannel('ambulant-iomt')</code>; forwarded to
          clinician when “Vitals” is on.
        </div>
      </Collapse>
    </Card>
  );
}

function BedsideDeck({ vitalsEnabled }: { vitalsEnabled: boolean }) {
  const [tab, setTab] = useState<DeviceTab>('wearable');
  const [series, setSeries] = useState<Vitals[]>([]);
  const [ecgOn, setEcgOn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let v = nextSample();
    const tick = () => {
      if (cancelled) return;
      v = nextSample(v);
      if (vitalsEnabled) broadcastVitals(v);
      setSeries((old) => {
        const max = 240;
        const next = [...old, v];
        if (next.length > max) next.shift();
        return next;
      });
      setTimeout(tick, 800);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [vitalsEnabled]);

  const latest = series.at(-1);
  const hrSeries = useMemo(() => series.map((s) => ({ t: s.ts, y: s.hr })), [series]);
  const bpSeries: BpPoint[] = useMemo(() => series.map((s) => ({ ts: s.ts, sys: s.sys, dia: s.dia })), [series]);

  // Quick “readings”
  const [readingKey, setReadingKey] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, number | string>>({});

  useEffect(() => {
    if (!readingKey) return;
    const t = setTimeout(() => {
      const rand = (a: number, b: number) => Math.round((a + Math.random() * (b - a)) * 10) / 10;
      const dict: Record<string, number> = {
        glucose: rand(80, 160),
        bpSys: rand(100, 140),
        bpDia: rand(65, 90),
        spo2: Math.round(rand(94, 99)),
        tempC: rand(36.2, 37.9),
        hr: rand(60, 120),
      };
      setResult((r) => ({ ...r, [readingKey]: dict[readingKey] ?? '—' }));
      setReadingKey(null);
    }, 2200);
    return () => clearTimeout(t);
  }, [readingKey]);

  // Wearable sim
  const [steps, setSteps] = useState(3421);
  const [cal, setCal] = useState(512);
  const [dist, setDist] = useState(2.6);

  useEffect(() => {
    const t = setInterval(() => {
      setSteps((s) => s + Math.round(Math.random() * 6));
      setCal((c) => c + Math.round(Math.random() * 2));
      setDist((d) => Math.round((d + Math.random() * 0.005) * 100) / 100);
    }, 2500);
    return () => clearInterval(t);
  }, []);

  const [sleep, setSleep] = useState<Array<{ t: number; y: number }>>(() => {
    const now = Date.now();
    return Array.from({ length: 60 }).map((_, i) => {
      const stage = [1, 1, 2, 2, 3, 1, 2, 3, 1, 0][Math.floor(Math.random() * 10)];
      return { t: now - (60 - i) * 60000, y: stage };
    });
  });

  useEffect(() => {
    const t = setInterval(() => {
      setSleep((old) => {
        const now = Date.now();
        const next = [...old, { t: now, y: [1, 2, 3, 1, 2, 1, 3, 2, 1, 0][Math.floor(Math.random() * 10)] }];
        if (next.length > 120) next.shift();
        return next;
      });
    }, 60000);
    return () => clearInterval(t);
  }, []);

  const [stress, setStress] = useState<Array<{ t: number; y: number }>>(() => {
    const now = Date.now();
    return Array.from({ length: 60 }).map((_, i) => ({ t: now - (60 - i) * 60000, y: 30 + Math.random() * 40 }));
  });

  useEffect(() => {
    const t = setInterval(() => {
      setStress((old) => {
        const now = Date.now();
        const next = [
          ...old,
          { t: now, y: Math.max(5, Math.min(95, (old.at(-1)?.y || 40) + (Math.random() - 0.5) * 8)) },
        ];
        if (next.length > 180) next.shift();
        return next;
      });
    }, 60000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Tabs<DeviceTab>
          items={[
            { key: 'wearable', label: 'Wearable' },
            { key: 'monitor', label: 'Health Monitor' },
            { key: 'stetho', label: 'Stethoscope' },
            { key: 'otoscope', label: 'Otoscope' },
          ]}
          active={tab}
          onChange={setTab}
        />
        <span className="text-xs text-gray-500" suppressHydrationWarning>
          {latest ? new Date(latest.ts).toLocaleTimeString() : '—'}
        </span>
      </div>

      {tab === 'wearable' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <MeterDonut value={steps % 10000} max={10000} label="Steps" color="#34D399" unit="" />
            <MeterDonut value={cal % 2000} max={2000} label="Calories" color="#F59E0B" unit="" />
            <MeterDonut value={Math.round((dist % 10) * 100) / 100} max={10} label="Distance (km)" color="#3B82F6" unit="" />
          </div>

          <div>
            <div className="text-xs text-slate-500 mb-1">Sleep stages (0 Awake · 1 Light · 2 Deep · 3 REM)</div>
            <div className="rounded-xl border bg-white p-2">
              <Sparkline data={sleep} height={88} fill showAxis />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded-xl border bg-white p-2">
              <div className="text-xs text-slate-500 mb-1">Daytime stress</div>
              <Sparkline data={stress} height={64} />
            </div>
            <div className="rounded-xl border bg-white p-2">
              <div className="text-xs text-slate-500 mb-1">Live heart rate</div>
              <Sparkline data={hrSeries} height={64} />
            </div>
          </div>
        </div>
      )}

      {tab === 'monitor' && (
        <div className="space-y-3">
          <div className="grid md:grid-cols-6 gap-2">
            {[
              { key: 'glucose', label: 'Glucose' },
              { key: 'bp', label: 'Blood Pressure' },
              { key: 'spo2', label: 'SpO₂' },
              { key: 'tempC', label: 'Temp' },
              { key: 'hr', label: 'Heart Rate' },
              { key: 'ecg', label: 'ECG' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => {
                  if (f.key === 'bp') {
                    setReadingKey('bpSys');
                    setTimeout(() => setReadingKey('bpDia'), 200);
                  } else if (f.key !== 'ecg') setReadingKey(f.key);
                  if (f.key === 'ecg') setEcgOn((v) => !v);
                }}
                className="relative rounded-xl border bg-white hover:bg-slate-50 p-2 text-xs"
                title={f.label}
              >
                <div className="font-medium">{f.label}</div>
                {readingKey &&
                  (readingKey.startsWith(f.key) || (f.key === 'bp' && (readingKey === 'bpSys' || readingKey === 'bpDia'))) && (
                    <div className="absolute -right-1 -top-1 h-4 w-4">
                      <div className="h-4 w-4 rounded-full border-2 border-sky-500 animate-[spin_1s_linear_infinite]" />
                      <div className="absolute inset-0 grid place-items-center">
                        <div className="h-2 w-2 rounded-full bg-sky-500" />
                      </div>
                    </div>
                  )}
              </button>
            ))}
          </div>

          <div className="rounded-xl border bg-white p-3">
            <div className="text-sm font-medium mb-2">Results</div>
            <div className="grid md:grid-cols-3 gap-2 text-sm">
              <Result label="Glucose" value={fmt(result.glucose)} unit="mg/dL" />
              <Result label="SpO₂" value={fmt(result.spo2)} unit="%" />
              <Result label="Temp" value={fmt(result.tempC)} unit="°C" />
              <Result label="HR" value={fmt(result.hr)} unit="bpm" />
              <Result label="BP SYS" value={fmt(result.bpSys)} unit="mmHg" />
              <Result label="BP DIA" value={fmt(result.bpDia)} unit="mmHg" />
            </div>

            <div className="mt-3">
              <BpChart data={bpSeries} />
            </div>

            <div className="mt-3 rounded-xl border bg-[#0b1020] p-2">
              <div className="flex items-center justify-between">
                <div className="text-slate-200 text-sm font-medium inline-flex items-center gap-2">
                  <Icon name="heart" /> ECG {ecgOn ? '(live)' : '(stopped)'}
                </div>
                <button
                  onClick={() => setEcgOn((v) => !v)}
                  className={`px-2 py-1 rounded text-xs ${ecgOn ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}
                >
                  {ecgOn ? 'Stop' : 'Start'}
                </button>
              </div>
              <div className="h-36 mt-2">
                <ECGCanvas running={ecgOn} />
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'stetho' && <StethoscopePane />}
      {tab === 'otoscope' && <OtoscopePane />}
    </div>
  );
}

function Result({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded border p-2 bg-white flex items-baseline justify-between">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-semibold">
        {value}
        {unit ? ` ${unit}` : ''}
      </div>
    </div>
  );
}

/* ------------------------------
   ECG Canvas
--------------------------------*/
function ECGCanvas({ running }: { running: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let t = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.parentElement?.clientWidth || 600;
      const h = canvas.parentElement?.clientHeight || 140;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    function spike(p: number) {
      const mod = p % (Math.PI * 2);
      return mod > 0.15 && mod < 0.22 ? 1 : 0;
    }

    const draw = () => {
      if (!ctx) return;
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);

      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(148,163,184,0.15)';
      for (let x = 0; x < w; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const phase = (t + x) / 24;
        const y = h / 2 + Math.sin(phase) * 8 + Math.sin(phase * 0.5 + 1.2) * 3 + spike(phase) * -22;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      t += running ? 3 : 0.5;
      raf.current = requestAnimationFrame(draw);
    };

    raf.current = requestAnimationFrame(draw);
    return () => {
      ro.disconnect();
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [running]);

  return <canvas ref={ref} className="w-full h-full block rounded" />;
}

/* ------------------------------
   Stethoscope (demo)
--------------------------------*/
function StethoscopePane() {
  type SM = 'heart' | 'lung';
  const [tab, setTab] = useState<SM>('heart');
  const [rec, setRec] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  async function synthWav(seconds = 5, hz = 220) {
    const sr = 44100;
    const n = seconds * sr;
    const buf = new Float32Array(n);
    for (let i = 0; i < n; i++) buf[i] = Math.sin((2 * Math.PI * hz * i) / sr) * (tab === 'lung' ? 0.2 : 0.5);
    const wav = pcm16Wav(buf, sr);
    return URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
  }

  const toggle = async () => {
    if (rec) {
      setRec(false);
      const url = await synthWav(5, tab === 'heart' ? 80 : 220);
      setAudioUrl(url);
    } else {
      setAudioUrl(null);
      setRec(true);
    }
  };

  return (
    <div className="space-y-3">
      <Tabs<'heart' | 'lung'> items={[{ key: 'heart', label: 'Heart' }, { key: 'lung', label: 'Lungs' }]} active={tab} onChange={setTab} />
      <div className="rounded-xl border bg-white p-3">
        <div className="text-sm text-gray-600 mb-1">Audio waveform</div>
        <WaveStrip active={rec} />
        <div className="mt-2 flex items-center gap-2">
          <button onClick={toggle} className={`px-3 py-1.5 rounded ${rec ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
            {rec ? 'Stop Rec' : 'Start Rec'}
          </button>
          {audioUrl && (
            <>
              <audio src={audioUrl} controls className="h-9" />
              <a href={audioUrl} download={`stetho-${tab}.wav`} className="px-2 py-1 rounded border text-xs bg-white hover:bg-gray-50">
                Download
              </a>
              <button onClick={() => alert('Saved to session (demo)')} className="px-2 py-1 rounded border text-xs bg-white hover:bg-gray-50">
                Save to Session
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function WaveStrip({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    let t = 0;
    let raf: number;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = (c.width = c.clientWidth * dpr);
      const h = (c.height = 80 * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < w / dpr; x++) {
        const y = 40 + Math.sin((x + t) / 8) * (active ? 16 : 6) + Math.sin((x + t) / 1.8) * (active ? 4 : 2);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      t += active ? 2 : 0.5;
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return <canvas ref={ref} className="w-full h-20 block" />;
}

function pcm16Wav(float32: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + float32.length * 2);
  const view = new DataView(buffer);
  const write = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };

  write(0, 'RIFF');
  view.setUint32(4, 36 + float32.length * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, float32.length * 2, true);

  let offset = 44;
  for (let i = 0; i < float32.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return view;
}

/* ------------------------------
   Otoscope (demo)
--------------------------------*/
function OtoscopePane() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [rec, setRec] = useState(false);
  const chunksRef = useRef<Blob[]>([]);
  const recRef = useRef<MediaRecorder | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (!alive) return;
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch {
        /* fallback */
      }
    })();
    return () => {
      alive = false;
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {}
    };
  }, []);

  const snap = () => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const c = document.createElement('canvas');
    c.width = v.videoWidth || 1280;
    c.height = v.videoHeight || 720;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(v, 0, 0);
    const url = c.toDataURL('image/png');
    setPhotoUrl(url);
  };

  const toggleRec = () => {
    const s = streamRef.current;
    if (!s) return;
    if (!rec) {
      chunksRef.current = [];
      const mr = new MediaRecorder(s, { mimeType: 'video/webm;codecs=vp9' });
      recRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setMediaUrl(URL.createObjectURL(blob));
      };
      mr.start();
      setRec(true);
    } else {
      recRef.current?.stop();
      setRec(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-white p-2">
        <div className="relative aspect-video w-full bg-black rounded">
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover rounded" />
          {!streamRef.current && (
            <div className="absolute inset-0 grid place-items-center text-white/70 text-sm">Camera unavailable</div>
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <button onClick={snap} className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50">
            Snap
          </button>
          <button onClick={toggleRec} className={`px-3 py-1.5 rounded ${rec ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
            {rec ? 'Stop Rec' : 'Start Rec'}
          </button>
          <button onClick={() => recRef.current?.pause()} className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50" disabled={!rec}>
            Pause
          </button>
          <button onClick={() => recRef.current?.resume()} className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50" disabled={!rec}>
            Resume
          </button>
        </div>
      </div>

      {(photoUrl || mediaUrl) && (
        <div className="rounded-xl border bg-white p-2">
          <div className="text-sm font-medium mb-2">Captured</div>
          {photoUrl && (
            <div className="mb-2">
              <img src={photoUrl} alt="Snapshot" className="rounded border" />
              <div className="mt-1 flex gap-2">
                <a href={photoUrl} download="otoscope-photo.png" className="px-2 py-1 rounded border text-xs bg-white hover:bg-gray-50">
                  Download
                </a>
                <button onClick={() => alert('Saved photo to session (demo)')} className="px-2 py-1 rounded border text-xs bg-white hover:bg-gray-50">
                  Save to Session
                </button>
              </div>
            </div>
          )}
          {mediaUrl && (
            <div>
              <video controls src={mediaUrl} className="w-full rounded border" />
              <div className="mt-1 flex gap-2">
                <a href={mediaUrl} download="otoscope-video.webm" className="px-2 py-1 rounded border text-xs bg-white hover:bg-gray-50">
                  Download
                </a>
                <button onClick={() => alert('Saved video to session (demo)')} className="px-2 py-1 rounded border text-xs bg-white hover:bg-gray-50">
                  Save to Session
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
