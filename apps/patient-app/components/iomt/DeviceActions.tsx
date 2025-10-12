"use client";
import { useState } from "react";

async function send(deviceId: string, cmd: string, payload: any = {}) {
  const r = await fetch("/api/iomt/cmd", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, cmd, payload }),
  });
  if (!r.ok) throw new Error("cmd failed");
  return r.json();
}

export default function DeviceActions({ deviceId = "HealthMonitor-001" }: { deviceId?: string }) {
  const [busy, setBusy] = useState<string | null>(null);

  const click = (cmd: string, payload: any = {}) => async () => {
    try { setBusy(cmd); await send(deviceId, cmd, payload); } finally { setBusy(null); }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <button onClick={click("bp.start")}   disabled={!!busy} className="px-3 py-2 rounded-lg glass border">BP</button>
      <button onClick={click("spo2.start")} disabled={!!busy} className="px-3 py-2 rounded-lg glass border">SpO₂</button>
      <button onClick={click("temp.start")} disabled={!!busy} className="px-3 py-2 rounded-lg glass border">Temp</button>
      <button onClick={click("glucose.start")} disabled={!!busy} className="px-3 py-2 rounded-lg glass border">Glucose</button>

      <button onClick={click("ecg.start")}  disabled={!!busy} className="px-3 py-2 rounded-lg glass border">ECG Start</button>
      <button onClick={click("ecg.stop")}   disabled={!!busy} className="px-3 py-2 rounded-lg glass border">ECG Stop</button>

      <button onClick={click("steth.start", { mode: "heart" })} disabled={!!busy} className="px-3 py-2 rounded-lg glass border">Stetho Heart</button>
      <button onClick={click("steth.start", { mode: "lung" })}  disabled={!!busy} className="px-3 py-2 rounded-lg glass border">Stetho Lung</button>
      <button onClick={click("steth.stop")} disabled={!!busy} className="px-3 py-2 rounded-lg glass border">Stetho Stop</button>

      <button onClick={click("otoscope.photo")} disabled={!!busy} className="px-3 py-2 rounded-lg glass border">Otoscope Photo</button>
      <button onClick={click("otoscope.video.start")} disabled={!!busy} className="px-3 py-2 rounded-lg glass border">Otoscope Video ▶</button>
      <button onClick={click("otoscope.video.stop")}  disabled={!!busy} className="px-3 py-2 rounded-lg glass border">Otoscope Video ⏹</button>
    </div>
  );
}
