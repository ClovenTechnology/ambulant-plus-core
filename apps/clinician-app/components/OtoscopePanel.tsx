//apps/clinician-app/components/OtoscopePanel.tsx
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

const GW = process.env.NEXT_PUBLIC_GATEWAY_ORIGIN || process.env.NEXT_PUBLIC_GATEWAY_BASE || '';

function b64ToUrl(b64: string, mime = 'image/jpeg') {
  const byteStr = atob(b64);
  const len = byteStr.length;
  const u8 = new Uint8Array(len);
  for (let i = 0; i < len; i++) u8[i] = byteStr.charCodeAt(i);
  const blob = new Blob([u8], { type: mime });
  return URL.createObjectURL(blob);
}

type Frame = { url: string; ts: number; mime: string };

export default function OtoscopePanel({ roomId, canSaveToSummary = false }: { roomId?: string; canSaveToSummary?: boolean }) {
  const [connected, setConnected] = useState(false);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [selected, setSelected] = useState<number>(-1);
  const esRef = useRef<EventSource | null>(null);

  const url = useMemo(() => {
    const base = GW?.replace(/\/+$/, '') || '';
    const path = `/api/insight/stream?session=${encodeURIComponent(roomId || 'default')}`;
    return base ? `${base}${path}` : path;
  }, [roomId]);

  const connect = () => {
    if (esRef.current) return;
    const es = new EventSource(url, { withCredentials: false });
    es.addEventListener('frame', (e) => {
      try {
        const obj = JSON.parse((e as MessageEvent).data);
        if (!obj?.b64) return;
        // Accept multiple kinds for flexibility
        const isOto = ['otoscope_frame', 'photo', 'image', 'video_frame'].some(k => String(obj.kind || '').includes(k));
        if (!isOto) return;
        const mime = obj.mime || 'image/jpeg';
        const href = b64ToUrl(obj.b64, mime);
        const f: Frame = { url: href, ts: obj.ts || Date.now(), mime };
        setFrames((arr) => {
          const next = [...arr, f];
          // keep last 32
          while (next.length > 32) {
            const drop = next.shift();
            try { if (drop) URL.revokeObjectURL(drop.url); } catch {}
          }
          return next;
        });
        setConnected(true);
      } catch {}
    });
    es.addEventListener('ready', () => setConnected(true));
    es.onerror = () => { /* keep open */ };
    esRef.current = es;
    setConnected(true);
  };

  const disconnect = () => {
    try { esRef.current?.close(); } catch {}
    esRef.current = null;
    setConnected(false);
  };

  useEffect(() => () => {
    try { esRef.current?.close(); } catch {}
    for (const f of frames) try { URL.revokeObjectURL(f.url); } catch {}
  }, []); // eslint-disable-line

  const sel = frames[selected] || frames[frames.length - 1] || null;

  const saveToSummary = () => {
    if (!canSaveToSummary || !sel) return;
    // TODO: POST the Blob (fetch(sel.url).blob()) to your attachments API with encounter metadata.
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {!connected
          ? <button className="px-2 py-1 border rounded text-xs" onClick={connect}>Connect</button>
          : <button className="px-2 py-1 border rounded text-xs" onClick={disconnect}>Disconnect</button>}
        <span className="text-xs text-gray-600">Frames: {frames.length}</span>
      </div>

      {/* main viewer */}
      <div className="rounded border bg-black aspect-video grid place-items-center overflow-hidden">
        {sel
          ? <img src={sel.url} alt="Otoscope" className="object-contain w-full h-full" />
          : <div className="text-xs text-gray-400">No frames yet</div>}
      </div>

      {/* strip */}
      <div className="flex gap-2 overflow-x-auto py-1">
        {frames.map((f, i) => (
          <button
            key={f.ts + '_' + i}
            onClick={() => setSelected(i)}
            className={`border rounded overflow-hidden w-24 h-16 shrink-0 ${i === selected ? 'ring-2 ring-blue-500' : ''}`}
            title={new Date(f.ts).toLocaleTimeString()}
          >
            <img src={f.url} className="object-cover w-full h-full" alt="" />
          </button>
        ))}
      </div>

      {/* actions */}
      <div className="flex items-center gap-2">
        <a
          className={`px-2 py-1 border rounded text-xs ${sel ? '' : 'pointer-events-none opacity-50'}`}
          href={sel?.url ?? '#'}
          download={`otoscope_${sel?.ts ?? Date.now()}.jpg`}
        >
          Download
        </a>
        <button
          className={`px-2 py-1 border rounded text-xs ${canSaveToSummary && sel ? '' : 'opacity-50'}`}
          disabled={!canSaveToSummary || !sel}
          onClick={saveToSummary}
          title={!canSaveToSummary ? 'Premium patients only' : undefined}
        >
          Save to session summary
        </button>
      </div>
    </div>
  );
}
