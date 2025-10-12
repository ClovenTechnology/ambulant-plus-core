"use client";

import { useEffect, useMemo, useState } from "react";
import type { Room, RemoteParticipant } from "livekit-client";

type Vitals = {
  // common demo keys
  hr?: number;             // heart rate
  spo2?: number;           // %
  tempC?: number;          // Celsius
  hrv?: number;            // ms
  rr?: number;             // breaths/min
  sbp?: number;            // systolic
  dbp?: number;            // diastolic
  // allow extra keys without breaking
  [k: string]: any;
};

function round2(n: any) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(2) : "—";
}

export function MonitorPanel({ room }: { room: Room | null }) {
  const [last, setLast] = useState<Vitals>({});
  const [source, setSource] = useState<string>("—");
  const [ts, setTs] = useState<number | null>(null);

  useEffect(() => {
    if (!room) return;

    const onData = (payload: Uint8Array, p?: RemoteParticipant) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        // Be permissive: accept messages that look like vitals
        const looksVital =
          typeof msg === "object" &&
          (msg.type === "vitals" ||
            msg.kind === "iomt" ||
            "hr" in msg || "spo2" in msg || "tempC" in msg || "hrv" in msg || "rr" in msg || "sbp" in msg || "dbp" in msg);

        if (looksVital) {
          setLast((prev) => ({ ...prev, ...msg }));
          setSource(p?.identity || "device");
          setTs(Date.now());
        }
      } catch {
        /* ignore non-json */
      }
    };

    // @ts-ignore
    room.on?.("dataReceived", onData);
    return () => {
      // @ts-ignore
      room.off?.("dataReceived", onData);
    };
  }, [room]);

  const ago = useMemo(() => (ts ? Math.max(0, Math.round((Date.now() - ts) / 1000)) : null), [ts]);

  return (
    <section className="border rounded p-3 bg-white">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">Live Monitor</div>
        <div className="text-xs text-gray-500">
          {source} {ago !== null ? `• ${ago}s ago` : ""}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
        <Card label="HR" value={`${round2(last.hr)} bpm`} />
        <Card label="SpO₂" value={`${round2(last.spo2)} %`} />
        <Card label="Temp" value={`${round2(last.tempC)} °C`} />
        <Card label="HRV" value={`${round2(last.hrv)} ms`} />
        <Card label="RR" value={`${round2(last.rr)} /min`} />
        <Card label="BP" value={`${round2(last.sbp)}/${round2(last.dbp)} mmHg`} />
      </div>
    </section>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-2 bg-gray-50">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-base font-medium">{value}</div>
    </div>
  );
}
