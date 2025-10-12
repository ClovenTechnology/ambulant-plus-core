import { useEffect, useMemo, useRef, useState } from "react";

export type ProviderId = "nexring" | "health-monitor" | "stethoscope" | "otoscope";

export type VitalSample = {
  ts: number;           // epoch ms
  hr?: number;          // bpm
  spo2?: number;        // %
  tempC?: number;       // °C
  rr?: number;          // breaths/min
  bp?: { sys: number; dia: number }; // mmHg
  battery?: number;     // %
};

type Listener = (v: VitalSample) => void;

class MockStream {
  #timer: any = null;
  #listeners: Set<Listener> = new Set();
  #provider: ProviderId;
  #battery = 100;

  constructor(provider: ProviderId) {
    this.#provider = provider;
  }

  on(cb: Listener) { this.#listeners.add(cb); return () => this.#listeners.delete(cb); }

  start() {
    if (this.#timer) return;
    this.#timer = setInterval(() => {
      const now = Date.now();
      // simple drift so the chart wiggles nicely
      const t = now / 1000;

      const sample: VitalSample = { ts: now, battery: Math.max(1, Math.round(this.#battery)) };

      if (this.#provider === "nexring" || this.#provider === "health-monitor") {
        const hrBase = 72 + Math.round(6 * Math.sin(t/4));
        const spo2 = 97 + Math.round(1 * Math.cos(t/7));
        const temp = 36.7 + 0.2 * Math.sin(t/11);
        const rr = 15 + Math.round(2 * Math.sin(t/5));
        sample.hr = hrBase;
        sample.spo2 = Math.min(100, Math.max(92, spo2));
        sample.tempC = Math.round(temp * 10) / 10;
        sample.rr = rr;
        if (this.#provider === "health-monitor") {
          const sys = 120 + Math.round(5 * Math.sin(t/9));
          const dia = 78 + Math.round(4 * Math.cos(t/8));
          sample.bp = { sys, dia };
        }
      }

      // drain battery slowly
      this.#battery -= 0.05;

      for (const cb of this.#listeners) cb(sample);
    }, 1000);
  }

  stop() {
    if (this.#timer) { clearInterval(this.#timer); this.#timer = null; }
  }
}

const singletons: Partial<Record<ProviderId, MockStream>> = {};

function getStream(p: ProviderId) {
  if (!singletons[p]) singletons[p] = new MockStream(p);
  return singletons[p]!;
}

export type UseIoMTReturn = {
  connected: boolean;
  last?: VitalSample;
  history: VitalSample[];
  connect: () => void;
  disconnect: () => void;
  provider: ProviderId;
};

export function useIoMT(provider: ProviderId, opts?: { historySize?: number }): UseIoMTReturn {
  const historySize = opts?.historySize ?? 120; // 2 minutes @1Hz
  const [connected, setConnected] = useState(false);
  const [last, setLast] = useState<VitalSample | undefined>(undefined);
  const historyRef = useRef<VitalSample[]>([]);
  const [tick, setTick] = useState(0);
  const stream = useMemo(() => getStream(provider), [provider]);

  const connect = () => {
    if (connected) return;
    stream.start();
    setConnected(true);
  };

  const disconnect = () => {
    stream.stop();
    setConnected(false);
  };

  useEffect(() => {
    const off = stream.on((s) => {
      historyRef.current.push(s);
      if (historyRef.current.length > historySize) historyRef.current.shift();
      setLast(s);
      setTick(x => x + 1); // trigger rerender
    });
    return () => { off(); };
  }, [stream, historySize]);

  return {
    connected,
    last,
    history: historyRef.current,
    connect,
    disconnect,
    provider
  };
}