"use client";

import { useEffect, useMemo, useState } from "react";
import { RoomEvent } from "livekit-client";
import { isVitalsPayload, type VitalsPayload } from "./iomt";

type Row = {
  ts: number;
  device: string;
  hr?: number;
  spo2?: number;
  temp?: number;
  bp_sys?: number;
  bp_dia?: number;
  rr?: number;
};

export function MonitorPanel({ room }: { room: any }) {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!room?.on) return;
    const onData = (bytes: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(bytes));
        if (isVitalsPayload(msg)) {
          setRows((prev) =>
            [...prev, { ts: msg.ts, device: msg.device, ...msg.values }].slice(-30)
          );
        }
      } catch {}
    };
    room.on(RoomEvent.DataReceived as any, onData);
    return () => room.off?.(RoomEvent.DataReceived as any, onData);
  }, [room]);

  const latest = rows.at(-1);

  return (
    <div className="p-3 border rounded-md bg-white">
      <div className="text-sm font-semibold mb-2">Live Vitals</div>
      {latest ? (
        <div className="grid grid-cols-3 gap-2 text-sm">
          <Metric label="HR" value={latest.hr} suffix="bpm" />
          <Metric label="SpO₂" value={latest.spo2} suffix="%" />
          <Metric label="Temp" value={latest.temp} suffix="°C" />
          <Metric label="BP" value={(latest.bp_sys && latest.bp_dia) ? `${latest.bp_sys}/${latest.bp_dia}` : undefined} />
          <Metric label="RR" value={latest.rr} suffix="/min" />
          <Metric label="Device" value={latest.device} />
        </div>
      ) : (
        <div className="text-xs text-gray-500">Waiting for data…</div>
      )}

      <div className="mt-3 max-h-48 overflow-auto">
        <table className="w-full text-xs">
          <thead className="text-gray-500">
            <tr>
              <th className="text-left">Time</th>
              <th className="text-left">Device</th>
              <th>HR</th><th>SpO₂</th><th>Temp</th><th>BP</th><th>RR</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice().reverse().map((r, i) => (
              <tr key={i} className="border-t">
                <td>{new Date(r.ts).toLocaleTimeString()}</td>
                <td>{r.device}</td>
                <td className="text-center">{nullable(r.hr)}</td>
                <td className="text-center">{nullable(r.spo2)}</td>
                <td className="text-center">{nullable(r.temp)}</td>
                <td className="text-center">
                  {(r.bp_sys && r.bp_dia) ? `${r.bp_sys}/${r.bp_dia}` : "—"}
                </td>
                <td className="text-center">{nullable(r.rr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Metric({ label, value, suffix }: { label: string; value: any; suffix?: string }) {
  return (
    <div className="border rounded p-2">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-sm font-medium">{value ?? "—"} {value != null && suffix ? suffix : ""}</div>
    </div>
  );
}

function nullable(n?: number) {
  return n == null ? "—" : n;
}
