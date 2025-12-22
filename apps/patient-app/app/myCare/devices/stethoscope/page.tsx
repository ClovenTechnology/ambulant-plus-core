// apps/patient-app/app/myCare/devices/stethoscope/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { StethoscopeNUS } from '@/src/devices/decoders/stethoscopeNUS';
import { WavRecorder, type PcmChunk } from '@/src/devices/decoders/wav';

async function uploadAuscultation(patientId: string, blob: Blob) {
  const form = new FormData();
  form.append('file', blob, `steth_${Date.now()}.wav`);
  form.append(
    'meta',
    new Blob([JSON.stringify({ site: 'chest', note: 'auto-segment', t: new Date().toISOString() })], {
      type: 'application/json',
    })
  );
  const r = await fetch(`/api/v1/patients/${encodeURIComponent(patientId)}/auscultations`, {
    method: 'POST',
    body: form,
  });
  if (!r.ok) throw new Error(`upload failed ${r.status}`);
  return r.json();
}

export default function StethoscopeConsole() {
  const [connected, setConnected] = useState(false);
  const [packets, setPackets] = useState(0);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);

  const patientId = 'patient-1111';

  const recorderRef = useRef<WavRecorder | null>(null);
  const stethRef = useRef<StethoscopeNUS | null>(null);

  // Waveform state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const latestRef = useRef<Float32Array | null>(null);
  const rafRef = useRef<number | null>(null);
  const gainRef = useRef<number>(1);

  // draw loop
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const { width, height } = canvas;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);

    const f = latestRef.current;
    if (f && f.length > 0) {
      const step = Math.max(1, Math.floor(f.length / width));
      const mid = height / 2;
      for (let x = 0; x < width; x++) {
        const i = x * step;
        const sample = f[i] * gainRef.current;
        const y = mid - sample * (mid - 4); // scale
        ctx.lineTo(x, y);
      }
    } else {
      ctx.lineTo(width, height / 2);
    }
    ctx.stroke();

    rafRef.current = requestAnimationFrame(draw);
  };

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onUiChunk = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { float32: Float32Array };
      latestRef.current = detail.float32;
    };
    window.addEventListener('stethoscope:chunk', onUiChunk as EventListener);
    return () => window.removeEventListener('stethoscope:chunk', onUiChunk as EventListener);
  }, []);

  useEffect(
    () => () => {
      try { stethRef.current?.stop(); } catch {}
    },
    []
  );

  const connect = async () => {
    // Recorder at 8kHz to match default
    recorderRef.current = new WavRecorder(8000);

    // Use Web Bluetooth NUS decoder (will show browser device prompt)
    const st = new StethoscopeNUS({
      sampleRate: 8000,
      playToSpeaker: false, // keep silent; waveform still renders
      onChunk: (c: PcmChunk) => {
        setPackets((p) => p + 1);
        if (recording) recorderRef.current?.push(c);
      },
    });

    stethRef.current = st;
    await st.requestAndConnect();
    setConnected(true);
  };

  const toggleRecord = async () => {
    if (!recording) {
      setRecording(true);
      return;
    }

    // stop & upload
    setRecording(false);
    try {
      const blob = recorderRef.current?.flush();
      if (blob) {
        setUploading(true);
        try { await uploadAuscultation(patientId, blob); }
        finally { setUploading(false); }
      }
    } catch (e) {
      console.warn('upload failed', e);
    }
  };

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      <h2>Digital Stethoscope</h2>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={connect} disabled={connected}>
          {connected ? 'Connected' : 'Connect'}
        </button>

        <button onClick={toggleRecord} disabled={!connected || uploading}>
          {recording ? 'Stop & Save' : 'Start Recording'}
        </button>

        <span>Packets: {packets}</span>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Volume
          <input
            type="range"
            min={0}
            max={2}
            step={0.01}
            defaultValue={1}
            onChange={(e) => (gainRef.current = parseFloat(e.target.value))}
            style={{ width: 160 }}
          />
        </label>

        {uploading && <span>Uploading…</span>}
      </div>

      <canvas
        ref={canvasRef}
        width={1024}
        height={220}
        style={{
          width: '100%',
          height: 220,
          border: '1px solid #ddd',
          borderRadius: 8,
          background: '#fff',
        }}
      />

      {!connected && (
        <p style={{ color: '#666' }}>
          Click <b>Connect</b> and allow Bluetooth/Microphone if prompted. Waveform will appear once the device streams.
        </p>
      )}
    </div>
  );
}
