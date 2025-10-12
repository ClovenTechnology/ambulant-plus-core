'use client';

import { useEffect, useRef, useState } from 'react';

export default function PreflightPanel() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [level, setLevel] = useState(0);
  const [running, setRunning] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [inp, setInp] = useState<string>(''); // audioinput deviceId
  const [cam, setCam] = useState<string>(''); // videoinput deviceId
  const [out, setOut] = useState<string>(''); // audiooutput deviceId (sink)
  const LS_KEY = 'sfu.preflight.devices';

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.inp) setInp(s.inp);
        if (s.cam) setCam(s.cam);
        if (s.out) setOut(s.out);
      }
    } catch {}
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let ctx: AudioContext | null = null;

    async function ensureDevices() {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        setDevices(list);
        if (!cam) setCam(list.find(d => d.kind === 'videoinput')?.deviceId || '');
        if (!inp) setInp(list.find(d => d.kind === 'audioinput')?.deviceId || '');
        if (!out) setOut(list.find(d => d.kind === 'audiooutput')?.deviceId || '');
      } catch {}
    }

    async function start() {
      try {
        await ensureDevices();
        const constraints: MediaStreamConstraints = {
          audio: inp ? { deviceId: { exact: inp } } : true,
          video: cam ? { deviceId: { exact: cam } } : true,
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (videoRef.current) videoRef.current.srcObject = stream;

        // @ts-ignore
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctxLocal: AudioContext = new Ctx();
        const srcLocal = ctxLocal.createMediaStreamSource(stream);
        const analyserLocal = ctxLocal.createAnalyser();
        analyserLocal.fftSize = 512;
        srcLocal.connect(analyserLocal);

        const data = new Uint8Array(analyserLocal.frequencyBinCount);
        const tick = () => {
          analyserLocal.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          setLevel(Math.sqrt(sum / data.length));
          raf = requestAnimationFrame(tick);
        };
        tick();
        setRunning(true);

        // cleanup refs
        // @ts-ignore
        ctx = ctxLocal;
      } catch {}
    }

    start();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (ctx) ctx.close();
      setRunning(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inp, cam]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ inp, cam, out }));
    } catch {}
  }, [inp, cam, out]);

  async function playTone() {
    // @ts-ignore
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 440;
    gain.gain.value = 0.05;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 500);
  }

  async function setOutput(el: HTMLAudioElement | null) {
    if (!el || !out) return;
    // @ts-ignore
    if (typeof el.setSinkId === 'function') {
      // @ts-ignore
      await el.setSinkId(out).catch(() => {});
    }
  }

  return (
    <div className="mt-3 border rounded p-2">
      <div className="text-xs font-medium mb-2">Preflight Check</div>

      <div className="grid md:grid-cols-3 gap-2 mb-2">
        <label className="text-xs flex flex-col">
          <span className="text-gray-600 mb-1">Microphone</span>
          <select className="border rounded px-2 py-1" value={inp} onChange={e => setInp(e.target.value)}>
            {devices
              .filter(d => d.kind === 'audioinput')
              .map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || 'Mic'}
                </option>
              ))}
          </select>
        </label>
        <label className="text-xs flex flex-col">
          <span className="text-gray-600 mb-1">Camera</span>
          <select className="border rounded px-2 py-1" value={cam} onChange={e => setCam(e.target.value)}>
            {devices
              .filter(d => d.kind === 'videoinput')
              .map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || 'Camera'}
                </option>
              ))}
          </select>
        </label>
        <label className="text-xs flex flex-col">
          <span className="text-gray-600 mb-1">Speakers (Audio Output)</span>
          <select className="border rounded px-2 py-1" value={out} onChange={e => setOut(e.target.value)}>
            {devices
              .filter(d => d.kind === 'audiooutput')
              .map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || 'Speakers'}
                </option>
              ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-xs text-gray-600 mb-1">Camera preview</div>
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-32 bg-black rounded object-cover" />
        </div>
        <div>
          <div className="text-xs text-gray-600 mb-1">Mic level</div>
          <div className="h-32 border rounded flex items-end p-2">
            <div className="w-full bg-gray-200 rounded">
              <div className="bg-emerald-600 rounded" style={{ height: `${Math.min(100, Math.round(level * 140))}%` }} />
            </div>
          </div>
          <div className="text-[11px] text-gray-500 mt-1">{running ? 'Listening…' : 'Stopped'}</div>
          <div className="mt-2 flex items-center gap-2">
            <button className="px-2 py-1 text-xs border rounded" onClick={playTone}>
              Play Test Tone
            </button>
            <audio ref={setOutput} />
          </div>
        </div>
      </div>

      <div className="mt-2 text-[11px] text-gray-500">Device selections are saved for this browser. Test tone is quiet by design.</div>
    </div>
  );
}
