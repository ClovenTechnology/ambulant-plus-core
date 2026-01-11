// apps/patient-app/components/iomt/StethoPane.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useIomtConsent } from '@/src/hooks/useIomtConsent';

export default function StethoPane() {
  const consent = useIomtConsent('stethoscope');

  const [mode, setMode] = useState<'heart' | 'lung'>('heart');
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const chunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      try {
        rec?.stop();
      } catch {}
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {}
      if (audioURL) {
        try { URL.revokeObjectURL(audioURL); } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setErr(null);
    if (!consent.accepted) {
      setErr('Please review & accept the Stethoscope consent before recording.');
      return;
    }
    if (busy || rec) return;

    setBusy(true);
    try {
      // pairing/permissions would be triggered here when integrating SDK
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunks.current, { type: 'audio/webm' });
        chunks.current = [];
        setAudioURL((prev) => {
          if (prev) {
            try { URL.revokeObjectURL(prev); } catch {}
          }
          return URL.createObjectURL(blob);
        });
      };

      mr.start();
      setRec(mr);
    } catch (e: any) {
      setErr(e?.message ? String(e.message) : 'Microphone permission failed.');
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {}
      streamRef.current = null;
    } finally {
      setBusy(false);
    }
  }

  function stop() {
    try {
      rec?.stop();
    } catch {}
    setRec(null);

    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    streamRef.current = null;
  }

  function save() {
    if (!audioURL) return;
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = audioURL;
    a.download = `stetho-${ts}-${mode}.webm`; // MP3 requires encoder; convert later server-side
    a.click();
  }

  return (
    <div className="space-y-4">
      {/* Consent (device-specific, not televisit) */}
      {!consent.accepted ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="font-semibold">Stethoscope consent required</div>
          <div className="mt-1 text-amber-800">
            <a className="underline" href={consent.pdfUrl} target="_blank" rel="noreferrer">
              View consent PDF ({consent.version})
            </a>
          </div>
          <button
            onClick={consent.accept}
            className="mt-2 inline-flex items-center rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white"
          >
            I agree (enable recording)
          </button>
        </div>
      ) : (
        <div className="rounded-xl border p-3 text-xs text-zinc-600">
          Consent accepted · {consent.version}
          {consent.acceptedAt ? ` · ${new Date(consent.acceptedAt).toLocaleString()}` : ''}
        </div>
      )}

      {err ? <div className="text-sm text-red-600">{err}</div> : null}

      <div className="flex gap-2">
        <button
          onClick={() => setMode('heart')}
          className={`px-3 py-1 rounded ${mode === 'heart' ? 'bg-zinc-900 text-white' : 'border'}`}
        >
          Heart
        </button>
        <button
          onClick={() => setMode('lung')}
          className={`px-3 py-1 rounded ${mode === 'lung' ? 'bg-zinc-900 text-white' : 'border'}`}
        >
          Lung
        </button>
      </div>

      <div className="flex gap-2">
        {!rec ? (
          <button
            onClick={start}
            disabled={busy || !consent.accepted}
            className="px-4 py-2 rounded-xl border bg-zinc-900 text-white disabled:opacity-50"
          >
            {busy ? 'Starting…' : 'Start Recording'}
          </button>
        ) : (
          <button onClick={stop} className="px-4 py-2 rounded-xl border bg-red-600 text-white">
            Stop
          </button>
        )}
        <button onClick={save} disabled={!audioURL} className="px-4 py-2 rounded-xl border disabled:opacity-50">
          Save
        </button>
      </div>

      {audioURL && (
        <div className="space-y-2">
          <div className="text-sm text-zinc-600">Instant playback</div>
          <audio controls src={audioURL} className="w-full" />
        </div>
      )}

      <div className="text-xs text-zinc-500">
        Tip: Switch to device mic if hardware is unavailable; SDK pairing will replace getUserMedia().
      </div>
    </div>
  );
}
