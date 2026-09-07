// apps/clinician-app/components/OtoscopePanel.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const GW =
  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
  process.env.NEXT_PUBLIC_GATEWAY_BASE ||
  '';

function b64ToUrl(b64: string, mime = 'image/jpeg') {
  const byteStr = atob(b64);
  const len = byteStr.length;
  const u8 = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    u8[i] = byteStr.charCodeAt(i);
  }

  return URL.createObjectURL(new Blob([u8], { type: mime }));
}

function extensionForMime(mime: string) {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  return 'jpg';
}

type Frame = {
  url: string;
  ts: number;
  mime: string;
};

type Props = {
  roomId?: string;
  encounterId?: string | null;
  patientId?: string | null;
  canSaveToSummary?: boolean;
};

export default function OtoscopePanel({
  roomId,
  encounterId,
  patientId,
  canSaveToSummary = false,
}: Props) {
  const [connected, setConnected] = useState(false);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [selected, setSelected] = useState<number>(-1);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const url = useMemo(() => {
    const base = GW?.replace(/\/+$/, '') || '';
    const path = `/api/insight/stream?session=${encodeURIComponent(
      roomId || 'default',
    )}`;

    return base ? `${base}${path}` : path;
  }, [roomId]);

  const connect = () => {
    if (esRef.current) return;

    const es = new EventSource(url, { withCredentials: false });

    es.addEventListener('frame', (event) => {
      try {
        const obj = JSON.parse((event as MessageEvent).data);

        if (!obj?.b64) return;

        const isOtoscope = [
          'otoscope_frame',
          'photo',
          'image',
          'video_frame',
        ].some((kind) => String(obj.kind || '').includes(kind));

        if (!isOtoscope) return;

        const mime = obj.mime || 'image/jpeg';
        const href = b64ToUrl(obj.b64, mime);
        const frame: Frame = {
          url: href,
          ts: obj.ts || Date.now(),
          mime,
        };

        setFrames((current) => {
          const next = [...current, frame];

          while (next.length > 32) {
            const removed = next.shift();

            try {
              if (removed) URL.revokeObjectURL(removed.url);
            } catch {}
          }

          return next;
        });

        setConnected(true);
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

  useEffect(
    () => () => {
      try {
        esRef.current?.close();
      } catch {}

      for (const frame of frames) {
        try {
          URL.revokeObjectURL(frame.url);
        } catch {}
      }
    },
    [],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedFrame =
    frames[selected] || frames[frames.length - 1] || null;

  const canPersist = Boolean(
    canSaveToSummary &&
      selectedFrame &&
      encounterId &&
      patientId,
  );

  const saveToSummary = async () => {
    if (!canPersist || !selectedFrame || !encounterId || !patientId) {
      return;
    }

    setSaving(true);
    setSaveState(null);

    try {
      const sourceResponse = await fetch(selectedFrame.url);

      if (!sourceResponse.ok) {
        throw new Error(`capture_blob_fetch_failed_${sourceResponse.status}`);
      }

      const blob = await sourceResponse.blob();
      const extension = extensionForMime(selectedFrame.mime);
      const fileName = `otoscope_${selectedFrame.ts}.${extension}`;
      const file = new File([blob], fileName, {
        type: selectedFrame.mime || blob.type || 'image/jpeg',
      });

      const form = new FormData();
      form.set('file', file);
      form.set('patientId', patientId);
      form.set('docType', 'device-evidence');
      form.set('source', 'otoscope');
      form.set(
        'title',
        `Otoscope capture · ${new Date(selectedFrame.ts).toISOString()}`,
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

        <span className="text-xs text-gray-600">
          Frames: {frames.length}
        </span>
      </div>

      <div className="rounded border bg-black aspect-video grid place-items-center overflow-hidden">
        {selectedFrame ? (
          <img
            src={selectedFrame.url}
            alt="Otoscope"
            className="object-contain w-full h-full"
          />
        ) : (
          <div className="text-xs text-gray-400">No frames yet</div>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto py-1">
        {frames.map((frame, index) => (
          <button
            key={`${frame.ts}_${index}`}
            onClick={() => setSelected(index)}
            className={`border rounded overflow-hidden w-24 h-16 shrink-0 ${
              index === selected ? 'ring-2 ring-blue-500' : ''
            }`}
            title={new Date(frame.ts).toLocaleTimeString()}
          >
            <img
              src={frame.url}
              className="object-cover w-full h-full"
              alt=""
            />
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <a
          className={`px-2 py-1 border rounded text-xs ${
            selectedFrame ? '' : 'pointer-events-none opacity-50'
          }`}
          href={selectedFrame?.url ?? '#'}
          download={`otoscope_${selectedFrame?.ts ?? Date.now()}.jpg`}
        >
          Download
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
