'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { StethoscopeNUS } from '@/src/devices/decoders/stethoscopeNUS';
import { WavRecorder, type PcmChunk } from '@/src/devices/decoders/wav';
import { connectNexRingPPG } from '@/src/devices/decoders/nexringPPG';
import { API } from '@/src/lib/config';
import { useIomtConsent } from '@/src/hooks/useIomtConsent';

function u8ToB64(u8: Uint8Array) {
  // chunked btoa to avoid callstack blowups
  let out = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < u8.length; i += CHUNK) {
    out += String.fromCharCode(...u8.subarray(i, i + CHUNK));
  }
  return btoa(out);
}

function ConsentInline({
  title,
  accepted,
  pdfUrl,
  version,
  onAccept,
}: {
  title: string;
  accepted: boolean;
  pdfUrl: string;
  version: string;
  onAccept: () => void;
}) {
  if (accepted) {
    return <div className="text-[11px] text-gray-500">Consent accepted · {version}</div>;
  }
  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
      <div className="font-semibold">{title} consent required</div>
      <div className="mt-1">
        <a className="underline" href={pdfUrl} target="_blank" rel="noreferrer">
          View PDF ({version})
        </a>
      </div>
      <button onClick={onAccept} className="mt-2 rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-white">
        I agree
      </button>
    </div>
  );
}

export default function DeviceControlDock({ roomId }: { roomId: string }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="fixed right-3 bottom-3 w-[360px] max-w-[92vw]">
      <div className="border rounded-xl bg-white shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
          <div className="text-sm font-medium">Patient Devices</div>
          <button className="text-xs px-2 py-1 border rounded" onClick={() => setOpen((v) => !v)}>
            {open ? 'Hide' : 'Show'}
          </button>
        </div>

        {open && (
          <div className="p-3 space-y-3">
            <StethoscopeCard roomId={roomId} />
            <OtoscopeCard roomId={roomId} />
            <NexRingCard roomId={roomId} />
            <MonitorCard roomId={roomId} />
          </div>
        )}
      </div>
    </div>
  );
}

/* --------- Stethoscope --------- */
function StethoscopeCard({ roomId }: { roomId: string }) {
  const consent = useIomtConsent('stethoscope');

  const [site, setSite] = useState<'heart' | 'lung'>('heart');
  const siteRef = useRef<'heart' | 'lung'>('heart');
  useEffect(() => {
    siteRef.current = site;
  }, [site]);

  const [nus, setNus] = useState<StethoscopeNUS | null>(null);

  const [recUI, setRecUI] = useState(false);
  const recOnRef = useRef(false);

  const recRef = useRef<WavRecorder | null>(null);
  const [recSecs, setRecSecs] = useState(0);
  const recStartRef = useRef<number | null>(null);

  const lastSiteAnnounceRef = useRef(0);

  const onChunk = useCallback(
    (c: PcmChunk) => {
      // Record gating uses refs (not stale state)
      if (recOnRef.current) {
        if (!recRef.current) recRef.current = new WavRecorder(c.sampleRate);
        recRef.current.push(c);
        if (recStartRef.current == null) recStartRef.current = Date.now();
        setRecSecs(Math.round((Date.now() - recStartRef.current) / 1000));
      }

      // Throttle site annotation to 1/sec (prevents fetch spam)
      const now = Date.now();
      if (now - lastSiteAnnounceRef.current > 1000) {
        lastSiteAnnounceRef.current = now;
        fetch(`${API}/api/insight/frame`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            roomId,
            kind: 'stethoscope_site',
            ts: now,
            site: siteRef.current,
          }),
        }).catch(() => {});
      }
    },
    [roomId]
  );

  const connect = async () => {
    if (!consent.accepted) return;
    const s = new StethoscopeNUS({ sampleRate: 8000, playToSpeaker: true, roomId, onChunk });
    await s.requestAndConnect();
    setNus(s);
  };

  const stop = async () => {
    try {
      await nus?.stop();
    } catch {}
    setNus(null);

    // stop recording if active
    recOnRef.current = false;
    setRecUI(false);
    recRef.current = null;
    recStartRef.current = null;
    setRecSecs(0);
  };

  const toggleRec = async () => {
    if (!consent.accepted) return;
    if (!nus) return;

    if (!recOnRef.current) {
      recOnRef.current = true;
      setRecUI(true);
      recRef.current = null;
      recStartRef.current = null;
      setRecSecs(0);
      return;
    }

    // stop recording
    recOnRef.current = false;
    setRecUI(false);

    const blob = recRef.current?.flush();
    recRef.current = null;
    recStartRef.current = null;
    setRecSecs(0);

    if (blob) {
      const u8 = new Uint8Array(await blob.arrayBuffer());
      const b64 = u8ToB64(u8);

      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `steth_${Date.now()}.wav`;
      a.click();

      fetch(`${API}/api/insight/frame`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          roomId,
          kind: 'stethoscope_recording',
          ts: Date.now(),
          mime: 'audio/wav',
          payloadB64: b64,
          meta: { site: siteRef.current },
        }),
      }).catch(() => {});
    }
  };

  return (
    <section className="border rounded p-3">
      <div className="font-medium">Stethoscope</div>
      <div className="text-xs text-gray-600">BLE NUS (HC21)</div>

      <ConsentInline
        title="Stethoscope"
        accepted={consent.accepted}
        pdfUrl={consent.pdfUrl}
        version={consent.version}
        onAccept={consent.accept}
      />

      <div className="mt-2 flex items-center gap-2">
        {!nus ? (
          <button
            onClick={connect}
            disabled={!consent.accepted}
            className="px-2 py-1 border rounded text-xs disabled:opacity-50"
          >
            Connect
          </button>
        ) : (
          <button onClick={stop} className="px-2 py-1 border rounded text-xs">
            Disconnect
          </button>
        )}

        <label className="text-xs flex items-center gap-1 ml-auto">
          <span>Site</span>
          <select
            className="border rounded px-1 py-0.5"
            value={site}
            onChange={(e) => setSite(e.target.value as any)}
          >
            <option value="heart">Heart</option>
            <option value="lung">Lung</option>
          </select>
        </label>

        <button
          onClick={toggleRec}
          disabled={!nus || !consent.accepted}
          className="px-2 py-1 border rounded text-xs disabled:opacity-50"
        >
          {recUI ? `Stop Rec (${recSecs}s)` : 'Record WAV'}
        </button>
      </div>
    </section>
  );
}

