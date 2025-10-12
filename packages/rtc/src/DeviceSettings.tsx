"use client";

import { useEffect, useState } from "react";

export type DeviceSettingsValue = {
  micId?: string;
  camId?: string;
  sinkId?: string;
};

type Props = {
  value?: DeviceSettingsValue;                 // ← optional
  onChange?: (v: DeviceSettingsValue) => void; // ← optional
  title?: string;
};

export function DeviceSettings({
  value = {},                                  // ← safe default
  onChange = () => {},                         // ← safe noop
  title = "Settings",
}: Props) {
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [sinks, setSinks] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    (async () => {
      try {
        // permission prompt improves labels
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() => null);
        const list = await navigator.mediaDevices.enumerateDevices();
        setMics(list.filter((d) => d.kind === "audioinput"));
        setCams(list.filter((d) => d.kind === "videoinput"));
        setSinks(list.filter((d) => d.kind === "audiooutput"));
      } catch {}
    })();
  }, []);

  return (
    <details className="border rounded-md p-2 bg-white/50 dark:bg-white/10">
      <summary className="cursor-pointer select-none text-sm font-medium">{title}</summary>
      <div className="mt-2 grid gap-2 md:grid-cols-3">
        <label className="flex flex-col text-sm gap-1">
          <span>Microphone</span>
          <select
            className="border rounded px-2 py-1"
            value={value.micId || ""}
            onChange={(e) => onChange({ ...value, micId: e.target.value || undefined })}
          >
            <option value="">Default</option>
            {mics.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-sm gap-1">
          <span>Camera</span>
          <select
            className="border rounded px-2 py-1"
            value={value.camId || ""}
            onChange={(e) => onChange({ ...value, camId: e.target.value || undefined })}
          >
            <option value="">Default</option>
            {cams.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-sm gap-1">
          <span>Speaker</span>
          <select
            className="border rounded px-2 py-1"
            value={value.sinkId || ""}
            onChange={(e) => onChange({ ...value, sinkId: e.target.value || undefined })}
          >
            <option value="">Default</option>
            {sinks.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Tip: if devices don’t appear, the browser may need mic/camera permission first.
      </p>
    </details>
  );
}
