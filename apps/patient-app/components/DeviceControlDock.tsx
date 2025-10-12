'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StethoscopeNUS } from '@/src/devices/decoders/stethoscopeNUS';
import { WavRecorder, type PcmChunk } from '@/src/devices/decoders/wav';
import { connectNexRingPPG } from '@/src/devices/decoders/nexringPPG';
import { API } from '@/src/lib/config';

function toB64(u8: Uint8Array) { return btoa(String.fromCharCode(...u8)); }

export default function DeviceControlDock({ roomId }: { roomId: string }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="fixed right-3 bottom-3 w-[360px] max-w-[92vw]">
      <div className="border rounded-xl bg-white shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
          <div className="text-sm font-medium">Patient Devices</div>
          <button className="text-xs px-2 py-1 border rounded" onClick={()=>setOpen(v=>!v)}>{open?'Hide':'Show'}</button>
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
  const [site, setSite] = useState<'heart'|'lung'>('heart');
  const [nus, setNus] = useState<StethoscopeNUS | null>(null);
  const [rec, setRec] = useState(false);
  const recRef = useRef<WavRecorder | null>(null);
  const [recSecs, setRecSecs] = useState(0);
  const recStartRef = useRef<number | null>(null);

  const onChunk = (c: PcmChunk) => {
    if (rec) {
      if (!recRef.current) recRef.current = new WavRecorder(c.sampleRate);
      recRef.current.push(c);
      if (recStartRef.current == null) recStartRef.current = Date.now();
      setRecSecs(Math.round((Date.now() - recStartRef.current)/1000));
    }
    // additionally annotate site with a small side-channel frame (optional)
    fetch(`${API}/api/insight/frame`, {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ roomId, kind:'stethoscope_site', ts: Date.now(), site })
    }).catch(()=>{});
  };

  const connect = async () => {
    const s = new StethoscopeNUS({ sampleRate: 8000, playToSpeaker: true, roomId, onChunk });
    await s.requestAndConnect();
    setNus(s);
  };
  const stop = async () => { try { await nus?.stop(); } catch {} setNus(null); };
  const toggleRec = async () => {
    if (!rec) { setRec(true); recRef.current = null; recStartRef.current = null; setRecSecs(0); }
    else {
      setRec(false);
      const blob = recRef.current?.flush();
      recRef.current = null; recStartRef.current = null; setRecSecs(0);
      if (blob) {
        const u8 = new Uint8Array(await blob.arrayBuffer());
        const b64 = toB64(u8);
        // store as attachment-like audio if you want; for now just offer download
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `steth_${Date.now()}.wav`; a.click();
        // also announce presence of a recording (optional)
        fetch(`${API}/api/insight/frame`, {
          method:'POST', headers:{'content-type':'application/json'},
          body: JSON.stringify({ roomId, kind:'stethoscope_recording', ts: Date.now(), mime:'audio/wav', payloadB64: b64 })
        }).catch(()=>{});
      }
    }
  };

  return (
    <section className="border rounded p-3">
      <div className="font-medium">Stethoscope</div>
      <div className="text-xs text-gray-600">BLE NUS (HC21)</div>
      <div className="mt-2 flex items-center gap-2">
        {!nus
          ? <button onClick={connect} className="px-2 py-1 border rounded text-xs">Connect</button>
          : <button onClick={stop} className="px-2 py-1 border rounded text-xs">Disconnect</button>}
        <label className="text-xs flex items-center gap-1 ml-auto">
          <span>Site</span>
          <select className="border rounded px-1 py-0.5" value={site} onChange={e=>setSite(e.target.value as any)}>
            <option value="heart">Heart</option>
            <option value="lung">Lung</option>
          </select>
        </label>
        <button onClick={toggleRec} disabled={!nus} className="px-2 py-1 border rounded text-xs">
          {rec ? `Stop Rec (${recSecs}s)` : 'Record WAV'}
        </button>
      </div>
    </section>
  );
}