/* --------- Otoscope --------- */
function OtoscopeCard({ roomId }: { roomId: string }) {
  const consent = useIomtConsent('otoscope');

  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    (async () => {
      const all = await navigator.mediaDevices.enumerateDevices();
      setCams(all.filter((d) => d.kind === 'videoinput'));
    })().catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      try {
        stream?.getTracks().forEach((t) => t.stop());
      } catch {}
    };
  }, [stream]);

  const start = async () => {
    if (!consent.accepted) return;
    const s = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: deviceId || undefined, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    setStream(s);
    if (videoRef.current) videoRef.current.srcObject = s;
  };

  const stop = () => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  };

  const capture = async () => {
    if (!consent.accepted) return;
    if (!videoRef.current) return;

    const v = videoRef.current;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(v, 0, 0);

    const blob = await new Promise<Blob | null>((r) => c.toBlob((b) => r(b), 'image/jpeg', 0.9));
    if (!blob) return;

    const u8 = new Uint8Array(await blob.arrayBuffer());
    const b64 = u8ToB64(u8);

    await fetch(`${API}/api/insight/frame`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roomId, kind: 'otoscope_frame', ts: Date.now(), mime: 'image/jpeg', payloadB64: b64 }),
    }).catch(() => {});

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `otoscope_${Date.now()}.jpg`;
    a.click();
  };

  return (
    <section className="border rounded p-3">
      <div className="font-medium">Otoscope</div>
      <div className="text-xs text-gray-600">Use a UVC camera if available</div>

      <ConsentInline
        title="Otoscope"
        accepted={consent.accepted}
        pdfUrl={consent.pdfUrl}
        version={consent.version}
        onAccept={consent.accept}
      />

      <div className="mt-2 flex items-center gap-2">
        <select
          className="border rounded px-2 py-1 text-xs"
          value={deviceId ?? ''}
          onChange={(e) => setDeviceId(e.target.value || null)}
        >
          <option value="">Default camera</option>
          {cams.map((c) => (
            <option key={c.deviceId} value={c.deviceId}>
              {c.label || 'Camera'}
            </option>
          ))}
        </select>

        {!stream ? (
          <button onClick={start} disabled={!consent.accepted} className="px-2 py-1 border rounded text-xs disabled:opacity-50">
            Start
          </button>
        ) : (
          <button onClick={stop} className="px-2 py-1 border rounded text-xs">
            Stop
          </button>
        )}

        <button onClick={capture} disabled={!stream || !consent.accepted} className="px-2 py-1 border rounded text-xs disabled:opacity-50">
          Capture Still
        </button>
      </div>

      <div className="mt-2 rounded overflow-hidden border bg-black aspect-video">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
      </div>
    </section>
  );
}

