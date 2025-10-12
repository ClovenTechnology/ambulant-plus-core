'use client';

import { useEffect, useRef, useState } from 'react';

type Vitals = { hr?:number; spo2?:number; sys?:number; dia?:number; temp?:number; glu?:number };
type Ts = Partial<Record<keyof Vitals, number>>;
type SourceMap = Partial<Record<keyof Vitals, string>>;
type LiveMode = 'idle'|'sse'|'mock';

export default function useLiveVitals() {
  const [latest, setLatest] = useState<Vitals>({});
  const [latestTs, setLatestTs] = useState<Ts>({});
  const [sourceMap, setSourceMap] = useState<SourceMap>({});
  const [series, setSeries] = useState<any>({ labels: [], hr: [], spo2: [], temp: [] });
  const [live, setLive] = useState<LiveMode>('idle');

  const closedRef = useRef(false);

  useEffect(() => {
    closedRef.current = false;

    // Always start with SSE (server mock). No external deps.
    let sse: EventSource | null = null;
    try {
      sse = new EventSource('/api/iomt/stream');
      sse.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          apply(msg, msg?.source ?? 'Wearable');
          if (live !== 'sse') setLive('sse');
        } catch {/* ignore */}
      };
      sse.onerror = () => { try { sse?.close(); } catch {} };
    } catch {
      setLive('mock');
    }

    function apply(obj: any, source?: string) {
      if (!obj || closedRef.current) return;
      const ts = Number(obj.ts ?? Date.now());
      const up: Vitals = {};
      const tsup: Ts = {};
      (['hr','spo2','sys','dia','temp','glu'] as const).forEach(k => {
        if (obj[k] !== undefined && obj[k] !== null) {
          // Business rule: glucose never from Wearable
          if (k === 'glu' && (source ?? '').toLowerCase().includes('wearable')) return;
          (up as any)[k] = obj[k];
          tsup[k] = ts;
        }
      });
      if (Object.keys(up).length === 0) return;

      setLatest(prev => ({ ...prev, ...up }));
      setLatestTs(prev => ({ ...prev, ...tsup }));
      setSourceMap(prev => ({
        ...prev,
        ...Object.fromEntries(Object.keys(up).map(k => [k, source ?? (prev as any)[k] ?? '—']))
      }));
      setSeries((s: any) => ({
        labels: [...s.labels, ts].slice(-60),
        hr:     [...(s.hr ?? []),   up.hr   ?? (s.hr?.at(-1)   ?? null)].slice(-60),
        spo2:   [...(s.spo2 ?? []), up.spo2 ?? (s.spo2?.at(-1) ?? null)].slice(-60),
        temp:   [...(s.temp ?? []), up.temp ?? (s.temp?.at(-1) ?? null)].slice(-60),
      }));
    }

    return () => {
      closedRef.current = true;
      try { sse?.close(); } catch {}
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { latest, latestTs, sourceMap, series, live };
}
