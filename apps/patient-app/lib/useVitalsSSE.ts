"use client";
import { useEffect, useRef, useState } from "react";

export type VitalMsg = {
  deviceId: string;
  metric: string;          // e.g., hr, spo2, sys, dia, temp, rr, steps…
  value: number | string;  // number preferred; string OK
  ts: number;
  raw?: any;
};

export function useVitalsSSE(deviceId: string) {
  const [last, setLast] = useState<VitalMsg | null>(null);
  const [queue, setQueue] = useState<VitalMsg[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/iomt/stream?deviceId=${encodeURIComponent(deviceId)}`);
    esRef.current = es;

    const onVital = (e: MessageEvent) => {
      const msg: VitalMsg = JSON.parse(e.data);
      setLast(msg);
      setQueue((q) => (q.length > 300 ? q.slice(-300).concat(msg) : q.concat(msg)));
    };

    es.addEventListener("vital", onVital);
    es.onerror = () => { /* browser will auto-retry */ };

    return () => {
      es.removeEventListener("vital", onVital);
      es.close();
      esRef.current = null;
    };
  }, [deviceId]);

  return { last, queue };
}