/* --------- NexRing --------- */
function NexRingCard({ roomId }: { roomId: string }) {
  const consent = useIomtConsent('nexring');

  const [conn, setConn] = useState<{ disconnect: () => Promise<void> } | null>(null);
  const [sending, setSending] = useState(false);

  const connect = async () => {
    if (!consent.accepted) return;
    const c = await connectNexRingPPG((_frame) => {
      // raw PPG frames are auto-sent in the decoder
    }, roomId);
    setConn(c);
  };

  const stop = async () => {
    try {
      await conn?.disconnect();
    } catch {}
    setConn(null);
  };

  const sendSummary = async () => {
    if (!consent.accepted) return;
    setSending(true);
    try {
      const metrics = {
        hr: 74, spo2: 98, rr: 15, hrv: 48, rhr: 62,
        steps: 6234, calories: 420,
        readiness: 76, sleepScore: 82, stress: 31,
        sleepStages: { rem: 78, deep: 54, light: 258 },
      };
      await fetch(`${API}/api/insight/frame`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roomId, kind: 'nexring_metrics', ts: Date.now(), metrics, meta: { vendor: 'nexring' } }),
      });
    } catch {}
    setSending(false);
  };

  return (
    <section className="border rounded p-3">
      <div className="font-medium">NexRing</div>
      <div className="text-xs text-gray-600">PPG + summaries</div>

      <ConsentInline
        title="NexRing"
        accepted={consent.accepted}
        pdfUrl={consent.pdfUrl}
        version={consent.version}
        onAccept={consent.accept}
      />

      <div className="mt-2 flex items-center gap-2">
        {!conn ? (
          <button onClick={connect} disabled={!consent.accepted} className="px-2 py-1 border rounded text-xs disabled:opacity-50">
            Connect PPG
          </button>
        ) : (
          <button onClick={stop} className="px-2 py-1 border rounded text-xs">
            Stop PPG
          </button>
        )}

        <button onClick={sendSummary} disabled={sending || !consent.accepted} className="px-2 py-1 border rounded text-xs disabled:opacity-50">
          {sending ? 'Sending…' : 'Send Summary'}
        </button>
      </div>

      <div className="text-xs text-gray-500 mt-1">
        Summary includes HR/SpO₂/RR/HRV/RHR, steps, calories, readiness & sleep.
      </div>
    </section>
  );
}

/* --------- Basic Health Monitor (demo buttons) --------- */
function MonitorCard({ roomId }: { roomId: string }) {
  const consent = useIomtConsent('monitor');

  const send = (type: string, value: any) =>
    fetch(`${API}/api/insight/frame`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roomId, kind: type, ts: Date.now(), value }),
    }).catch(() => {});

  return (
    <section className="border rounded p-3">
      <div className="font-medium">Health Monitor</div>

      <ConsentInline
        title="Health Monitor"
        accepted={consent.accepted}
        pdfUrl={consent.pdfUrl}
        version={consent.version}
        onAccept={consent.accept}
      />

      <div className="grid grid-cols-2 gap-2 mt-2">
        <button disabled={!consent.accepted} className="px-2 py-1 border rounded text-xs disabled:opacity-50" onClick={() => send('bp', { sys: 120, dia: 78 })}>
          Take BP
        </button>
        <button disabled={!consent.accepted} className="px-2 py-1 border rounded text-xs disabled:opacity-50" onClick={() => send('spo2', 98)}>
          SpO₂
        </button>
        <button disabled={!consent.accepted} className="px-2 py-1 border rounded text-xs disabled:opacity-50" onClick={() => send('temp', 36.8)}>
          Temp
        </button>
        <button disabled={!consent.accepted} className="px-2 py-1 border rounded text-xs disabled:opacity-50" onClick={() => send('ecg_event', { hr: 72 })}>
          ECG Spot
        </button>
      </div>

      <div className="text-xs text-gray-500 mt-1">These demo buttons push frames into the room stream.</div>
    </section>
  );
}
