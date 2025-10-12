'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export default function GettingReady() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [camOk, setCamOk] = useState<boolean | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [rttMs, setRttMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);

  // camera + mic analyser
  useEffect(() => {
    let stream: MediaStream | null = null;
    let anim: number | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setCamOk(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        // mic analyser
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        const data = new Uint8Array(analyser.frequencyBinCount);
        src.connect(analyser);
        const loop = () => {
          analyser.getByteTimeDomainData(data);
          // crude RMS
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          setMicLevel(Math.min(1, rms * 4));
          anim = requestAnimationFrame(loop);
        };
        anim = requestAnimationFrame(loop);
      } catch (e: any) {
        setCamOk(false);
        setError(e?.message || 'Media devices unavailable');
      }
    })();
    return () => {
      if (anim) cancelAnimationFrame(anim);
      if (audioCtxRef.current) audioCtxRef.current.close();
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, []);

  // network RTT (to same origin)
  useEffect(() => {
    let alive = true;
    const ping = async () => {
      const t0 = performance.now();
      try {
        await fetch('/api/televisit/list', { cache: 'no-store' });
        const dt = performance.now() - t0;
        if (alive) setRttMs(Math.round(dt));
      } catch {
        if (alive) setRttMs(null);
      } finally {
        if (alive) setTimeout(ping, 5000);
      }
    };
    ping();
    return () => { alive = false; };
  }, []);

  const startTone = () => {
    if (oscRef.current) return;
    const ctx = audioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current = ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 440;
    gain.gain.value = 0.05;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    oscRef.current = osc;
  };

  const stopTone = () => {
    if (oscRef.current) { oscRef.current.stop(); oscRef.current.disconnect(); oscRef.current = null; }
  };

  return (
    <div className="space-y-3">
      {error && <div className="text-sm text-rose-600">âš  {error}</div>}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <div className="text-xs text-gray-600">Camera</div>
          <div className="aspect-video w-full rounded border overflow-hidden bg-black">
            <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
          </div>
          <div className="text-xs">{camOk === null ? 'Requesting permissionâ€¦' : camOk ? 'Camera OK' : 'No camera'}</div>
        </div>

        <div className="space-y-2">
          <div className="text-xs text-gray-600">Microphone</div>
          <div className="h-8 w-full rounded border bg-gray-100 overflow-hidden">
            <div className="h-full bg-emerald-500 transition-[width] duration-100" style={{ width: `${Math.round(micLevel * 100)}%` }} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={startTone} className="px-2 py-1 text-xs rounded border">Speaker Test</button>
            <button onClick={stopTone} className="px-2 py-1 text-xs rounded border">Stop</button>
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-600">
        Network RTT: {rttMs == null ? 'â€”' : `${rttMs} ms`}
      </div>

      <div className="text-xs text-gray-500">
        Tip: Allow camera & mic, select your preferred devices, and close noisy apps. Use headphones to prevent echo.
      </div>
    </div>
  );
}
