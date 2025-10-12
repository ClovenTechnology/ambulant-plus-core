// packages/rtc/src/components/DeviceSettings.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type DeviceSettingsValue = {
  micId?: string;
  camId?: string;
  sinkId?: string;
};

type Props = {
  /** Optional controlled value. If omitted, component manages its own state. */
  value?: DeviceSettingsValue;
  /** Optional change handler. Called whenever selection changes. */
  onChange?: (v: DeviceSettingsValue) => void;
  title?: string;
  /**
   * Optional storage key to persist selections in localStorage.
   * Defaults to "rtc.devicePrefs".
   */
  storageKey?: string;
};

const LS_OK = () => typeof window !== 'undefined' && 'localStorage' in window;
const loadPrefs = (key: string): DeviceSettingsValue | null => {
  try {
    if (!LS_OK()) return null;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as DeviceSettingsValue) : null;
  } catch {
    return null;
  }
};
const savePrefs = (key: string, v: DeviceSettingsValue) => {
  try {
    if (!LS_OK()) return;
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
};

export function DeviceSettings({
  value,
  onChange,
  title = 'Device Settings',
  storageKey = 'rtc.devicePrefs',
}: Props) {
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [sinks, setSinks] = useState<MediaDeviceInfo[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // Uncontrolled state fallback (when no value prop is provided)
  const [internal, setInternal] = useState<DeviceSettingsValue>(() => loadPrefs(storageKey) || {});
  const v = value ?? internal;

  const applyChange = (next: DeviceSettingsValue) => {
    if (!value) setInternal(next);
    onChange?.(next);
    savePrefs(storageKey, next);
  };

  // enumerate devices (ask for permission once to reveal labels)
  useEffect(() => {
    (async () => {
      try {
        try {
          // Permissions are required in some browsers to reveal device labels.
          await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        } catch {}
        const list = await navigator.mediaDevices.enumerateDevices();
        setMics(list.filter((d) => d.kind === 'audioinput'));
        setCams(list.filter((d) => d.kind === 'videoinput'));
        setSinks(list.filter((d) => d.kind === 'audiooutput'));
      } catch (e: any) {
        setErr(e?.message || 'Unable to enumerate devices');
      }
    })();
  }, []);

  // ---- mic level meter (nice UX, optional) ----
  const [micLevel, setMicLevel] = useState(0);
  useEffect(() => {
    let stop: (() => void) | undefined;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AC) return;
        const ctx = new AC();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        let raf = 0;
        const loop = () => {
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          setMicLevel(Math.sqrt(sum / buf.length));
          raf = requestAnimationFrame(loop);
        };
        loop();
        stop = () => {
          cancelAnimationFrame(raf);
          try {
            ctx.close();
          } catch {}
          stream.getTracks().forEach((t) => t.stop());
        };
      } catch {}
    })();
    return () => stop?.();
  }, []);

  // ---- optional camera preview ----
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const preview = async () => {
    try {
      const constraints = { video: v.camId ? { deviceId: { exact: v.camId } } : true };
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) (videoRef.current as any).srcObject = s;
    } catch {}
  };
  const stopPreview = () => {
    const el = videoRef.current as any;
    const s: MediaStream | undefined = el?.srcObject;
    s?.getTracks().forEach((t) => t.stop());
    if (el) el.srcObject = null;
  };

  // speaker beep
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const testBeep = async () => {
    try {
      const a = audioRef.current!;
      // If setSinkId is supported, honor chosen sink (Chrome)
      const anyA: any = a;
      if (v.sinkId && typeof anyA.setSinkId === 'function') {
        await anyA.setSinkId(v.sinkId);
      }
      // tiny WAV silence header (works as a "beep" if you replace the data URL later)
      a.src =
        'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';
      await a.play();
    } catch {}
  };

  // label helper
  const label = (d: MediaDeviceInfo) => d.label || d.deviceId || 'Unknown';

  // style helpers
  const meterW = Math.min(100, Math.round(micLevel * 400));

  return (
    <details className="border rounded-md p-2 bg-white/50 dark:bg-white/10 open:shadow-sm">
      <summary className="cursor-pointer select-none text-sm font-medium">{title}</summary>

      {err && (
        <div className="mt-2 rounded border border-rose-200 bg-rose-50 text-rose-800 p-2 text-sm">
          {err}
        </div>
      )}

      <div className="mt-2 grid gap-3 md:grid-cols-3">
        {/* Mic */}
        <label className="flex flex-col text-sm gap-1">
          <span className="font-medium">Microphone</span>
          <select
            className="border rounded px-2 py-1"
            value={v?.micId || ''}
            onChange={(e) => applyChange({ ...v, micId: e.target.value || undefined })}
          >
            <option value="">System default</option>
            {mics.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {label(d)}
              </option>
            ))}
          </select>
          <div className="mt-1 h-2 rounded bg-gray-100 overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${meterW}%` }} />
          </div>
        </label>

        {/* Speaker */}
        <label className="flex flex-col text-sm gap-1">
          <span className="font-medium">Speaker</span>
          <select
            className="border rounded px-2 py-1"
            value={v?.sinkId || ''}
            onChange={(e) => applyChange({ ...v, sinkId: e.target.value || undefined })}
          >
            <option value="">System default</option>
            {sinks.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {label(d)}
              </option>
            ))}
          </select>
          <div className="flex gap-2 mt-1">
            <button className="px-2 py-1 border rounded" onClick={testBeep}>
              Test
            </button>
            <audio ref={audioRef} className="hidden" />
          </div>
        </label>

        {/* Camera */}
        <label className="flex flex-col text-sm gap-1">
          <span className="font-medium">Camera</span>
          <select
            className="border rounded px-2 py-1"
            value={v?.camId || ''}
            onChange={(e) => applyChange({ ...v, camId: e.target.value || undefined })}
          >
            <option value="">System default</option>
            {cams.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {label(d)}
              </option>
            ))}
          </select>
          <video
            ref={videoRef}
            className="mt-2 w-full rounded bg-black/70 aspect-video"
            autoPlay
            muted
            playsInline
          />
          <div className="mt-1 flex gap-2">
            <button className="px-2 py-1 border rounded" onClick={preview}>
              Preview
            </button>
            <button className="px-2 py-1 border rounded" onClick={stopPreview}>
              Stop
            </button>
          </div>
        </label>
      </div>

      <div className="mt-2 flex gap-2 text-xs">
        <button
          className="px-2 py-1 border rounded"
          onClick={() => applyChange({})}
          title="Clear preferences and use system defaults"
        >
          Reset to default
        </button>
        <div className="text-gray-500">
          Tip: if devices don’t appear, the browser may need mic/camera permission first.
        </div>
      </div>
    </details>
  );
}

export default DeviceSettings;
