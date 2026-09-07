// apps/clinician-app/components/StethoscopePanel.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type PcmChunk = {
  ts: number;
  sampleRate: number;
  samples: Int16Array;
};

type Props = {
  roomId?: string;
  encounterId?: string | null;
  patientId?: string | null;
  canSaveToSummary?: boolean;
};

const GW =
  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
  process.env.NEXT_PUBLIC_GATEWAY_BASE ||
  '';

function b64ToInt16(b64: string) {
  const bin = atob(b64);
  const len = bin.length;
  const u8 = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    u8[i] = bin.charCodeAt(i);
  }

  return new Int16Array(u8.buffer);
}

class WavRecorder {
  private chunks: PcmChunk[] = [];

  constructor(private sampleRate: number) {}

  push(chunk: PcmChunk) {
    if (chunk.sampleRate === this.sampleRate) {
      this.chunks.push(chunk);
    }
  }

  flush(): Blob {
    const totalSamples = this.chunks.reduce(
      (count, chunk) => count + chunk.samples.length,
      0,
    );
    const dataBytes = totalSamples * 2;
    const buffer = new ArrayBuffer(44 + dataBytes);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    bytes.set([0x52, 0x49, 0x46, 0x46], 0);
    view.setUint32(4, 36 + dataBytes, true);
    bytes.set([0x57, 0x41, 0x56, 0x45], 8);
    bytes.set([0x66, 0x6d, 0x74, 0x20], 12);
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, this.sampleRate, true);
    view.setUint32(28, this.sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    bytes.set([0x64, 0x61, 0x74, 0x61], 36);
    view.setUint32(40, dataBytes, true);

    let offset = 44;

    for (const chunk of this.chunks) {
      const target = new Int16Array(
        buffer,
        offset,
        chunk.samples.length,
      );
      target.set(chunk.samples);
      offset += chunk.samples.length * 2;
    }

    this.chunks = [];

    return new Blob([buffer], { type: 'audio/wav' });
  }
}