/* --------- Otoscope --------- */
function OtoscopeCard({ roomId }: { roomId: string }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    (async () => {
      const all = await navigator.mediaDevices.enumerateDevices();
      const vids = all.filter(d => d.kind === 'videoinput');
      setCams(vids);
    })();
  }, []);

  const start = async () => {
    const s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: deviceId || undefined, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    setStream(s);
    if (videoRef.current) videoRef.current.srcObject = s;
  };
  const stop = () => { stream?.getTracks().forEach(t=>t.stop()); setStream(null); };

  const capture = async () => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>(r => c.toBlob(b => r(b), 'image/jpeg', 0.9));
    if (!blob) return;
    const u8 = new Uint8Array(await blob.arrayBuffer());
    const b64 = toB64(u8);
    await fetch(`${API}/api/insight/frame`, {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ roomId, kind:'otoscope_frame', ts: Date.now(), mime:'image/jpeg', payloadB64: b64 })
    }).catch(()=>{});
    // Also offer local download
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `otoscope_${Date.now()}.jpg`; a.click();
  };

  return (
    <section className="border rounded p-3">
      <div className="font-medium">Otoscope</div>
      <div className="text-xs text-gray-600">Use a UVC camera if available</div>
      <div className="mt-2 flex items-center gap-2">
        <select className="border rounded px-2 py-1 text-xs" value={deviceId ?? ''} onChange={e=>setDeviceId(e.target.value || null)}>
          <option value="">Default camera</option>
          {cams.map(c => <option key={c.deviceId} value={c.deviceId}>{c.label || 'Camera'}</option>)}
        </select>
        {!stream
          ? <button onClick={start} className="px-2 py-1 border rounded text-xs">Start</button>
          : <button onClick={stop} className="px-2 py-1 border rounded text-xs">Stop</button>}
        <button onClick={capture} disabled={!stream} className="px-2 py-1 border rounded text-xs">Capture Still</button>
      </div>
      <div className="mt-2 rounded overflow-hidden border bg-black aspect-video">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
      </div>
    </section>
  );
}

/* --------- NexRing --------- */
function NexRingCard({ roomId }: { roomId: string }) {
  const [conn, setConn] = useState<{ disconnect: ()=>Promise<void> } | null>(null);
  const [sending, setSending] = useState(false);

  const connect = async () => {
    const c = await connectNexRingPPG((_frame) => {
      // raw PPG frames are auto-sent in the decoder (it POSTs to /api/insight/frame)
    }, roomId);
    setConn(c);
  };
  const stop = async () => { try { await conn?.disconnect(); } catch {} setConn(null); };

  const sendSummary = async () => {
    setSending(true);
    try {
      // Example payload — replace with real SDK metrics when available
      const metrics = {
        hr: 74, spo2: 98, rr: 15, hrv: 48, rhr: 62,
        steps: 6234, calories: 420,
        readiness: 76, sleepScore: 82, stress: 31,
        sleepStages: { rem: 78, deep: 54, light: 258 },
      };
      await fetch(`${API}/api/insight/frame`, {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ roomId, kind: 'nexring_metrics', ts: Date.now(), metrics, meta:{ vendor:'nexring' } })
      });
    } catch {}
    setSending(false);
  };

  return (
    <section className="border rounded p-3">
      <div className="font-medium">NexRing</div>
      <div className="text-xs text-gray-600">PPG + summaries</div>
      <div className="mt-2 flex items-center gap-2">
        {!conn
          ? <button onClick={connect} className="px-2 py-1 border rounded text-xs">Connect PPG</button>
          : <button onClick={stop} className="px-2 py-1 border rounded text-xs">Stop PPG</button>}
        <button onClick={sendSummary} disabled={sending} className="px-2 py-1 border rounded text-xs">
          {sending ? 'Sending…' : 'Send Summary'}
        </button>
      </div>
      <div className="text-xs text-gray-500 mt-1">Summary includes HR/SpO₂/RR/HRV/RHR, steps, calories, readiness & sleep.</div>
    </section>
  );
}

/* --------- Basic Health Monitor (demo buttons) --------- */
function MonitorCard({ roomId }: { roomId: string }) {
  const send = (type: string, value: any) => fetch(`${API}/api/insight/frame`, {
    method:'POST', headers:{'content-type':'application/json'},
    body: JSON.stringify({ roomId, kind: type, ts: Date.now(), value })
  }).catch(()=>{});
  return (
    <section className="border rounded p-3">
      <div className="font-medium">Health Monitor</div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <button className="px-2 py-1 border rounded text-xs" onClick={()=>send('bp', { sys:120, dia:78 })}>Take BP</button>
        <button className="px-2 py-1 border rounded text-xs" onClick={()=>send('spo2', 98)}>SpO₂</button>
        <button className="px-2 py-1 border rounded text-xs" onClick={()=>send('temp', 36.8)}>Temp</button>
        <button className="px-2 py-1 border rounded text-xs" onClick={()=>send('ecg_event', { hr: 72 })}>ECG Spot</button>
      </div>
      <div className="text-xs text-gray-500 mt-1">These demo buttons push frames into the room stream.</div>
    </section>
  );
}
