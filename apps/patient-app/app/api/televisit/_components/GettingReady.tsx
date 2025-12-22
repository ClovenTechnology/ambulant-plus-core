'use client';

import { useEffect, useRef, useState } from 'react';

export default function GettingReady() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [camOk, setCamOk] = useState<boolean | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [rttMs, setRttMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const toneOscRef = useRef<OscillatorNode | null>(null);
  const toneGainRef = useRef<GainNode | null>(null);

  // camera + mic analyser
  useEffect(() => {
    let anim: number | null = null;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        setCamOk(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = ctx;

        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;

        analyserRef.current = analyser;
        src.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);

        const loop = () => {
          const an = analyserRef.current;
          if (!an) return;

          an.getByteTimeDomainData(data);
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

      // stop tone
      try {
        toneOscRef.current?.stop();
      } catch {}
      try {
        toneOscRef.current?.disconnect();
      } catch {}
      try {
        toneGainRef.current?.disconnect();
      } catch {}
      toneOscRef.current = null;
      toneGainRef.current = null;

      // stop analyser
      try {
        analyserRef.current?.disconnect();
      } catch {}
      analyserRef.current = null;

      // stop stream
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      // close audio context
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
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
    return () => {
      alive = false;
    };
  }, []);

  const ensureAudioCtx = async () => {
    const ctx = audioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current = ctx;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {}
    }
    return ctx;
  };

  const startTone = async () => {
    if (toneOscRef.current) return;
    const ctx = await ensureAudioCtx();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = 440;
    gain.gain.value = 0.05;

    osc.connect(gain).connect(ctx.destination);
    osc.start();

    toneOscRef.current = osc;
    toneGainRef.current = gain;
  };

  const stopTone = () => {
    try {
      toneOscRef.current?.stop();
    } catch {}
    try {
      toneOscRef.current?.disconnect();
    } catch {}
    try {
      toneGainRef.current?.disconnect();
    } catch {}
    toneOscRef.current = null;
    toneGainRef.current = null;
  };

  return (
    <div className="space-y-3">
      {error && <div className="text-sm text-rose-600">⚠ {error}</div>}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <div className="text-xs text-gray-600">Camera</div>
          <div className="aspect-video w-full rounded border overflow-hidden bg-black">
            <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
          </div>
          <div className="text-xs">
            {camOk === null ? 'Requesting permission…' : camOk ? 'Camera OK' : 'No camera'}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs text-gray-600">Microphone</div>
          <div className="h-8 w-full rounded border bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-[width] duration-100"
              style={{ width: `${Math.round(micLevel * 100)}%` }}
            />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={startTone} className="px-2 py-1 text-xs rounded border">
              Speaker Test
            </button>
            <button onClick={stopTone} className="px-2 py-1 text-xs rounded border">
              Stop
            </button>
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-600">Network RTT: {rttMs == null ? '—' : `${rttMs} ms`}</div>

      <div className="text-xs text-gray-500">
        Tip: Allow camera & mic, select your preferred devices, and close noisy apps. Use headphones to prevent echo.
      </div>
    </div>
  );
}