export default function StethoscopePanel({
  roomId,
  encounterId,
  patientId,
  canSaveToSummary = false,
}: Props) {
  const [connected, setConnected] = useState(false);
  const [liveSpeaker, setLiveSpeaker] = useState(true);
  const [sampleRate, setSampleRate] = useState(8000);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<string | null>(null);

  const acRef = useRef<AudioContext | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const ringRef = useRef<Float32Array>(new Float32Array(8000 * 3));
  const ringPosRef = useRef(0);

  const recRef = useRef<WavRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [wavUrl, setWavUrl] = useState<string | null>(null);
  const wavUrlRef = useRef<string | null>(null);
  const [wavBlob, setWavBlob] = useState<Blob | null>(null);
  const [recSecs, setRecSecs] = useState(0);
  const recStartRef = useRef<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let raf = 0;

    const draw = () => {
      const canvas = canvasRef.current;

      if (canvas) {
        const context = canvas.getContext('2d')!;
        const width = canvas.width;
        const height = canvas.height;

        context.clearRect(0, 0, width, height);
        context.strokeStyle = '#111';
        context.beginPath();

        const ring = ringRef.current;

        for (let x = 0; x < width; x++) {
          const i = Math.floor((x / width) * ring.length);
          const y = Math.floor((ring[i] * 0.5 + 0.5) * height);

          if (x === 0) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        }

        context.stroke();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(
    () => () => {
      try {
        esRef.current?.close();
      } catch {}

      try {
        acRef.current?.close();
      } catch {}

      const currentWavUrl = wavUrlRef.current;
      if (currentWavUrl) {
        try {
          URL.revokeObjectURL(currentWavUrl);
        } catch {}
      }
    },
    [],
  );

  const attachAudio = (samples: Int16Array, rate: number) => {
    if (!liveSpeaker) return;

    if (!acRef.current) {
      acRef.current = new AudioContext({ sampleRate: rate });
    }

    const audioContext = acRef.current;
    const floatSamples = new Float32Array(samples.length);

    for (let i = 0; i < samples.length; i++) {
      floatSamples[i] = Math.max(
        -1,
        Math.min(1, samples[i] / 32768),
      );
    }

    const buffer = audioContext.createBuffer(
      1,
      floatSamples.length,
      rate,
    );
    buffer.copyToChannel(floatSamples, 0, 0);

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start();
  };

  const onFrame = (obj: any) => {
    if (
      !obj ||
      obj.kind !== 'stethoscope_pcm16' ||
      !obj.b64
    ) {
      return;
    }

    const rate = obj.sampleRate || 8000;
    setSampleRate(rate);

    const samples = b64ToInt16(obj.b64);
    const ring = ringRef.current;
    const position = ringPosRef.current;

    for (let i = 0; i < samples.length; i++) {
      ring[(position + i) % ring.length] = Math.max(
        -1,
        Math.min(1, samples[i] / 32768),
      );
    }

    ringPosRef.current = (position + samples.length) % ring.length;

    attachAudio(samples, rate);

    if (recording) {
      if (!recRef.current) {
        recRef.current = new WavRecorder(rate);
      }

      recRef.current.push({
        ts: Date.now(),
        sampleRate: rate,
        samples,
      });

      if (recStartRef.current == null) {
        recStartRef.current = Date.now();
      }

      setRecSecs(
        Math.round(
          (Date.now() - recStartRef.current) / 1000,
        ),
      );
    }
  };

  const onAi = (obj: any) => {
    const annotation = obj?.annotation;

    if (
      annotation?.type === 'audio' &&
      annotation?.label
    ) {
      setAiNote(
        `${annotation.label} (conf ${Math.round(
          (annotation.conf ?? 0) * 100,
        )}%)`,
      );
    }
  };

  const url = useMemo(() => {
    const base = GW?.replace(/\/+$/, '') || '';
    const path = `/api/insight/stream?session=${encodeURIComponent(
      roomId || 'default',
    )}`;

    return base ? `${base}${path}` : path;
  }, [roomId]);

  const connect = () => {
    if (esRef.current) return;

    const es = new EventSource(url, {
      withCredentials: false,
    });

    es.addEventListener('frame', (event) => {
      try {
        onFrame(JSON.parse((event as MessageEvent).data));
      } catch {}
    });

    es.addEventListener('ai', (event) => {
      try {
        onAi(JSON.parse((event as MessageEvent).data));
      } catch {}
    });

    es.addEventListener('ready', () => setConnected(true));
    es.onerror = () => {
      // EventSource reconnects automatically.
    };

    esRef.current = es;
    setConnected(true);
  };

  const disconnect = () => {
    try {
      esRef.current?.close();
    } catch {}

    esRef.current = null;
    setConnected(false);
  };

  const startRec = () => {
    const currentWavUrl = wavUrlRef.current;
    if (currentWavUrl) {
      try {
        URL.revokeObjectURL(currentWavUrl);
      } catch {}
    }
    wavUrlRef.current = null;
    setWavUrl(null);

    setWavBlob(null);
    setSaveState(null);
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

    if (blob) {
      const currentWavUrl = wavUrlRef.current;
      if (currentWavUrl) {
        try {
          URL.revokeObjectURL(currentWavUrl);
        } catch {}
      }

      const nextWavUrl = URL.createObjectURL(blob);
      wavUrlRef.current = nextWavUrl;
      setWavBlob(blob);
      setWavUrl(nextWavUrl);
    }
  };

  const canPersist = Boolean(
    canSaveToSummary &&
      wavBlob &&
      encounterId &&
      patientId,
  );

  const saveToSummary = async () => {
    if (!canPersist || !wavBlob || !encounterId || !patientId) {
      return;
    }

    setSaving(true);
    setSaveState(null);

    try {
      const stamp = Date.now();
      const file = new File(
        [wavBlob],
        `stethoscope_${stamp}.wav`,
        { type: 'audio/wav' },
      );

      const form = new FormData();
      form.set('file', file);
      form.set('patientId', patientId);
      form.set('docType', 'device-evidence');
      form.set('source', 'digital-stethoscope');
      form.set(
        'title',
        `Digital stethoscope recording · ${new Date(
          stamp,
        ).toISOString()}`,
      );

      const response = await fetch(
        `/api/encounters/${encodeURIComponent(encounterId)}/docs`,
        {
          method: 'POST',
          body: form,
        },
      );

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload?.ok === false) {
        throw new Error(
          payload?.error ||
            payload?.message ||
            `encounter_evidence_save_failed_${response.status}`,
        );
      }

      setSaveState('Saved to encounter clinical evidence.');
    } catch (error: any) {
      setSaveState(
        `Save failed: ${String(error?.message || 'unknown_error')}`,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {!connected ? (
          <button
            className="px-2 py-1 border rounded text-xs"
            onClick={connect}
          >
            Connect
          </button>
        ) : (
          <button
            className="px-2 py-1 border rounded text-xs"
            onClick={disconnect}
          >
            Disconnect
          </button>
        )}

        <label className="text-xs flex items-center gap-1">
          <input
            type="checkbox"
            checked={liveSpeaker}
            onChange={(event) =>
              setLiveSpeaker(event.target.checked)
            }
          />
          Live speaker
        </label>

        {!recording ? (
          <button
            className="px-2 py-1 border rounded text-xs"
            onClick={startRec}
            disabled={!connected}
          >
            Start recording
          </button>
        ) : (
          <button
            className="px-2 py-1 border rounded text-xs"
            onClick={stopRec}
          >
            Stop & prepare WAV
          </button>
        )}

        {recording ? (
          <span className="text-xs text-gray-600">
            REC {recSecs}s @ {sampleRate}Hz
          </span>
        ) : null}
      </div>

      <canvas
        ref={canvasRef}
        width={560}
        height={96}
        className="w-full rounded border bg-white"
      />

      {aiNote ? (
        <div className="text-xs text-gray-700">AI: {aiNote}</div>
      ) : null}

      <div className="flex items-center gap-2">
        <a
          className={`px-2 py-1 border rounded text-xs ${
            wavUrl ? '' : 'pointer-events-none opacity-50'
          }`}
          href={wavUrl ?? '#'}
          download={`stethoscope_${Date.now()}.wav`}
        >
          Download WAV
        </a>

        <button
          className={`px-2 py-1 border rounded text-xs ${
            canPersist ? '' : 'opacity-50'
          }`}
          disabled={!canPersist || saving}
          onClick={saveToSummary}
          title={
            !encounterId || !patientId
              ? 'Encounter and patient context are required'
              : undefined
          }
        >
          {saving ? 'Saving…' : 'Save to encounter'}
        </button>
      </div>

      {saveState ? (
        <div className="text-xs text-gray-600">{saveState}</div>
      ) : null}
    </div>
  );
}
